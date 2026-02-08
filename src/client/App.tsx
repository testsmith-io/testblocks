import React, { useState, useCallback, useRef, useEffect } from 'react';
import * as Blockly from 'blockly';
import { TestFile, TestCase, TestResult, VariableDefinition, TestStep, ProcedureDefinition, BlockDefinition, FolderHooks } from '../core';
import { BlocklyWorkspace } from './components/BlocklyWorkspace';
import { StepResultItem } from './components/StepResultItem';
import { FileTree, FileNode } from './components/FileTree';
import { HelpDialog } from './components/HelpDialog';
import { RecordDialog } from './components/RecordDialog';
import { OpenApiImportDialog, GeneratedFile } from './components/OpenApiImportDialog';
import { workspaceToTestSteps } from './blockly/blockDefinitions';
import { exportCustomBlocksAsProcedures, loadCustomBlocksFromProcedures, clearCustomBlocks } from './blockly/customBlockCreator';
import { applyMatchToTestFile, BlockMatch } from './blockly/blockMatcher';
import { CreateBlockResult } from './components/CreateBlockDialog';
import { PromptDialog, PromptField } from './components/PromptDialog';
import { loadPlugin } from './plugins/pluginLoader';
import {
  setGlobalVariables,
  setFileVariables,
  setEditingMode,
  setDataColumns,
} from './blockly/variableContext';
import { ToastContainer, useToast, toast } from './components/Toast';
import { VariablesEditor, recordToVariables, variablesToRecord } from './components/VariablesEditor';
import {
  saveDirectoryHandle,
  getStoredDirectoryHandle,
  scanDirectory,
  loadGlobalsFile,
  findNodeByPath,
  findFolderByPath,
  setNestedValue,
  collectAllTestFiles,
  GlobalsFile,
  getServerProjectDir,
  loadProjectFromServer,
  writeFileToServer,
  loadGlobalsFromServer,
} from './utils';

type EditorTab = 'test' | 'beforeAll' | 'afterAll' | 'beforeEach' | 'afterEach';

interface AppState {
  // Project state
  projectRoot: FileNode | null;
  lastFolderName: string | null; // Name of last opened folder (for re-open prompt)
  selectedFilePath: string | null;
  globalVariables: Record<string, unknown> | null;
  globalsFileContent: GlobalsFile | null;
  serverProjectDir: string | null; // When using --project-dir, server handles file I/O
  // Current file state
  testFile: TestFile;
  selectedTestIndex: number;
  // Folder hooks editing
  editingFolderHooks: FileNode | null; // When set, we're editing folder hooks instead of a test file
  folderHooks: FolderHooks; // Current folder hooks being edited
  // UI state
  results: TestResult[];
  isRunning: boolean;
  runningTestId: string | null;
  showVariables: boolean;
  showGlobalVariables: boolean;
  headless: boolean;
  editorTab: EditorTab;
  sidebarTab: 'files' | 'tests';
  showHelpDialog: boolean;
  showRecordDialog: boolean;
  showOpenApiDialog: boolean;
  pluginsLoaded: boolean;
  autoSaveStatus: 'idle' | 'saving' | 'saved';
  resultsPanelCollapsed: boolean;
  sidebarCollapsed: boolean;
  // Test run state
  failedFiles: Set<string>; // Paths of files with failed tests from last run
  failedTestsMap: Map<string, Set<string>>; // Map of file path -> Set of test IDs that failed
  // App info
  version: string | null;
}

const initialTestFile: TestFile = {
  version: '1.0.0',
  name: 'Untitled Test Suite',
  description: '',
  variables: {},
  tests: [
    {
      id: 'test-1',
      name: 'Test Case 1',
      description: '',
      steps: [],
      tags: [],
    },
  ],
};

export default function App() {
  const { toasts, dismissToast } = useToast();

  const [state, setState] = useState<AppState>({
    projectRoot: null,
    lastFolderName: null,
    selectedFilePath: null,
    globalVariables: null,
    globalsFileContent: null,
    serverProjectDir: null,
    testFile: initialTestFile,
    selectedTestIndex: 0,
    editingFolderHooks: null,
    folderHooks: { version: '1.0.0' },
    results: [],
    isRunning: false,
    runningTestId: null,
    showVariables: false,
    showGlobalVariables: false,
    headless: localStorage.getItem('testblocks-headless') !== 'false',
    editorTab: 'test',
    sidebarTab: 'files',
    showHelpDialog: false,
    showRecordDialog: false,
    showOpenApiDialog: false,
    pluginsLoaded: false,
    autoSaveStatus: 'idle',
    resultsPanelCollapsed: false,
    sidebarCollapsed: false,
    failedFiles: new Set(),
    failedTestsMap: new Map(),
    version: null,
  });

  // Prompt dialog state (separate from main state to allow callbacks)
  const [promptDialog, setPromptDialog] = useState<{
    isOpen: boolean;
    title: string;
    fields: PromptField[];
    onSubmit: (values: Record<string, string>) => void;
  } | null>(null);

  const showPrompt = useCallback((
    title: string,
    fields: PromptField[],
    onSubmit: (values: Record<string, string>) => void
  ) => {
    setPromptDialog({ isOpen: true, title, fields, onSubmit });
  }, []);

  const closePrompt = useCallback(() => {
    setPromptDialog(null);
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const dirHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const globalsHandleRef = useRef<FileSystemFileHandle | null>(null);
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoadRef = useRef(true);

  const selectedTest = state.testFile.tests[state.selectedTestIndex];

  // Auto-save effect - debounced save when test file changes
  useEffect(() => {
    // Skip auto-save during initial load
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }

    // Only auto-save if we have a file open in a project folder
    if (!state.selectedFilePath || !state.projectRoot) {
      return;
    }

    // Clear any pending auto-save
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Show saving indicator
    setState(prev => ({ ...prev, autoSaveStatus: 'saving' }));

    // Debounce auto-save by 1 second
    autoSaveTimeoutRef.current = setTimeout(async () => {
      const selectedNode = findNodeByPath(state.projectRoot, state.selectedFilePath);

      // Server-managed mode: use API
      if (state.serverProjectDir && selectedNode) {
        try {
          const success = await writeFileToServer(state.selectedFilePath!, state.testFile);
          if (success) {
            selectedNode.testFile = state.testFile;
            console.log('[Auto-save] Saved via server:', state.selectedFilePath);
            setState(prev => ({ ...prev, autoSaveStatus: 'saved' }));
            setTimeout(() => {
              setState(prev => prev.autoSaveStatus === 'saved' ? { ...prev, autoSaveStatus: 'idle' } : prev);
            }, 2000);
          } else {
            console.error('[Auto-save] Server save failed');
            setState(prev => ({ ...prev, autoSaveStatus: 'idle' }));
          }
        } catch (error) {
          console.error('[Auto-save] Failed to save via server:', error);
          setState(prev => ({ ...prev, autoSaveStatus: 'idle' }));
        }
        return;
      }

      // File System Access API mode
      if (selectedNode?.handle) {
        try {
          const writable = await (selectedNode.handle as FileSystemFileHandle).createWritable();
          await writable.write(JSON.stringify(state.testFile, null, 2));
          await writable.close();
          selectedNode.testFile = state.testFile;
          console.log('[Auto-save] Saved:', state.selectedFilePath);
          setState(prev => ({ ...prev, autoSaveStatus: 'saved' }));
          // Clear "saved" status after 2 seconds
          setTimeout(() => {
            setState(prev => prev.autoSaveStatus === 'saved' ? { ...prev, autoSaveStatus: 'idle' } : prev);
          }, 2000);
        } catch (error) {
          console.error('[Auto-save] Failed to save:', error);
          setState(prev => ({ ...prev, autoSaveStatus: 'idle' }));
        }
      } else {
        setState(prev => ({ ...prev, autoSaveStatus: 'idle' }));
      }
    }, 1000);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [state.testFile, state.selectedFilePath, state.projectRoot, state.serverProjectDir]);

  // Auto-save effect for folder hooks
  useEffect(() => {
    // Skip if not editing folder hooks
    if (!state.editingFolderHooks) {
      return;
    }

    // Skip auto-save during initial load
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }

    // Clear any pending auto-save
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Show saving indicator
    setState(prev => ({ ...prev, autoSaveStatus: 'saving' }));

    // Debounce auto-save by 1 second
    autoSaveTimeoutRef.current = setTimeout(async () => {
      const folderNode = state.editingFolderHooks;
      if (!folderNode?.folderHandle) {
        setState(prev => ({ ...prev, autoSaveStatus: 'idle' }));
        return;
      }

      try {
        // Check if hooks are empty
        const hasHooks = state.folderHooks.beforeAll?.length || state.folderHooks.afterAll?.length ||
                         state.folderHooks.beforeEach?.length || state.folderHooks.afterEach?.length;

        if (hasHooks) {
          // Create or update _hooks.testblocks.json
          const hooksHandle = folderNode.hooksFileHandle ||
            await folderNode.folderHandle.getFileHandle('_hooks.testblocks.json', { create: true });
          const writable = await hooksHandle.createWritable();
          await writable.write(JSON.stringify(state.folderHooks, null, 2));
          await writable.close();

          // Update the node
          folderNode.folderHooks = state.folderHooks;
          folderNode.hooksFileHandle = hooksHandle;
          console.log('[Auto-save] Saved folder hooks:', folderNode.path);
        } else if (folderNode.hooksFileHandle) {
          // Delete the hooks file if no hooks defined
          try {
            await folderNode.folderHandle.removeEntry('_hooks.testblocks.json');
            folderNode.folderHooks = undefined;
            folderNode.hooksFileHandle = undefined;
            console.log('[Auto-save] Removed empty folder hooks:', folderNode.path);
          } catch {
            // File might not exist, that's ok
          }
        }

        setState(prev => ({ ...prev, autoSaveStatus: 'saved' }));
        // Clear "saved" status after 2 seconds
        setTimeout(() => {
          setState(prev => prev.autoSaveStatus === 'saved' ? { ...prev, autoSaveStatus: 'idle' } : prev);
        }, 2000);
      } catch (error) {
        console.error('[Auto-save] Failed to save folder hooks:', error);
        setState(prev => ({ ...prev, autoSaveStatus: 'idle' }));
      }
    }, 1000);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [state.folderHooks, state.editingFolderHooks]);

  // Helper to open a directory from a handle
  const openDirectoryFromHandle = useCallback(async (dirHandle: FileSystemDirectoryHandle) => {
    dirHandleRef.current = dirHandle;

    // Load directory contents and globals in parallel
    const [root, globalsResult] = await Promise.all([
      scanDirectory(dirHandle),
      loadGlobalsFile(dirHandle),
    ]);

    // Store the globals file handle for saving
    globalsHandleRef.current = globalsResult.handle;

    setState(prev => ({
      ...prev,
      projectRoot: root,
      globalVariables: globalsResult.variables,
      globalsFileContent: globalsResult.fullContent,
      selectedFilePath: null,
      sidebarTab: 'files',
    }));
  }, []);

  // Try to restore last opened folder on startup
  // First check if server has a project directory configured (--project-dir)
  useEffect(() => {
    const tryLoadProject = async () => {
      try {
        // First, check if server has a project directory configured
        console.log('[Restore] Checking for server project directory...');
        const serverDir = await getServerProjectDir();

        if (serverDir) {
          console.log('[Restore] Server project directory found:', serverDir);
          // Load project from server
          const projectRoot = await loadProjectFromServer();
          if (projectRoot) {
            // Load globals from server
            const { variables, fullContent } = await loadGlobalsFromServer();
            if (variables) {
              setGlobalVariables(variables);
            }

            setState(prev => ({
              ...prev,
              projectRoot,
              serverProjectDir: serverDir,
              globalVariables: variables,
              globalsFileContent: fullContent,
            }));
            console.log('[Restore] Successfully loaded server project:', projectRoot.name);
            return;
          }
        }

        // No server project, try to restore from IndexedDB
        console.log('[Restore] Attempting to restore last folder from IndexedDB...');
        const storedHandle = await getStoredDirectoryHandle();

        if (!storedHandle) {
          console.log('[Restore] No stored handle found');
          return;
        }

        console.log('[Restore] Found stored handle:', storedHandle.name);

        // Check current permission state first
        const currentPermission = await storedHandle.queryPermission({ mode: 'readwrite' });
        console.log('[Restore] Permission status:', currentPermission);

        if (currentPermission === 'granted') {
          // Already have permission, open directly
          await openDirectoryFromHandle(storedHandle);
          console.log('[Restore] Successfully restored folder:', storedHandle.name);
        } else {
          // Need permission - show the folder name so user can re-open
          setState(prev => ({ ...prev, lastFolderName: storedHandle.name }));
          console.log('[Restore] Folder needs permission, showing reopen prompt:', storedHandle.name);
        }
      } catch (e) {
        // Permission denied or handle expired - that's okay
        console.error('[Restore] Could not restore last folder:', (e as Error).message);
      }
    };

    tryLoadProject();
  }, [openDirectoryFromHandle]);

  // Fetch version on startup
  useEffect(() => {
    fetch('/api/version')
      .then(res => res.json())
      .then(data => {
        if (data.version) {
          setState(prev => ({ ...prev, version: data.version }));
        }
      })
      .catch(() => {
        // Ignore version fetch errors
      });
  }, []);

  // Fetch and register plugins from server on startup
  useEffect(() => {
    const fetchPlugins = async () => {
      try {
        const response = await fetch('/api/plugins');
        if (!response.ok) {
          console.warn('Failed to fetch plugins from server');
          setState(prev => ({ ...prev, pluginsLoaded: true }));
          return;
        }
        const data = await response.json();
        if (data.loaded && Array.isArray(data.loaded)) {
          for (const plugin of data.loaded) {
            if (plugin.blocks && Array.isArray(plugin.blocks)) {
              loadPlugin({
                name: plugin.name,
                version: plugin.version,
                description: plugin.description,
                blocks: plugin.blocks as BlockDefinition[],
              });
            }
          }
          console.log(`Loaded ${data.loaded.length} plugin(s) from server`);
        }
      } catch (err) {
        console.warn('Could not fetch plugins from server:', (err as Error).message);
      }
      setState(prev => ({ ...prev, pluginsLoaded: true }));
    };

    fetchPlugins();
  }, []);

  // Update variable context for autocomplete
  useEffect(() => {
    // Set global variables
    setGlobalVariables(state.globalVariables);

    // Set file variables (only when editing a file, not folder hooks)
    if (!state.editingFolderHooks) {
      setFileVariables(state.testFile.variables || null);
    } else {
      setFileVariables(null);
    }

    // Set editing mode
    setEditingMode(state.editingFolderHooks ? 'folder' : 'file');

    // Set data columns from current test's data (if data-driven)
    const currentTest = state.testFile.tests[state.selectedTestIndex];
    if (currentTest?.data && currentTest.data.length > 0) {
      // Extract column names from first data row
      const columns = Object.keys(currentTest.data[0].values || {});
      setDataColumns(columns);
    } else {
      setDataColumns([]);
    }
  }, [
    state.globalVariables,
    state.testFile.variables,
    state.editingFolderHooks,
    state.testFile.tests,
    state.selectedTestIndex,
  ]);

  // Re-open last folder (triggered by user click)
  const handleReopenLastFolder = useCallback(async () => {
    try {
      const storedHandle = await getStoredDirectoryHandle();
      if (storedHandle) {
        // Request permission (requires user gesture)
        const permission = await storedHandle.requestPermission({ mode: 'readwrite' });
        if (permission === 'granted') {
          await openDirectoryFromHandle(storedHandle);
          setState(prev => ({ ...prev, lastFolderName: null }));
        }
      }
    } catch (e) {
      console.error('Failed to reopen folder:', e);
      // Clear the prompt if it failed
      setState(prev => ({ ...prev, lastFolderName: null }));
    }
  }, [openDirectoryFromHandle]);

  // Open folder using File System Access API or fallback
  const handleOpenFolder = useCallback(async () => {
    // Check if the modern API is supported
    if ('showDirectoryPicker' in window) {
      try {
        console.log('[OpenFolder] Opening directory picker...');
        const dirHandle = await (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker();

        console.log('[OpenFolder] Selected folder:', dirHandle.name);

        // Save the handle for future sessions
        try {
          await saveDirectoryHandle(dirHandle);
          console.log('[OpenFolder] Saved handle to IndexedDB');
        } catch (saveError) {
          console.error('[OpenFolder] Failed to save handle to IndexedDB:', saveError);
          // Continue anyway - the folder will still open, just won't persist
        }

        await openDirectoryFromHandle(dirHandle);
        setState(prev => ({ ...prev, lastFolderName: null }));
        console.log('[OpenFolder] Folder opened successfully');
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          console.error('[OpenFolder] Failed to open folder:', e);
          toast.error('Failed to open folder: ' + (e as Error).message);
        }
      }
    } else {
      // Fallback: use webkitdirectory input
      console.log('[OpenFolder] Using fallback webkitdirectory');
      folderInputRef.current?.click();
    }
  }, [openDirectoryFromHandle]);

  // Handle folder input change (fallback for browsers without showDirectoryPicker)
  const handleFolderInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Build a file tree from the selected files
    const root: FileNode = {
      name: 'Selected Folder',
      path: '',
      type: 'folder',
      children: [],
    };

    // Group files by directory
    const dirMap = new Map<string, FileNode>();
    dirMap.set('', root);

    const filePromises: Promise<void>[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relativePath = file.webkitRelativePath || file.name;

      // Only process .testblocks.json or .json files
      if (!relativePath.endsWith('.testblocks.json') && !relativePath.endsWith('.json')) {
        continue;
      }

      const parts = relativePath.split('/');
      const fileName = parts.pop()!;

      // Create folder nodes as needed
      let currentPath = '';
      let parentNode = root;

      for (const part of parts) {
        const newPath = currentPath ? `${currentPath}/${part}` : part;

        if (!dirMap.has(newPath)) {
          const folderNode: FileNode = {
            name: part,
            path: newPath,
            type: 'folder',
            children: [],
          };
          parentNode.children!.push(folderNode);
          dirMap.set(newPath, folderNode);
        }

        parentNode = dirMap.get(newPath)!;
        currentPath = newPath;
      }

      // Read and parse the file
      const filePath = relativePath;
      const promise = file.text().then(content => {
        try {
          const testFile = JSON.parse(content) as TestFile;

          // Verify it's a valid test file
          if (testFile.version && testFile.tests && Array.isArray(testFile.tests)) {
            parentNode.children!.push({
              name: fileName,
              path: filePath,
              type: 'file',
              testFile,
            });
          }
        } catch (err) {
          console.warn(`Skipping invalid file: ${fileName}`, err);
        }
      });

      filePromises.push(promise);
    }

    Promise.all(filePromises).then(() => {
      // Sort children: folders first, then files
      const sortChildren = (node: FileNode) => {
        if (node.children) {
          node.children.sort((a, b) => {
            if (a.type !== b.type) {
              return a.type === 'folder' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
          });
          node.children.forEach(sortChildren);
        }
      };
      sortChildren(root);

      // Update root name from first part of path
      if (files[0]?.webkitRelativePath) {
        root.name = files[0].webkitRelativePath.split('/')[0];
      }

      setState(prev => ({
        ...prev,
        projectRoot: root,
        selectedFilePath: null,
        sidebarTab: 'files',
      }));
    });

    e.target.value = '';
  }, []);

  // Refresh the folder
  const handleRefreshFolder = useCallback(async () => {
    if (!dirHandleRef.current) return;

    try {
      const root = await scanDirectory(dirHandleRef.current);
      setState(prev => ({
        ...prev,
        projectRoot: root,
      }));
    } catch (e) {
      console.error('Failed to refresh folder:', e);
    }
  }, []);

  // Select a file from the tree
  const handleSelectFile = useCallback((node: FileNode) => {
    if (node.type !== 'file' || !node.testFile) return;

    // Load custom blocks from procedures
    if (node.testFile.procedures) {
      loadCustomBlocksFromProcedures(node.testFile.procedures);
    } else {
      clearCustomBlocks();
    }

    // Reset initial load flag to prevent auto-save on file load
    isInitialLoadRef.current = true;

    setState(prev => ({
      ...prev,
      selectedFilePath: node.path,
      testFile: node.testFile!,
      selectedTestIndex: 0,
      results: [],
      editorTab: 'test',
      sidebarTab: 'tests',
      editingFolderHooks: null, // Clear folder hooks editing mode
      folderHooks: { version: '1.0.0' },
    }));
  }, []);

  // Select a folder to configure hooks
  const handleSelectFolder = useCallback((node: FileNode) => {
    if (node.type !== 'folder') return;

    // Load folder hooks or create empty ones
    const hooks = node.folderHooks || { version: '1.0.0' };

    setState(prev => ({
      ...prev,
      editingFolderHooks: node,
      folderHooks: hooks,
      selectedFilePath: null, // Clear file selection
      editorTab: 'beforeAll', // Start with beforeAll tab
      sidebarTab: 'files', // Show files tab
    }));
  }, []);

  // Create a new test file in a folder
  const handleCreateFile = useCallback((parentNode: FileNode) => {
    if (!parentNode.folderHandle) {
      toast.error('Cannot create file: folder handle not available');
      return;
    }

    showPrompt(
      'Create Test File',
      [{ name: 'fileName', label: 'File name', defaultValue: 'new-test', placeholder: 'Enter file name', required: true }],
      async (values) => {
        const fileName = values.fileName;
        if (!fileName) return;

        // Ensure it has the right extension
        const finalName = fileName.endsWith('.testblocks.json')
          ? fileName
          : fileName.endsWith('.json')
            ? fileName.replace('.json', '.testblocks.json')
            : `${fileName}.testblocks.json`;

        try {
          // Create the new file
          const newFileHandle = await parentNode.folderHandle!.getFileHandle(finalName, { create: true });

          const newTestFile: TestFile = {
            version: '1.0.0',
            name: finalName.replace('.testblocks.json', ''),
            description: '',
            variables: {},
            tests: [{
              id: `test-${Date.now()}`,
              name: 'New Test',
              description: '',
              steps: [],
              tags: [],
            }],
          };

          const writable = await newFileHandle.createWritable();
          await writable.write(JSON.stringify(newTestFile, null, 2));
          await writable.close();

          // Add to tree and select
          const newFilePath = `${parentNode.path}/${finalName}`;
          const newFileNode: FileNode = {
            name: finalName,
            path: newFilePath,
            type: 'file',
            testFile: newTestFile,
            handle: newFileHandle,
          };

          setState(prev => {
            const cloneNode = (node: FileNode): FileNode => {
              const cloned: FileNode = { ...node };
              if (node.children) {
                cloned.children = node.children.map(cloneNode);
              }
              return cloned;
            };

            const newProjectRoot = prev.projectRoot ? cloneNode(prev.projectRoot) : null;

            if (newProjectRoot) {
              const addToFolder = (node: FileNode): boolean => {
                if (node.path === parentNode.path) {
                  if (!node.children) node.children = [];
                  node.children.push(newFileNode);
                  node.children.sort((a, b) => {
                    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
                    return a.name.localeCompare(b.name);
                  });
                  return true;
                }
                if (node.children) {
                  for (const child of node.children) {
                    if (addToFolder(child)) return true;
                  }
                }
                return false;
              };
              addToFolder(newProjectRoot);
            }

            return {
              ...prev,
              projectRoot: newProjectRoot,
              selectedFilePath: newFilePath,
              testFile: newTestFile,
              selectedTestIndex: 0,
              editorTab: 'test',
              editingFolderHooks: null,
            };
          });

          toast.success(`Created: ${finalName}`);
        } catch (error) {
          console.error('Failed to create file:', error);
          toast.error('Failed to create file');
        }
      }
    );
  }, [showPrompt]);

  // Create a new folder
  const handleCreateFolder = useCallback((parentNode: FileNode) => {
    if (!parentNode.folderHandle) {
      toast.error('Cannot create folder: folder handle not available');
      return;
    }

    showPrompt(
      'Create Folder',
      [{ name: 'folderName', label: 'Folder name', placeholder: 'Enter folder name', required: true }],
      async (values) => {
        const folderName = values.folderName;
        if (!folderName) return;

        try {
          // Create the new folder
          const newFolderHandle = await parentNode.folderHandle!.getDirectoryHandle(folderName, { create: true });

          const newFolderPath = `${parentNode.path}/${folderName}`;
          const newFolderNode: FileNode = {
            name: folderName,
            path: newFolderPath,
            type: 'folder',
            children: [],
            folderHandle: newFolderHandle,
          };

          setState(prev => {
            const cloneNode = (node: FileNode): FileNode => {
              const cloned: FileNode = { ...node };
              if (node.children) {
                cloned.children = node.children.map(cloneNode);
              }
              return cloned;
            };

            const newProjectRoot = prev.projectRoot ? cloneNode(prev.projectRoot) : null;

            if (newProjectRoot) {
              const addToFolder = (node: FileNode): boolean => {
                if (node.path === parentNode.path) {
                  if (!node.children) node.children = [];
                  node.children.push(newFolderNode);
                  node.children.sort((a, b) => {
                    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
                    return a.name.localeCompare(b.name);
                  });
                  return true;
                }
                if (node.children) {
                  for (const child of node.children) {
                    if (addToFolder(child)) return true;
                  }
                }
                return false;
              };
              addToFolder(newProjectRoot);
            }

            return {
              ...prev,
              projectRoot: newProjectRoot,
            };
          });

          toast.success(`Created folder: ${folderName}`);
        } catch (error) {
          console.error('Failed to create folder:', error);
          toast.error('Failed to create folder');
        }
      }
    );
  }, [showPrompt]);

  // Rename a file or folder
  const handleRename = useCallback((node: FileNode) => {
    const isFolder = node.type === 'folder';
    const currentName = isFolder ? node.name : node.name.replace('.testblocks.json', '');

    showPrompt(
      isFolder ? 'Rename Folder' : 'Rename File',
      [{ name: 'newName', label: 'New name', defaultValue: currentName, placeholder: 'Enter new name', required: true }],
      async (values) => {
        const newName = values.newName?.trim();
        if (!newName || newName === currentName) return;

        // Get parent path and handle
        const pathParts = node.path.split('/');
        pathParts.pop();
        const parentPath = pathParts.join('/');

        // Find parent node to get its handle
        const findParent = (root: FileNode | null, targetPath: string): FileNode | null => {
          if (!root) return null;
          if (root.path === targetPath) return root;
          if (root.children) {
            for (const child of root.children) {
              const found = findParent(child, targetPath);
              if (found) return found;
            }
          }
          return null;
        };

        const parentNode = findParent(state.projectRoot, parentPath);
        if (!parentNode?.folderHandle) {
          toast.error('Cannot rename: parent folder handle not available');
          return;
        }

        try {
          if (isFolder) {
            // For folders: create new folder, move contents recursively, delete old
            const newFolderHandle = await parentNode.folderHandle.getDirectoryHandle(newName, { create: true });

            // Helper to copy directory contents recursively
            const copyDir = async (srcHandle: FileSystemDirectoryHandle, destHandle: FileSystemDirectoryHandle) => {
              for await (const entry of (srcHandle as any).values()) {
                if (entry.kind === 'file') {
                  const file = await entry.getFile();
                  const newFileHandle = await destHandle.getFileHandle(entry.name, { create: true });
                  const writable = await newFileHandle.createWritable();
                  await writable.write(await file.arrayBuffer());
                  await writable.close();
                } else if (entry.kind === 'directory') {
                  const newSubDir = await destHandle.getDirectoryHandle(entry.name, { create: true });
                  await copyDir(entry, newSubDir);
                }
              }
            };

            if (node.folderHandle) {
              await copyDir(node.folderHandle, newFolderHandle);
            }

            // Delete old folder
            await parentNode.folderHandle.removeEntry(node.name, { recursive: true });

            // Update tree
            const newPath = `${parentPath}/${newName}`;
            setState(prev => {
              const updateTree = (root: FileNode): FileNode => {
                if (root.path === node.path) {
                  // Update this node and all its children paths
                  const updatePaths = (n: FileNode, oldBase: string, newBase: string): FileNode => {
                    const updated: FileNode = {
                      ...n,
                      path: n.path.replace(oldBase, newBase),
                      name: n.path === node.path ? newName : n.name,
                      folderHandle: n.path === node.path ? newFolderHandle : n.folderHandle,
                    };
                    if (n.children) {
                      updated.children = n.children.map(c => updatePaths(c, oldBase, newBase));
                    }
                    return updated;
                  };
                  return updatePaths(root, node.path, newPath);
                }
                if (root.children) {
                  return { ...root, children: root.children.map(updateTree) };
                }
                return root;
              };

              const newProjectRoot = prev.projectRoot ? updateTree(prev.projectRoot) : null;

              // Update selected path if it was inside the renamed folder
              let newSelectedPath = prev.selectedFilePath;
              if (prev.selectedFilePath?.startsWith(node.path + '/')) {
                newSelectedPath = prev.selectedFilePath.replace(node.path, newPath);
              } else if (prev.selectedFilePath === node.path) {
                newSelectedPath = newPath;
              }

              return { ...prev, projectRoot: newProjectRoot, selectedFilePath: newSelectedPath };
            });

            toast.success(`Renamed to: ${newName}`);
          } else {
            // For files: create new file, copy content, delete old
            const finalName = newName.endsWith('.testblocks.json')
              ? newName
              : `${newName}.testblocks.json`;

            if (!node.handle) {
              toast.error('Cannot rename: file handle not available');
              return;
            }

            // Read old file content
            const file = await node.handle.getFile();
            const content = await file.text();

            // Create new file
            const newFileHandle = await parentNode.folderHandle.getFileHandle(finalName, { create: true });
            const writable = await newFileHandle.createWritable();
            await writable.write(content);
            await writable.close();

            // Delete old file
            await parentNode.folderHandle.removeEntry(node.name);

            // Update tree
            const newPath = `${parentPath}/${finalName}`;
            setState(prev => {
              const updateTree = (root: FileNode): FileNode => {
                if (root.path === node.path) {
                  return {
                    ...root,
                    name: finalName,
                    path: newPath,
                    handle: newFileHandle,
                  };
                }
                if (root.children) {
                  return { ...root, children: root.children.map(updateTree) };
                }
                return root;
              };

              const newProjectRoot = prev.projectRoot ? updateTree(prev.projectRoot) : null;
              const newSelectedPath = prev.selectedFilePath === node.path ? newPath : prev.selectedFilePath;

              return { ...prev, projectRoot: newProjectRoot, selectedFilePath: newSelectedPath };
            });

            toast.success(`Renamed to: ${finalName}`);
          }
        } catch (error) {
          console.error('Failed to rename:', error);
          toast.error(`Failed to rename: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    );
  }, [showPrompt, state.projectRoot]);

  // Delete a file or folder
  const handleDelete = useCallback((node: FileNode) => {
    const isFolder = node.type === 'folder';
    const itemType = isFolder ? 'folder' : 'file';
    const displayName = isFolder ? node.name : node.name.replace('.testblocks.json', '');

    // Use confirm for deletion
    if (!confirm(`Are you sure you want to delete the ${itemType} "${displayName}"?${isFolder ? '\n\nThis will delete all files and subfolders inside it.' : ''}`)) {
      return;
    }

    // Get parent path and handle
    const pathParts = node.path.split('/');
    pathParts.pop();
    const parentPath = pathParts.join('/');

    // Find parent node to get its handle
    const findParent = (root: FileNode | null, targetPath: string): FileNode | null => {
      if (!root) return null;
      if (root.path === targetPath) return root;
      if (root.children) {
        for (const child of root.children) {
          const found = findParent(child, targetPath);
          if (found) return found;
        }
      }
      return null;
    };

    const parentNode = findParent(state.projectRoot, parentPath);
    if (!parentNode?.folderHandle) {
      toast.error('Cannot delete: parent folder handle not available');
      return;
    }

    (async () => {
      try {
        // Delete the entry (recursive for folders)
        await parentNode.folderHandle!.removeEntry(node.name, { recursive: isFolder });

        // Update tree - remove the deleted node
        setState(prev => {
          const removeFromTree = (root: FileNode): FileNode => {
            if (root.children) {
              return {
                ...root,
                children: root.children
                  .filter(child => child.path !== node.path)
                  .map(removeFromTree),
              };
            }
            return root;
          };

          const newProjectRoot = prev.projectRoot ? removeFromTree(prev.projectRoot) : null;

          // Clear selection if the deleted item or something inside it was selected
          let newSelectedPath = prev.selectedFilePath;
          let newSelectedTest = prev.selectedTestIndex;
          let newTestFile = prev.testFile;

          if (prev.selectedFilePath === node.path || prev.selectedFilePath?.startsWith(node.path + '/')) {
            newSelectedPath = null;
            newSelectedTest = 0;
            newTestFile = null;
          }

          return {
            ...prev,
            projectRoot: newProjectRoot,
            selectedFilePath: newSelectedPath,
            selectedTestIndex: newSelectedTest,
            testFile: newTestFile,
          };
        });

        toast.success(`Deleted: ${displayName}`);
      } catch (error) {
        console.error('Failed to delete:', error);
        toast.error(`Failed to delete: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    })();
  }, [state.projectRoot]);

  // Move a file or folder to a new location
  const handleMove = useCallback(async (sourceNode: FileNode, targetFolder: FileNode) => {
    const isFolder = sourceNode.type === 'folder';
    const itemType = isFolder ? 'folder' : 'file';

    // Get source parent path and handle
    const sourcePathParts = sourceNode.path.split('/');
    sourcePathParts.pop();
    const sourceParentPath = sourcePathParts.join('/');

    // Find source parent node
    const findNode = (root: FileNode | null, targetPath: string): FileNode | null => {
      if (!root) return null;
      if (root.path === targetPath) return root;
      if (root.children) {
        for (const child of root.children) {
          const found = findNode(child, targetPath);
          if (found) return found;
        }
      }
      return null;
    };

    const sourceParentNode = findNode(state.projectRoot, sourceParentPath);
    if (!sourceParentNode?.folderHandle) {
      toast.error('Cannot move: source parent folder handle not available');
      return;
    }

    if (!targetFolder.folderHandle) {
      toast.error('Cannot move: target folder handle not available');
      return;
    }

    try {
      if (isFolder) {
        // For folders: create new folder in target, copy contents recursively, delete old
        const newFolderHandle = await targetFolder.folderHandle.getDirectoryHandle(sourceNode.name, { create: true });

        // Helper to copy directory contents recursively
        const copyDir = async (srcHandle: FileSystemDirectoryHandle, destHandle: FileSystemDirectoryHandle) => {
          for await (const entry of (srcHandle as any).values()) {
            if (entry.kind === 'file') {
              const file = await entry.getFile();
              const newFileHandle = await destHandle.getFileHandle(entry.name, { create: true });
              const writable = await newFileHandle.createWritable();
              await writable.write(await file.arrayBuffer());
              await writable.close();
            } else if (entry.kind === 'directory') {
              const newSubDir = await destHandle.getDirectoryHandle(entry.name, { create: true });
              await copyDir(entry, newSubDir);
            }
          }
        };

        if (sourceNode.folderHandle) {
          await copyDir(sourceNode.folderHandle, newFolderHandle);
        }

        // Delete old folder
        await sourceParentNode.folderHandle.removeEntry(sourceNode.name, { recursive: true });

        // Update tree
        const newPath = `${targetFolder.path}/${sourceNode.name}`;
        setState(prev => {
          // Remove from old location
          const removeFromTree = (root: FileNode): FileNode => {
            if (root.children) {
              return {
                ...root,
                children: root.children
                  .filter(child => child.path !== sourceNode.path)
                  .map(removeFromTree),
              };
            }
            return root;
          };

          // Add to new location
          const addToTree = (root: FileNode): FileNode => {
            if (root.path === targetFolder.path) {
              // Update paths for the moved node and its children
              const updatePaths = (n: FileNode, oldBase: string, newBase: string): FileNode => {
                const updated: FileNode = {
                  ...n,
                  path: n.path.replace(oldBase, newBase),
                  folderHandle: n.path === sourceNode.path ? newFolderHandle : n.folderHandle,
                };
                if (n.children) {
                  updated.children = n.children.map(c => updatePaths(c, oldBase, newBase));
                }
                return updated;
              };

              const movedNode = updatePaths(sourceNode, sourceNode.path, newPath);
              return {
                ...root,
                children: [...(root.children || []), movedNode].sort((a, b) => {
                  // Sort folders before files, then alphabetically
                  if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
                  return a.name.localeCompare(b.name);
                }),
              };
            }
            if (root.children) {
              return { ...root, children: root.children.map(addToTree) };
            }
            return root;
          };

          let newProjectRoot = prev.projectRoot ? removeFromTree(prev.projectRoot) : null;
          newProjectRoot = newProjectRoot ? addToTree(newProjectRoot) : null;

          // Update selected path if it was inside the moved folder
          let newSelectedPath = prev.selectedFilePath;
          if (prev.selectedFilePath?.startsWith(sourceNode.path + '/')) {
            newSelectedPath = prev.selectedFilePath.replace(sourceNode.path, newPath);
          } else if (prev.selectedFilePath === sourceNode.path) {
            newSelectedPath = newPath;
          }

          return { ...prev, projectRoot: newProjectRoot, selectedFilePath: newSelectedPath };
        });

        toast.success(`Moved ${sourceNode.name} to ${targetFolder.name}`);
      } else {
        // For files: create new file in target, copy content, delete old
        if (!sourceNode.handle) {
          toast.error('Cannot move: file handle not available');
          return;
        }

        // Read old file content
        const file = await sourceNode.handle.getFile();
        const content = await file.text();

        // Create new file in target
        const newFileHandle = await targetFolder.folderHandle.getFileHandle(sourceNode.name, { create: true });
        const writable = await newFileHandle.createWritable();
        await writable.write(content);
        await writable.close();

        // Delete old file
        await sourceParentNode.folderHandle.removeEntry(sourceNode.name);

        // Update tree
        const newPath = `${targetFolder.path}/${sourceNode.name}`;
        setState(prev => {
          // Remove from old location
          const removeFromTree = (root: FileNode): FileNode => {
            if (root.children) {
              return {
                ...root,
                children: root.children
                  .filter(child => child.path !== sourceNode.path)
                  .map(removeFromTree),
              };
            }
            return root;
          };

          // Add to new location
          const addToTree = (root: FileNode): FileNode => {
            if (root.path === targetFolder.path) {
              const movedNode: FileNode = {
                ...sourceNode,
                path: newPath,
                handle: newFileHandle,
              };
              return {
                ...root,
                children: [...(root.children || []), movedNode].sort((a, b) => {
                  // Sort folders before files, then alphabetically
                  if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
                  return a.name.localeCompare(b.name);
                }),
              };
            }
            if (root.children) {
              return { ...root, children: root.children.map(addToTree) };
            }
            return root;
          };

          let newProjectRoot = prev.projectRoot ? removeFromTree(prev.projectRoot) : null;
          newProjectRoot = newProjectRoot ? addToTree(newProjectRoot) : null;

          // Update selected path if it was the moved file
          const newSelectedPath = prev.selectedFilePath === sourceNode.path ? newPath : prev.selectedFilePath;

          return { ...prev, projectRoot: newProjectRoot, selectedFilePath: newSelectedPath };
        });

        toast.success(`Moved ${sourceNode.name} to ${targetFolder.name}`);
      }
    } catch (error) {
      console.error('Failed to move:', error);
      toast.error(`Failed to move: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [state.projectRoot]);

  // Handle workspace changes for test steps
  const handleWorkspaceChange = useCallback((steps: unknown[], testName?: string, testData?: Array<{ name?: string; values: Record<string, unknown> }>, softAssertions?: boolean) => {
    setState(prev => {
      // If editing folder hooks, update folder hooks state
      if (prev.editingFolderHooks) {
        const hookType = prev.editorTab as 'beforeAll' | 'afterAll' | 'beforeEach' | 'afterEach';
        if (hookType === 'test') return prev; // Should not happen but safety check

        return {
          ...prev,
          folderHooks: {
            ...prev.folderHooks,
            [hookType]: steps.length > 0 ? steps as TestStep[] : undefined,
          },
        };
      }

      // If we're on a lifecycle tab, update that instead
      if (prev.editorTab !== 'test') {
        return {
          ...prev,
          testFile: {
            ...prev.testFile,
            [prev.editorTab]: steps as TestStep[],
          },
        };
      }

      // Otherwise update the current test
      const newTests = [...prev.testFile.tests];
      newTests[prev.selectedTestIndex] = {
        ...newTests[prev.selectedTestIndex],
        steps: steps as TestCase['steps'],
        ...(testName && { name: testName }),
        // Update data if provided, or remove it if empty/undefined
        ...(testData !== undefined && { data: testData.length > 0 ? testData : undefined }),
        // Update soft assertions if provided
        ...(softAssertions !== undefined && { softAssertions }),
      };
      return {
        ...prev,
        testFile: {
          ...prev.testFile,
          tests: newTests,
        },
      };
    });
  }, []);

  // Handle replacing matches across project files when creating a custom block
  const handleReplaceMatches = useCallback(async (result: CreateBlockResult, blockType: string) => {
    const { selectedMatches, config } = result;
    // Note: We process even if selectedMatches is empty to save the procedure to the current file

    console.log('[handleReplaceMatches] Processing', selectedMatches.length, 'matches for blockType:', blockType);

    // Convert the custom block config to a procedure definition
    const procedureDef: ProcedureDefinition = {
      name: config.name,
      description: config.description,
      params: config.parameters.map(p => ({
        name: p.name,
        type: p.fieldType === 'number' ? 'number' as const : 'string' as const,
        default: p.defaultValue,
        description: `From ${p.blockType}.${p.originalFieldName}`,
      })),
      steps: config.steps,
    };

    // Use functional update to get latest state
    setState(prev => {
      if (!prev.projectRoot) {
        console.log('[handleReplaceMatches] No projectRoot, skipping');
        return prev;
      }

      // Group matches by file path
      const matchesByFile = new Map<string, BlockMatch[]>();
      for (const match of selectedMatches) {
        const existing = matchesByFile.get(match.filePath) || [];
        existing.push(match);
        matchesByFile.set(match.filePath, existing);
      }

      console.log('[handleReplaceMatches] Grouped into', matchesByFile.size, 'files');

      // Deep clone the project root to avoid mutation
      const cloneNode = (node: FileNode): FileNode => {
        const cloned: FileNode = { ...node };
        if (node.testFile) {
          cloned.testFile = JSON.parse(JSON.stringify(node.testFile));
        }
        if (node.children) {
          cloned.children = node.children.map(cloneNode);
        }
        // Keep the original handle reference
        cloned.handle = node.handle;
        return cloned;
      };

      const newProjectRoot = cloneNode(prev.projectRoot);

      // Track the updated testFile for the currently selected file
      let updatedCurrentTestFile: TestFile | null = null;

      // Find and update files in the cloned tree
      const findAndUpdateFile = (node: FileNode, filePath: string, matches: BlockMatch[]): FileNode | null => {
        if (node.type === 'file' && node.path === filePath && node.testFile) {
          console.log('[handleReplaceMatches] Updating file:', filePath, 'with', matches.length, 'matches');

          // Group matches by location+testCaseId to properly sort within each context
          const matchesByContext = new Map<string, BlockMatch[]>();
          for (const match of matches) {
            const contextKey = `${match.location}:${match.testCaseId}`;
            const existing = matchesByContext.get(contextKey) || [];
            existing.push(match);
            matchesByContext.set(contextKey, existing);
          }

          // Sort matches within each context by startIndex descending, then flatten
          const sortedMatches: BlockMatch[] = [];
          for (const contextMatches of matchesByContext.values()) {
            contextMatches.sort((a, b) => b.startIndex - a.startIndex);
            sortedMatches.push(...contextMatches);
          }

          console.log('[handleReplaceMatches] Sorted matches:', sortedMatches.map(m =>
            `${m.testCaseId}:${m.location}:${m.startIndex}-${m.endIndex}`
          ));

          let updatedFile = node.testFile;
          for (const match of sortedMatches) {
            console.log('[handleReplaceMatches] Applying match:', match.testCaseId, match.location, match.startIndex, '-', match.endIndex);
            updatedFile = applyMatchToTestFile(updatedFile, match, blockType, {});
          }

          // Add the procedure definition to this file so it can load the custom block
          updatedFile = {
            ...updatedFile,
            procedures: {
              ...updatedFile.procedures,
              [config.name]: procedureDef,
            },
          };
          console.log('[handleReplaceMatches] Added procedure to file:', config.name);

          node.testFile = updatedFile;

          // If this is the currently selected file, track the update
          if (filePath === prev.selectedFilePath) {
            console.log('[handleReplaceMatches] This is the current file, updating testFile state');
            updatedCurrentTestFile = updatedFile;
          }

          // Save the file if we have a file handle (async, fire and forget)
          if (node.handle) {
            const fileHandle = node.handle;
            const fileToSave = updatedFile;
            (async () => {
              try {
                const writable = await fileHandle.createWritable();
                await writable.write(JSON.stringify(fileToSave, null, 2));
                await writable.close();
                console.log('[handleReplaceMatches] Saved file:', filePath);
              } catch (error) {
                console.error('[handleReplaceMatches] Failed to save file', filePath, ':', error);
              }
            })();
          } else {
            console.log('[handleReplaceMatches] No file handle for:', filePath, '- file will not be saved to disk');
          }

          return node;
        }

        if (node.children) {
          for (const child of node.children) {
            const found = findAndUpdateFile(child, filePath, matches);
            if (found) return found;
          }
        }

        return null;
      };

      // Process each file with matches
      for (const [filePath, matches] of matchesByFile) {
        const found = findAndUpdateFile(newProjectRoot, filePath, matches);
        if (!found) {
          console.warn('[handleReplaceMatches] Could not find file in tree:', filePath);
        }
      }

      // Also update the current file with the procedure
      // This ensures the procedure is available when the file is reopened
      // We need to merge: workspace changes (for current test) + match replacements (for other tests)
      if (prev.selectedFilePath) {
        console.log('[handleReplaceMatches] Updating current file:', prev.selectedFilePath);

        // Find the current file node
        const findCurrentFileNode = (node: FileNode): FileNode | null => {
          if (node.type === 'file' && node.path === prev.selectedFilePath) {
            return node;
          }
          if (node.children) {
            for (const child of node.children) {
              const found = findCurrentFileNode(child);
              if (found) return found;
            }
          }
          return null;
        };

        const currentFileNode = findCurrentFileNode(newProjectRoot);
        if (currentFileNode && currentFileNode.testFile) {
          // Start with prev.testFile which has the workspace update (current test has custom block)
          // Then merge in match replacements from currentFileNode.testFile for OTHER tests
          const currentTest = prev.testFile.tests[prev.selectedTestIndex];

          // Build merged tests: use match-replaced tests, but keep current test from workspace
          const mergedTests = currentFileNode.testFile.tests.map((test, index) => {
            if (index === prev.selectedTestIndex) {
              // Use the workspace version for the current test
              return currentTest;
            }
            // Use the match-replaced version for other tests
            return test;
          });

          const currentFileToSave: TestFile = {
            ...currentFileNode.testFile,
            tests: mergedTests,
            // Keep lifecycle hooks from match replacements (they might have been replaced)
            // unless we're on a lifecycle tab
            ...(prev.editorTab !== 'test' && prev.editorTab !== 'beforeAll' && {
              beforeAll: prev.testFile.beforeAll,
            }),
            ...(prev.editorTab !== 'test' && prev.editorTab !== 'afterAll' && {
              afterAll: prev.testFile.afterAll,
            }),
            ...(prev.editorTab !== 'test' && prev.editorTab !== 'beforeEach' && {
              beforeEach: prev.testFile.beforeEach,
            }),
            ...(prev.editorTab !== 'test' && prev.editorTab !== 'afterEach' && {
              afterEach: prev.testFile.afterEach,
            }),
            // Add the procedure
            procedures: {
              ...currentFileNode.testFile.procedures,
              [config.name]: procedureDef,
            },
          };

          // If editing a lifecycle hook, use the workspace version
          if (prev.editorTab === 'beforeAll') {
            currentFileToSave.beforeAll = prev.testFile.beforeAll;
          } else if (prev.editorTab === 'afterAll') {
            currentFileToSave.afterAll = prev.testFile.afterAll;
          } else if (prev.editorTab === 'beforeEach') {
            currentFileToSave.beforeEach = prev.testFile.beforeEach;
          } else if (prev.editorTab === 'afterEach') {
            currentFileToSave.afterEach = prev.testFile.afterEach;
          }

          // Update the node's testFile
          currentFileNode.testFile = currentFileToSave;
          updatedCurrentTestFile = currentFileToSave;

          // Save the current file
          if (currentFileNode.handle) {
            const fileHandle = currentFileNode.handle;
            (async () => {
              try {
                const writable = await fileHandle.createWritable();
                await writable.write(JSON.stringify(currentFileToSave, null, 2));
                await writable.close();
                console.log('[handleReplaceMatches] Saved current file:', prev.selectedFilePath);
              } catch (error) {
                console.error('[handleReplaceMatches] Failed to save current file:', error);
              }
            })();
          } else {
            console.log('[handleReplaceMatches] No file handle for current file - will not auto-save');
          }
        }
      }

      // Return updated state, including the current testFile if it was modified
      return {
        ...prev,
        projectRoot: newProjectRoot,
        ...(updatedCurrentTestFile && { testFile: updatedCurrentTestFile }),
      };
    });
  }, []);

  // Get the current steps based on the selected tab
  const getCurrentSteps = useCallback(() => {
    // If editing folder hooks
    if (state.editingFolderHooks) {
      const hookType = state.editorTab as 'beforeAll' | 'afterAll' | 'beforeEach' | 'afterEach';
      return (state.folderHooks[hookType] || []) as unknown[];
    }

    if (state.editorTab === 'test') {
      return selectedTest?.steps as unknown[];
    }
    return (state.testFile[state.editorTab] || []) as unknown[];
  }, [state.editorTab, state.testFile, state.editingFolderHooks, state.folderHooks, selectedTest]);

  // Get the name for the current editor tab
  const getEditorTitle = useCallback(() => {
    const prefix = state.editingFolderHooks ? 'Folder ' : '';
    switch (state.editorTab) {
      case 'beforeAll': return `${prefix}Before All`;
      case 'afterAll': return `${prefix}After All`;
      case 'beforeEach': return `${prefix}Before Each`;
      case 'afterEach': return `${prefix}After Each`;
      default: return selectedTest?.name || 'Test';
    }
  }, [state.editorTab, state.editingFolderHooks, selectedTest]);

  // Save test file
  const handleSave = useCallback(async () => {
    const svgElement = document.querySelector('.blocklySvg') as unknown as { workspace?: Blockly.WorkspaceSvg };
    const workspace = svgElement?.workspace;

    // Get custom blocks as procedures
    const customProcedures = exportCustomBlocksAsProcedures();

    const testFileToSave: TestFile = {
      ...state.testFile,
      procedures: {
        ...state.testFile.procedures,
        ...customProcedures,
      },
      tests: state.testFile.tests.map((test, index) => {
        if (index === state.selectedTestIndex && workspace) {
          const steps = workspaceToTestSteps(workspace);
          return {
            ...test,
            steps: steps as TestCase['steps'],
          };
        }
        return test;
      }),
    };

    // If we have a file handle, save directly
    const selectedNode = findNodeByPath(state.projectRoot, state.selectedFilePath);
    if (selectedNode?.handle) {
      try {
        const writable = await (selectedNode.handle as FileSystemFileHandle).createWritable();
        await writable.write(JSON.stringify(testFileToSave, null, 2));
        await writable.close();

        // Update the node in the tree
        selectedNode.testFile = testFileToSave;
        setState(prev => ({ ...prev, testFile: testFileToSave }));
        return;
      } catch (e) {
        console.error('Failed to save file:', e);
      }
    }

    // Fallback: download the file
    const blob = new Blob([JSON.stringify(testFileToSave, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.testFile.name.toLowerCase().replace(/\s+/g, '-')}.testblocks.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state.testFile, state.selectedTestIndex, state.projectRoot, state.selectedFilePath]);

  // Load test file (single file fallback)
  const handleLoad = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const testFile = JSON.parse(event.target?.result as string) as TestFile;
        if (!testFile.variables) {
          testFile.variables = {};
        }

        if (testFile.procedures) {
          loadCustomBlocksFromProcedures(testFile.procedures);
        } else {
          clearCustomBlocks();
        }

        setState(prev => ({
          ...prev,
          testFile,
          selectedTestIndex: 0,
          selectedFilePath: null,
          results: [],
          sidebarTab: 'tests',
        }));
      } catch (err) {
        toast.error('Failed to load test file: ' + (err as Error).message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  // Add new test
  const handleAddTest = useCallback(() => {
    const newTest: TestCase = {
      id: `test-${Date.now()}`,
      name: `Test Case ${state.testFile.tests.length + 1}`,
      description: '',
      steps: [],
      tags: [],
    };

    setState(prev => ({
      ...prev,
      testFile: {
        ...prev.testFile,
        tests: [...prev.testFile.tests, newTest],
      },
      selectedTestIndex: prev.testFile.tests.length,
    }));
  }, [state.testFile.tests.length]);

  // Delete test
  const handleDeleteTest = useCallback((index: number) => {
    if (state.testFile.tests.length <= 1) {
      toast.warning('Cannot delete the last test case');
      return;
    }

    setState(prev => {
      const newTests = prev.testFile.tests.filter((_, i) => i !== index);
      return {
        ...prev,
        testFile: {
          ...prev.testFile,
          tests: newTests,
        },
        selectedTestIndex: Math.min(prev.selectedTestIndex, newTests.length - 1),
      };
    });
  }, [state.testFile.tests.length]);

  // Toggle test disabled state
  const handleToggleTestDisabled = useCallback((index: number) => {
    setState(prev => {
      const newTests = [...prev.testFile.tests];
      newTests[index] = {
        ...newTests[index],
        disabled: !newTests[index].disabled,
      };
      return {
        ...prev,
        testFile: {
          ...prev.testFile,
          tests: newTests,
        },
      };
    });
  }, []);

  // Run all tests
  const handleRunAll = useCallback(async () => {
    setState(prev => ({ ...prev, isRunning: true, runningTestId: null, results: [] }));

    try {
      // Collect folder hooks from the hierarchy
      const folderHooks = collectFolderHooks(state.projectRoot, state.selectedFilePath);

      const response = await fetch(`/api/run?headless=${state.headless}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testFile: state.testFile,
          folderHooks: folderHooks.length > 0 ? folderHooks : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !Array.isArray(data)) {
        const errorMsg = data.message || data.error || 'Unknown error';
        console.error('Test run failed:', errorMsg);
        setState(prev => ({ ...prev, isRunning: false }));
        toast.error(`Test run failed: ${errorMsg}`);
        return;
      }

      // Update failedFiles and failedTestsMap based on results
      const hasFailed = data.some((r: TestResult) => r.status !== 'passed');
      const newFailedTests = new Set<string>();
      data.forEach((r: TestResult) => {
        if (r.status !== 'passed') {
          newFailedTests.add(r.testId);
        }
      });
      setState(prev => {
        const newFailedFiles = new Set(prev.failedFiles);
        const newFailedTestsMap = new Map(prev.failedTestsMap);
        if (prev.selectedFilePath) {
          if (hasFailed) {
            newFailedFiles.add(prev.selectedFilePath);
            newFailedTestsMap.set(prev.selectedFilePath, newFailedTests);
          } else {
            newFailedFiles.delete(prev.selectedFilePath);
            newFailedTestsMap.delete(prev.selectedFilePath);
          }
        }
        return { ...prev, results: data, isRunning: false, failedFiles: newFailedFiles, failedTestsMap: newFailedTestsMap };
      });
    } catch (err) {
      console.error('Failed to run tests:', err);
      setState(prev => ({ ...prev, isRunning: false }));
      toast.error('Failed to run tests. Make sure the server is running.');
    }
  }, [state.testFile, state.headless, state.projectRoot, state.selectedFilePath]);

  // Run single test
  const handleRunTest = useCallback(async (testId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }

    setState(prev => ({ ...prev, isRunning: true, runningTestId: testId, results: [] }));

    try {
      // Collect folder hooks from the hierarchy
      const folderHooks = collectFolderHooks(state.projectRoot, state.selectedFilePath);

      const response = await fetch(`/api/run?headless=${state.headless}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testFile: {
            ...state.testFile,
            tests: state.testFile.tests.filter(t => t.id === testId),
          },
          folderHooks: folderHooks.length > 0 ? folderHooks : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !Array.isArray(data)) {
        const errorMsg = data.message || data.error || 'Unknown error';
        console.error('Test run failed:', errorMsg);
        setState(prev => ({ ...prev, isRunning: false, runningTestId: null }));
        toast.error(`Test run failed: ${errorMsg}`);
        return;
      }

      // Update failedFiles and failedTestsMap based on results
      setState(prev => {
        const newFailedFiles = new Set(prev.failedFiles);
        const newFailedTestsMap = new Map(prev.failedTestsMap);
        if (prev.selectedFilePath) {
          const currentFailedTests = new Set(newFailedTestsMap.get(prev.selectedFilePath) || []);
          // Update failed tests - add or remove based on this run's result
          data.forEach((r: TestResult) => {
            if (r.status !== 'passed') {
              currentFailedTests.add(r.testId);
            } else {
              currentFailedTests.delete(r.testId);
            }
          });
          // Update the map and files
          if (currentFailedTests.size > 0) {
            newFailedTestsMap.set(prev.selectedFilePath, currentFailedTests);
            newFailedFiles.add(prev.selectedFilePath);
          } else {
            newFailedTestsMap.delete(prev.selectedFilePath);
            newFailedFiles.delete(prev.selectedFilePath);
          }
        }
        return { ...prev, results: data, isRunning: false, runningTestId: null, failedFiles: newFailedFiles, failedTestsMap: newFailedTestsMap };
      });
    } catch (err) {
      console.error('Failed to run test:', err);
      setState(prev => ({ ...prev, isRunning: false, runningTestId: null }));
      toast.error('Failed to run test. Make sure the server is running.');
    }
  }, [state.testFile, state.headless, state.projectRoot, state.selectedFilePath]);

  // Run all tests in a folder (and subfolders)
  const handleRunFolder = useCallback(async (folderNode: FileNode) => {
    // Collect all test files from the folder recursively
    const collectTestFiles = (node: FileNode): FileNode[] => {
      const files: FileNode[] = [];
      if (node.type === 'file' && node.testFile) {
        files.push(node);
      }
      if (node.children) {
        for (const child of node.children) {
          files.push(...collectTestFiles(child));
        }
      }
      return files;
    };

    const testFiles = collectTestFiles(folderNode);

    if (testFiles.length === 0) {
      toast.warning('No test files found in this folder');
      return;
    }

    setState(prev => ({ ...prev, isRunning: true, runningTestId: null, results: [] }));
    toast.info(`Running ${testFiles.length} test file(s)...`);

    const allResults: TestResult[] = [];
    const fileResults: Map<string, boolean> = new Map(); // path -> hasFailed
    const fileFailedTests: Map<string, Set<string>> = new Map(); // path -> set of failed test IDs
    let filesRun = 0;

    try {
      for (const fileNode of testFiles) {
        if (!fileNode.testFile) continue;

        filesRun++;
        toast.info(`Running ${fileNode.name} (${filesRun}/${testFiles.length})...`);

        // Collect folder hooks from the hierarchy for this file
        const folderHooks = collectFolderHooks(state.projectRoot, fileNode.path);

        const response = await fetch(`/api/run?headless=${state.headless}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            testFile: fileNode.testFile,
            folderHooks: folderHooks.length > 0 ? folderHooks : undefined,
          }),
        });

        const data = await response.json();

        if (response.ok && Array.isArray(data)) {
          // Add file name to each result for identification
          const resultsWithFile = data.map((result: TestResult) => ({
            ...result,
            fileName: fileNode.name.replace('.testblocks.json', ''),
          }));
          allResults.push(...resultsWithFile);
          // Track which tests failed in this file
          const failedTestIds = new Set<string>();
          data.forEach((r: TestResult) => {
            if (r.status !== 'passed') {
              failedTestIds.add(r.testId);
            }
          });
          const hasFailed = failedTestIds.size > 0;
          fileResults.set(fileNode.path, hasFailed);
          if (hasFailed) {
            fileFailedTests.set(fileNode.path, failedTestIds);
          }
        } else {
          // Add error result for this file
          allResults.push({
            testId: `file-error-${fileNode.path}`,
            testName: `${fileNode.name} (Error)`,
            status: 'error',
            duration: 0,
            steps: [],
            error: {
              message: data.message || data.error || 'Unknown error',
            },
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
            fileName: fileNode.name.replace('.testblocks.json', ''),
          } as TestResult);
          fileResults.set(fileNode.path, true); // Error = failed
        }

        // Update results incrementally
        setState(prev => ({ ...prev, results: [...allResults] }));
      }

      // Count passed/failed
      const passed = allResults.filter(r => r.status === 'passed').length;
      const failed = allResults.filter(r => r.status === 'failed' || r.status === 'error').length;

      if (failed > 0) {
        toast.error(`Completed: ${passed} passed, ${failed} failed`);
      } else {
        toast.success(`All ${passed} tests passed!`);
      }

      // Update failedFiles and failedTestsMap based on all file results
      setState(prev => {
        const newFailedFiles = new Set(prev.failedFiles);
        const newFailedTestsMap = new Map(prev.failedTestsMap);
        for (const [filePath, hasFailed] of fileResults) {
          if (hasFailed) {
            newFailedFiles.add(filePath);
            const failedTests = fileFailedTests.get(filePath);
            if (failedTests) {
              newFailedTestsMap.set(filePath, failedTests);
            }
          } else {
            newFailedFiles.delete(filePath);
            newFailedTestsMap.delete(filePath);
          }
        }
        return { ...prev, isRunning: false, failedFiles: newFailedFiles, failedTestsMap: newFailedTestsMap };
      });
    } catch (err) {
      console.error('Failed to run folder tests:', err);
      setState(prev => ({ ...prev, isRunning: false, results: allResults }));
      toast.error('Failed to run tests. Make sure the server is running.');
    }
  }, [state.headless, state.projectRoot]);

  // Update test name
  const handleTestNameChange = useCallback((name: string) => {
    setState(prev => {
      const newTests = [...prev.testFile.tests];
      newTests[prev.selectedTestIndex] = {
        ...newTests[prev.selectedTestIndex],
        name,
      };
      return {
        ...prev,
        testFile: {
          ...prev.testFile,
          tests: newTests,
        },
      };
    });
  }, []);

  // Update file name (kept for potential future use)
  const _handleFileNameChange = useCallback((name: string) => {
    setState(prev => ({
      ...prev,
      testFile: {
        ...prev.testFile,
        name,
      },
    }));
  }, []);

  // Add variable
  const handleAddVariable = useCallback(() => {
    showPrompt(
      'Add Variable',
      [
        { name: 'name', label: 'Variable name', placeholder: 'Enter variable name', required: true },
        { name: 'defaultValue', label: 'Default value', placeholder: 'Enter default value' },
      ],
      (values) => {
        const name = values.name;
        if (!name) return;

        setState(prev => ({
          ...prev,
          testFile: {
            ...prev.testFile,
            variables: {
              ...prev.testFile.variables,
              [name]: {
                type: 'string',
                default: values.defaultValue || '',
              },
            },
          },
        }));
      }
    );
  }, [showPrompt]);

  // Update variable
  const handleUpdateVariable = useCallback((name: string, value: string) => {
    setState(prev => ({
      ...prev,
      testFile: {
        ...prev.testFile,
        variables: {
          ...prev.testFile.variables,
          [name]: {
            ...prev.testFile.variables?.[name],
            type: 'string',
            default: value,
          },
        },
      },
    }));
  }, []);

  // Delete variable
  const handleDeleteVariable = useCallback((name: string) => {
    setState(prev => {
      const newVars = { ...prev.testFile.variables };
      delete newVars[name];
      return {
        ...prev,
        testFile: {
          ...prev.testFile,
          variables: newVars,
        },
      };
    });
  }, []);

  // Update global variable (supports nested paths like "credentials.validUser.email")
  const handleUpdateGlobalVariable = useCallback((path: string, value: string) => {
    setState(prev => {
      if (!prev.globalVariables) return prev;

      // Update the nested value
      const newGlobalVariables = setNestedValue(prev.globalVariables, path, value);

      // Update the full file content
      const newGlobalsFileContent: GlobalsFile = {
        ...prev.globalsFileContent,
        variables: newGlobalVariables,
      };

      // Save to file asynchronously
      if (globalsHandleRef.current) {
        (async () => {
          try {
            const writable = await globalsHandleRef.current!.createWritable();
            await writable.write(JSON.stringify(newGlobalsFileContent, null, 2));
            await writable.close();
            console.log('[handleUpdateGlobalVariable] Saved globals.json');
          } catch (error) {
            console.error('[handleUpdateGlobalVariable] Failed to save globals.json:', error);
          }
        })();
      }

      return {
        ...prev,
        globalVariables: newGlobalVariables,
        globalsFileContent: newGlobalsFileContent,
      };
    });
  }, []);

  // Handle updating all global variables at once (from VariablesEditor)
  const handleGlobalVariablesChange = useCallback((variables: Array<{ name: string; value: string }>) => {
    const newVars = variablesToRecord(variables);

    setState(prev => {
      const newGlobalsFileContent: GlobalsFile = {
        ...prev.globalsFileContent,
        variables: newVars,
      };

      // Save to file asynchronously
      if (globalsHandleRef.current) {
        (async () => {
          try {
            const writable = await globalsHandleRef.current!.createWritable();
            await writable.write(JSON.stringify(newGlobalsFileContent, null, 2));
            await writable.close();
            console.log('[handleGlobalVariablesChange] Saved globals.json');
          } catch (error) {
            console.error('[handleGlobalVariablesChange] Failed to save globals.json:', error);
          }
        })();
      }

      return {
        ...prev,
        globalVariables: newVars,
        globalsFileContent: newGlobalsFileContent,
      };
    });
  }, []);

  // Handle updating all file variables at once (from VariablesEditor)
  const handleFileVariablesChange = useCallback((variables: Array<{ name: string; value: string }>) => {
    setState(prev => {
      // Convert to the expected format with 'default' wrapper
      const newVars: Record<string, VariableDefinition> = {};
      for (const v of variables) {
        if (v.name.trim()) {
          // Try to parse as JSON for complex values
          let parsedValue: unknown = v.value;
          try {
            if (v.value.startsWith('{') || v.value.startsWith('[') || v.value === 'true' || v.value === 'false' || (!isNaN(Number(v.value)) && v.value !== '')) {
              parsedValue = JSON.parse(v.value);
            }
          } catch {
            // Keep as string
          }
          newVars[v.name] = { default: parsedValue };
        }
      }

      return {
        ...prev,
        testFile: {
          ...prev.testFile,
          variables: newVars,
        },
      };
    });
  }, []);

  // Handle recorded steps from RecordDialog
  const handleStepsRecorded = useCallback((steps: TestStep[], mode: 'append' | 'new') => {
    if (mode === 'append') {
      // Add steps to current test
      setState(prev => {
        const newTests = [...prev.testFile.tests];
        const currentSteps = Array.isArray(newTests[prev.selectedTestIndex].steps)
          ? newTests[prev.selectedTestIndex].steps
          : [];
        newTests[prev.selectedTestIndex] = {
          ...newTests[prev.selectedTestIndex],
          steps: [...currentSteps, ...steps],
        };
        const updatedTestFile = { ...prev.testFile, tests: newTests };

        // Auto-save to project folder if file is open
        const selectedNode = findNodeByPath(prev.projectRoot, prev.selectedFilePath);
        if (selectedNode?.handle) {
          (async () => {
            try {
              const writable = await (selectedNode.handle as FileSystemFileHandle).createWritable();
              await writable.write(JSON.stringify(updatedTestFile, null, 2));
              await writable.close();
              console.log('[handleStepsRecorded] Saved recorded steps to:', prev.selectedFilePath);
            } catch (error) {
              console.error('[handleStepsRecorded] Failed to save:', error);
            }
          })();
        }

        return {
          ...prev,
          testFile: updatedTestFile,
          showRecordDialog: false,
        };
      });
    } else {
      // Create new test file with recorded steps
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const newFileName = `recorded-${timestamp}.testblocks.json`;

      const newTest: TestCase = {
        id: `test-${Date.now()}`,
        name: 'Recorded Test',
        description: 'Test recorded from browser actions',
        steps,
        tags: ['recorded'],
      };

      const newTestFile: TestFile = {
        version: '1.0.0',
        name: 'Recorded Test Suite',
        description: `Recorded on ${new Date().toLocaleString()}`,
        variables: {},
        tests: [newTest],
      };

      setState(prev => {
        // Find the directory to save in
        let targetDirHandle: FileSystemDirectoryHandle | null = null;
        let targetDirPath = '';

        // Try to find the parent folder of the currently selected file
        if (prev.selectedFilePath && prev.projectRoot) {
          const pathParts = prev.selectedFilePath.split('/');
          pathParts.pop(); // Remove filename
          const parentPath = pathParts.join('/');

          if (parentPath) {
            const parentNode = findNodeByPath(prev.projectRoot, parentPath);
            if (parentNode?.folderHandle) {
              targetDirHandle = parentNode.folderHandle;
              targetDirPath = parentPath;
            }
          }
        }

        // Fall back to project root
        if (!targetDirHandle && prev.projectRoot?.folderHandle) {
          targetDirHandle = prev.projectRoot.folderHandle;
          targetDirPath = prev.projectRoot.path;
        }

        // If we have a directory, create the new file
        if (targetDirHandle) {
          (async () => {
            try {
              // Create the new file
              const newFileHandle = await targetDirHandle!.getFileHandle(newFileName, { create: true });
              const writable = await newFileHandle.createWritable();
              await writable.write(JSON.stringify(newTestFile, null, 2));
              await writable.close();

              console.log('[handleStepsRecorded] Created new file:', newFileName);

              // Add the new file to the tree and select it
              const newFilePath = targetDirPath ? `${targetDirPath}/${newFileName}` : newFileName;
              const newFileNode: FileNode = {
                name: newFileName,
                path: newFilePath,
                type: 'file',
                testFile: newTestFile,
                handle: newFileHandle,
              };

              // Clone the project root and add the new file
              const cloneNode = (node: FileNode): FileNode => {
                const cloned: FileNode = { ...node };
                if (node.children) {
                  cloned.children = node.children.map(cloneNode);
                }
                return cloned;
              };

              const newProjectRoot = prev.projectRoot ? cloneNode(prev.projectRoot) : null;

              if (newProjectRoot) {
                // Find the target folder and add the new file
                const addFileToFolder = (node: FileNode): boolean => {
                  if (node.path === targetDirPath || (node.path === node.name && targetDirPath === node.name)) {
                    if (!node.children) node.children = [];
                    node.children.push(newFileNode);
                    // Sort children: folders first, then files alphabetically
                    node.children.sort((a, b) => {
                      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
                      return a.name.localeCompare(b.name);
                    });
                    return true;
                  }
                  if (node.children) {
                    for (const child of node.children) {
                      if (addFileToFolder(child)) return true;
                    }
                  }
                  return false;
                };

                addFileToFolder(newProjectRoot);

                // Update state with new file selected
                setState(s => ({
                  ...s,
                  projectRoot: newProjectRoot,
                  selectedFilePath: newFilePath,
                  testFile: newTestFile,
                  selectedTestIndex: 0,
                  editorTab: 'test',
                }));
              }

              toast.success(`Created new test file: ${newFileName}`);
            } catch (error) {
              console.error('[handleStepsRecorded] Failed to create file:', error);
              toast.error('Failed to create test file');
            }
          })();
        } else {
          toast.warning('No project folder open. Please open a folder first.');
        }

        return {
          ...prev,
          showRecordDialog: false,
        };
      });
    }
  }, []);

  // Handle imported files from OpenAPI
  const handleOpenApiImport = useCallback((files: GeneratedFile[]) => {
    if (files.length === 0) {
      toast.warning('No files to import');
      return;
    }

    setState(prev => {
      // Find the directory to save in
      let targetDirHandle: FileSystemDirectoryHandle | null = null;
      let targetDirPath = '';

      // Try to find the parent folder of the currently selected file
      if (prev.selectedFilePath && prev.projectRoot) {
        const pathParts = prev.selectedFilePath.split('/');
        pathParts.pop(); // Remove filename
        const parentPath = pathParts.join('/');

        if (parentPath) {
          const parentNode = findNodeByPath(prev.projectRoot, parentPath);
          if (parentNode?.folderHandle) {
            targetDirHandle = parentNode.folderHandle;
            targetDirPath = parentPath;
          }
        }
      }

      // Fall back to project root
      if (!targetDirHandle && prev.projectRoot?.folderHandle) {
        targetDirHandle = prev.projectRoot.folderHandle;
        targetDirPath = prev.projectRoot.path;
      }

      // If we have a directory, create the files
      if (targetDirHandle) {
        (async () => {
          try {
            const createdFiles: { path: string; node: FileNode }[] = [];

            for (const file of files) {
              // Create the new file
              const newFileHandle = await targetDirHandle!.getFileHandle(file.fileName, { create: true });
              const writable = await newFileHandle.createWritable();
              await writable.write(JSON.stringify(file.testFile, null, 2));
              await writable.close();

              const newFilePath = targetDirPath ? `${targetDirPath}/${file.fileName}` : file.fileName;
              const newFileNode: FileNode = {
                name: file.fileName,
                path: newFilePath,
                type: 'file',
                testFile: file.testFile,
                handle: newFileHandle,
              };

              createdFiles.push({ path: newFilePath, node: newFileNode });
            }

            console.log('[handleOpenApiImport] Created files:', createdFiles.map(f => f.path));

            // Clone the project root and add the new files
            const cloneNode = (node: FileNode): FileNode => {
              const cloned: FileNode = { ...node };
              if (node.children) {
                cloned.children = node.children.map(cloneNode);
              }
              return cloned;
            };

            const newProjectRoot = prev.projectRoot ? cloneNode(prev.projectRoot) : null;

            if (newProjectRoot) {
              // Find the target folder and add the new files
              const addFilesToFolder = (node: FileNode): boolean => {
                if (node.path === targetDirPath || (node.path === node.name && targetDirPath === node.name)) {
                  if (!node.children) node.children = [];
                  for (const { node: fileNode } of createdFiles) {
                    node.children.push(fileNode);
                  }
                  // Sort children: folders first, then files alphabetically
                  node.children.sort((a, b) => {
                    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
                    return a.name.localeCompare(b.name);
                  });
                  return true;
                }
                if (node.children) {
                  for (const child of node.children) {
                    if (addFilesToFolder(child)) return true;
                  }
                }
                return false;
              };

              addFilesToFolder(newProjectRoot);

              // Update state with first file selected
              const firstFile = createdFiles[0];
              setState(s => ({
                ...s,
                projectRoot: newProjectRoot,
                selectedFilePath: firstFile.path,
                testFile: firstFile.node.testFile!,
                selectedTestIndex: 0,
                editorTab: 'test',
                showOpenApiDialog: false,
              }));
            }

            const testCount = files.reduce((sum, f) => sum + f.testCount, 0);
            toast.success(`Imported ${files.length} file(s) with ${testCount} test(s) from OpenAPI`);
          } catch (error) {
            console.error('[handleOpenApiImport] Failed to create files:', error);
            toast.error('Failed to create test files');
          }
        })();
      } else {
        toast.warning('No project folder open. Please open a folder first.');
      }

      return {
        ...prev,
        showOpenApiDialog: false,
      };
    });
  }, []);

  // Get test result
  const getTestResult = (testId: string) => {
    return state.results.find(r => r.testId === testId);
  };

  // Download HTML report
  const handleDownloadHTMLReport = useCallback(async () => {
    if (state.results.length === 0) return;

    try {
      const response = await fetch('/api/reports/html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testFile: state.testFile,
          results: state.results,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate report');
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : 'report.html';

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download HTML report:', err);
      toast.error('Failed to download HTML report');
    }
  }, [state.testFile, state.results]);

  // Download JUnit XML report
  const handleDownloadJUnitReport = useCallback(async () => {
    if (state.results.length === 0) return;

    try {
      const response = await fetch('/api/reports/junit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testFile: state.testFile,
          results: state.results,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate report');
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : 'junit.xml';

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download JUnit report:', err);
      toast.error('Failed to download JUnit report');
    }
  }, [state.testFile, state.results]);

  // Handle creating a variable from a Blockly block value
  const handleCreateVariable = useCallback((value: string, type: 'global' | 'file', name: string) => {
    if (type === 'global') {
      // Add to global variables
      const newGlobalVariables = {
        ...(state.globalVariables || {}),
        [name]: value,
      };

      const newGlobalsFileContent: GlobalsFile = {
        ...state.globalsFileContent,
        variables: newGlobalVariables,
      };

      // Save to file asynchronously
      if (globalsHandleRef.current) {
        (async () => {
          try {
            const writable = await globalsHandleRef.current!.createWritable();
            await writable.write(JSON.stringify(newGlobalsFileContent, null, 2));
            await writable.close();
            console.log('[handleCreateVariable] Saved globals.json');
          } catch (error) {
            console.error('[handleCreateVariable] Failed to save globals.json:', error);
          }
        })();
      }

      setState(prev => ({
        ...prev,
        globalVariables: newGlobalVariables,
        globalsFileContent: newGlobalsFileContent,
      }));

      toast.success(`Created global variable: ${name}`);
    } else {
      // Add to file variables
      setState(prev => ({
        ...prev,
        testFile: {
          ...prev.testFile,
          variables: {
            ...prev.testFile.variables,
            [name]: { default: value },
          },
        },
      }));

      toast.success(`Created file variable: ${name}`);
    }
  }, [state.globalVariables, state.globalsFileContent]);

  // Render global variables (supports nested objects)
  const renderGlobalVariables = (vars: Record<string, unknown>, prefix = ''): React.ReactNode[] => {
    const items: React.ReactNode[] = [];

    for (const [key, value] of Object.entries(vars)) {
      const fullPath = prefix ? `${prefix}.${key}` : key;

      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        // Nested object - render as collapsible group
        items.push(
          <div key={fullPath} className="variable-group">
            <div className="variable-group-header">{key}</div>
            <div className="variable-group-content">
              {renderGlobalVariables(value as Record<string, unknown>, fullPath)}
            </div>
          </div>
        );
      } else {
        // Leaf value - render as editable variable
        const isSimpleValue = typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
        const displayValue = isSimpleValue
          ? String(value)
          : JSON.stringify(value);

        items.push(
          <div key={fullPath} className="variable-item global">
            <span className="variable-name" title={`\${${fullPath}}`}>
              ${`{${fullPath}}`}
            </span>
            {isSimpleValue ? (
              <input
                type="text"
                className="variable-value global-input"
                value={displayValue}
                onChange={(e) => handleUpdateGlobalVariable(fullPath, e.target.value)}
                title={fullPath}
              />
            ) : (
              <span className="variable-value readonly" title={displayValue}>
                {displayValue.length > 30 ? displayValue.substring(0, 30) + '...' : displayValue}
              </span>
            )}
          </div>
        );
      }
    }

    return items;
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <h1>
          <span>TestBlocks</span>
          {state.version && <span className="header-version">v{state.version}</span>}
          {(state.selectedFilePath || state.editingFolderHooks) && (
            <span className="header-file-path">
              {state.editingFolderHooks ? (
                <>
                  <span className="folder-hooks-label">Folder Hooks:</span> {state.editingFolderHooks.path}
                </>
              ) : (
                state.selectedFilePath
              )}
              {state.autoSaveStatus === 'saving' && (
                <span className="auto-save-indicator saving">Saving...</span>
              )}
              {state.autoSaveStatus === 'saved' && (
                <span className="auto-save-indicator saved">Saved</span>
              )}
            </span>
          )}
        </h1>
        <div className="header-actions">
          <button
            className="btn btn-secondary"
            onClick={() => setState(prev => ({ ...prev, showHelpDialog: true }))}
            title="Help"
          >
            Help
          </button>
          <button className="btn btn-secondary" onClick={handleOpenFolder}>
            Open Folder
          </button>
          <button className="btn btn-secondary" onClick={handleLoad}>
            Open File
          </button>
          <button className="btn btn-secondary" onClick={handleSave}>
            Save
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setState(prev => ({ ...prev, showRecordDialog: true }))}
            title="Record browser actions"
          >
            Record
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setState(prev => ({ ...prev, showOpenApiDialog: true }))}
            title="Import tests from OpenAPI/Swagger specification"
          >
            Import OpenAPI
          </button>
          {state.globalsFileContent?.testIdAttribute && (
            <span className="test-id-indicator" title="Test ID Attribute (from globals.json)">
              TestID: <code>{state.globalsFileContent.testIdAttribute}</code>
            </span>
          )}
          <label className="headless-toggle">
            <input
              type="checkbox"
              checked={state.headless}
              onChange={(e) => {
                localStorage.setItem('testblocks-headless', String(e.target.checked));
                setState(prev => ({ ...prev, headless: e.target.checked }));
              }}
            />
            <span>Headless</span>
          </label>
          <button
            className="btn btn-primary"
            onClick={handleRunAll}
            disabled={state.isRunning}
          >
            {state.isRunning && !state.runningTestId ? 'Running...' : 'Run All Tests'}
          </button>
        </div>
      </header>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.testblocks.json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Hidden folder input (fallback for browsers without showDirectoryPicker) */}
      <input
        ref={folderInputRef}
        type="file"
        accept=".json,.testblocks.json"
        style={{ display: 'none' }}
        onChange={handleFolderInputChange}
        {...{ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>}
        multiple
      />

      {/* Main content */}
      <main className="main-content">
        {/* Sidebar */}
        <aside className={`sidebar${state.sidebarCollapsed ? ' collapsed' : ''}`}>
          {/* Sidebar header with toggle */}
          <div className="sidebar-toggle-header">
            <button
              className="panel-toggle-btn"
              onClick={() => {
                setState(prev => ({ ...prev, sidebarCollapsed: !prev.sidebarCollapsed }));
                setTimeout(() => window.dispatchEvent(new Event('resize')), 250);
              }}
              title={state.sidebarCollapsed ? 'Expand panel' : 'Collapse panel'}
            >
              {state.sidebarCollapsed ? '▶' : '◀'}
            </button>
          </div>
          {!state.sidebarCollapsed && (
          <>
          {/* Sidebar tabs */}
          <div className="sidebar-tabs">
            <button
              className={`sidebar-tab ${state.sidebarTab === 'files' ? 'active' : ''}`}
              onClick={() => setState(prev => ({ ...prev, sidebarTab: 'files' }))}
            >
              Files
            </button>
            <button
              className={`sidebar-tab ${state.sidebarTab === 'tests' ? 'active' : ''}`}
              onClick={() => setState(prev => ({ ...prev, sidebarTab: 'tests' }))}
            >
              Tests
            </button>
          </div>

          {state.sidebarTab === 'files' ? (
            /* File Tree */
            <div className="sidebar-section file-tree-section">
              {/* Show reopen prompt for last folder */}
              {!state.projectRoot && state.lastFolderName && (
                <div className="reopen-folder-prompt">
                  <span>Last folder: <strong>{state.lastFolderName}</strong></span>
                  <button className="btn btn-small btn-primary" onClick={handleReopenLastFolder}>
                    Reopen
                  </button>
                </div>
              )}
              <FileTree
                root={state.projectRoot}
                selectedPath={state.selectedFilePath}
                onSelectFile={handleSelectFile}
                onSelectFolder={handleSelectFolder}
                onRefresh={state.projectRoot ? handleRefreshFolder : undefined}
                onCreateFile={handleCreateFile}
                onCreateFolder={handleCreateFolder}
                onRename={handleRename}
                onDelete={handleDelete}
                onMove={handleMove}
                onRunFolder={handleRunFolder}
                isRunning={state.isRunning}
                failedFiles={state.failedFiles}
              />
            </div>
          ) : (
            <>
              {/* Global Variables Section */}
              <div className="sidebar-section">
                <div
                  className="sidebar-header clickable"
                  onClick={() => setState(prev => ({ ...prev, showGlobalVariables: !prev.showGlobalVariables }))}
                >
                  <h2>
                    <span style={{ marginRight: '8px' }}>{state.showGlobalVariables ? '▼' : '▶'}</span>
                    Global Variables
                    <span className="global-badge" title="From globals.json">🌐</span>
                  </h2>
                </div>
                {state.showGlobalVariables && (
                  <div className="variables-list global-variables" style={{ padding: '8px' }}>
                    <VariablesEditor
                      variables={recordToVariables(state.globalVariables)}
                      onChange={handleGlobalVariablesChange}
                      title=""
                      emptyMessage="No global variables. Add variables here to use across all test files."
                    />
                  </div>
                )}
              </div>

              {/* File Variables Section */}
              <div className="sidebar-section">
                <div
                  className="sidebar-header clickable"
                  onClick={() => setState(prev => ({ ...prev, showVariables: !prev.showVariables }))}
                >
                  <h2>
                    <span style={{ marginRight: '8px' }}>{state.showVariables ? '▼' : '▶'}</span>
                    File Variables
                  </h2>
                </div>
                {state.showVariables && (
                  <div className="variables-list" style={{ padding: '8px' }}>
                    <VariablesEditor
                      variables={Object.entries(state.testFile.variables || {}).map(([name, def]) => ({
                        name,
                        value: typeof (def as VariableDefinition).default === 'string'
                          ? (def as VariableDefinition).default as string
                          : JSON.stringify((def as VariableDefinition).default),
                      }))}
                      onChange={handleFileVariablesChange}
                      title=""
                      emptyMessage="No file variables. Add variables specific to this test file."
                    />
                  </div>
                )}
              </div>

              {/* Tests Section */}
              <div className="sidebar-section">
                <div className="sidebar-header">
                  <h2>Test Cases</h2>
                </div>
                <div className="test-list">
                  {state.testFile.tests.map((test, index) => {
                    const result = getTestResult(test.id);
                    const isRunningThis = state.runningTestId === test.id;
                    const isDisabled = test.disabled === true;
                    return (
                      <div
                        key={test.id}
                        className={`test-item ${index === state.selectedTestIndex ? 'active' : ''} ${result?.status || ''} ${isDisabled ? 'disabled' : ''}`}
                        onClick={() => setState(prev => ({ ...prev, selectedTestIndex: index, editorTab: 'test' }))}
                      >
                        <div className="test-item-content">
                          <div className="test-item-name">
                            {isDisabled ? (
                              <span className="status-dot skipped" title="Test is disabled" />
                            ) : result ? (
                              <span className={`status-dot ${result.status}`} />
                            ) : state.selectedFilePath && state.failedTestsMap.get(state.selectedFilePath)?.has(test.id) ? (
                              <span className="status-dot failed" title="Failed in previous run" />
                            ) : null}
                            <span className={isDisabled ? 'test-name-disabled' : ''}>{test.name}</span>
                            {test.data && test.data.length > 0 && (
                              <span className="data-driven-badge" title={`Data-driven: ${test.data.length} iterations`}>
                                ×{test.data.length}
                              </span>
                            )}
                          </div>
                          <div className="test-item-steps">
                            {Array.isArray(test.steps) ? test.steps.length : 0} steps
                          </div>
                        </div>
                        <button
                          className="btn-run-test"
                          onClick={(e) => handleRunTest(test.id, e)}
                          disabled={state.isRunning || isDisabled}
                          title={isDisabled ? "Test is disabled" : "Run this test"}
                        >
                          {isRunningThis ? '...' : '▶'}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <button className="add-test-btn" onClick={handleAddTest}>
                  + Add Test Case
                </button>
              </div>
            </>
          )}
          </>
          )}
        </aside>

        {/* Editor area */}
        <div className="editor-area">
          {/* Welcome screen when no project is open */}
          {!state.projectRoot && !state.selectedFilePath && (
            <div className="welcome-screen">
              <div className="welcome-content">
                <h2>Welcome to TestBlocks</h2>
                <p>Open a folder to get started with your test files.</p>

                {state.lastFolderName && (
                  <div className="reopen-section">
                    <p className="reopen-message">
                      Continue with your last project:
                    </p>
                    <button
                      className="btn btn-primary btn-large reopen-btn"
                      onClick={handleReopenLastFolder}
                    >
                      Reopen "{state.lastFolderName}"
                    </button>
                  </div>
                )}

                <div className="welcome-actions">
                  <button className="btn btn-secondary btn-large" onClick={handleOpenFolder}>
                    Open Folder
                  </button>
                  <button className="btn btn-secondary btn-large" onClick={handleLoad}>
                    Open File
                  </button>
                </div>

                <div className="welcome-tip">
                  <strong>Tip:</strong> Use <code>testblocks serve --project-dir ./your-project</code> to auto-open a project directory.
                </div>
              </div>
            </div>
          )}

          {/* Editor content (shown when a project or file is open) */}
          {(state.projectRoot || state.selectedFilePath) && (
          <>
          {/* Lifecycle tabs */}
          <div className="editor-tabs">
            <button
              className={`editor-tab ${state.editorTab === 'beforeAll' ? 'active' : ''}`}
              onClick={() => setState(prev => ({ ...prev, editorTab: 'beforeAll' }))}
            >
              Before All
              {state.editingFolderHooks ? (
                state.folderHooks.beforeAll && state.folderHooks.beforeAll.length > 0 && (
                  <span className="tab-badge">{state.folderHooks.beforeAll.length}</span>
                )
              ) : (
                state.testFile.beforeAll && state.testFile.beforeAll.length > 0 && (
                  <span className="tab-badge">{state.testFile.beforeAll.length}</span>
                )
              )}
            </button>
            <button
              className={`editor-tab ${state.editorTab === 'beforeEach' ? 'active' : ''}`}
              onClick={() => setState(prev => ({ ...prev, editorTab: 'beforeEach' }))}
            >
              Before Each
              {state.editingFolderHooks ? (
                state.folderHooks.beforeEach && state.folderHooks.beforeEach.length > 0 && (
                  <span className="tab-badge">{state.folderHooks.beforeEach.length}</span>
                )
              ) : (
                state.testFile.beforeEach && state.testFile.beforeEach.length > 0 && (
                  <span className="tab-badge">{state.testFile.beforeEach.length}</span>
                )
              )}
            </button>
            {!state.editingFolderHooks && (
              <button
                className={`editor-tab test-tab ${state.editorTab === 'test' ? 'active' : ''}`}
                onClick={() => setState(prev => ({ ...prev, editorTab: 'test' }))}
              >
                Test Steps
              </button>
            )}
            <button
              className={`editor-tab ${state.editorTab === 'afterEach' ? 'active' : ''}`}
              onClick={() => setState(prev => ({ ...prev, editorTab: 'afterEach' }))}
            >
              After Each
              {state.editingFolderHooks ? (
                state.folderHooks.afterEach && state.folderHooks.afterEach.length > 0 && (
                  <span className="tab-badge">{state.folderHooks.afterEach.length}</span>
                )
              ) : (
                state.testFile.afterEach && state.testFile.afterEach.length > 0 && (
                  <span className="tab-badge">{state.testFile.afterEach.length}</span>
                )
              )}
            </button>
            <button
              className={`editor-tab ${state.editorTab === 'afterAll' ? 'active' : ''}`}
              onClick={() => setState(prev => ({ ...prev, editorTab: 'afterAll' }))}
            >
              After All
              {state.editingFolderHooks ? (
                state.folderHooks.afterAll && state.folderHooks.afterAll.length > 0 && (
                  <span className="tab-badge">{state.folderHooks.afterAll.length}</span>
                )
              ) : (
                state.testFile.afterAll && state.testFile.afterAll.length > 0 && (
                  <span className="tab-badge">{state.testFile.afterAll.length}</span>
                )
              )}
            </button>
          </div>

          <div className="editor-toolbar">
            {state.editorTab === 'test' && !state.editingFolderHooks ? (
              <>
                <input
                  type="text"
                  className="test-name-input"
                  value={selectedTest?.name || ''}
                  onChange={(e) => handleTestNameChange(e.target.value)}
                  placeholder="Test name"
                />
                <button
                  className="btn btn-success"
                  onClick={() => handleRunTest(selectedTest?.id)}
                  disabled={state.isRunning || selectedTest?.disabled}
                  style={{ padding: '6px 12px', fontSize: '12px', marginRight: '8px' }}
                  title={selectedTest?.disabled ? 'Test is disabled' : 'Run this test'}
                >
                  {state.runningTestId === selectedTest?.id ? 'Running...' : 'Run Test'}
                </button>
                <button
                  className={`btn ${selectedTest?.disabled ? 'btn-success' : 'btn-warning'}`}
                  onClick={() => handleToggleTestDisabled(state.selectedTestIndex)}
                  style={{ padding: '6px 12px', fontSize: '12px', marginRight: '8px' }}
                  title={selectedTest?.disabled ? 'Enable this test' : 'Disable this test'}
                >
                  {selectedTest?.disabled ? 'Enable' : 'Disable'}
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => handleDeleteTest(state.selectedTestIndex)}
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  Delete
                </button>
              </>
            ) : (
              <div className="lifecycle-toolbar-info">
                <span className="lifecycle-icon">{state.editingFolderHooks ? '📁' : '⚡'}</span>
                <span>{getEditorTitle()}</span>
                <span className="lifecycle-hint">
                  {state.editingFolderHooks ? (
                    <>— Applies to all tests in this folder{state.editorTab === 'beforeAll' || state.editorTab === 'afterAll' ? '' : ' and subfolders'}</>
                  ) : (
                    <>
                      {state.editorTab === 'beforeAll' && '— Runs once before all tests'}
                      {state.editorTab === 'afterAll' && '— Runs once after all tests'}
                      {state.editorTab === 'beforeEach' && '— Runs before each test'}
                      {state.editorTab === 'afterEach' && '— Runs after each test'}
                    </>
                  )}
                </span>
              </div>
            )}
          </div>
          <div className="blockly-container">
            <BlocklyWorkspace
              key={`${state.editorTab}-${state.editorTab === 'test' ? selectedTest?.id : 'lifecycle'}-${state.selectedFilePath || state.editingFolderHooks?.path}-${state.pluginsLoaded}`}
              onWorkspaceChange={handleWorkspaceChange}
              onReplaceMatches={handleReplaceMatches}
              onCreateVariable={handleCreateVariable}
              initialSteps={getCurrentSteps()}
              testName={state.editorTab === 'test' ? selectedTest?.name : getEditorTitle()}
              lifecycleType={state.editorTab !== 'test' ? state.editorTab : undefined}
              testData={state.editorTab === 'test' ? selectedTest?.data : undefined}
              softAssertions={state.editorTab === 'test' ? selectedTest?.softAssertions : undefined}
              projectRoot={state.projectRoot}
              currentFilePath={state.selectedFilePath || undefined}
            />
          </div>
          </>
          )}
        </div>

        {/* Results panel */}
        <aside className={`results-panel${state.resultsPanelCollapsed ? ' collapsed' : ''}`}>
          <div className="results-header">
            <button
              className="panel-toggle-btn"
              onClick={() => {
                setState(prev => ({ ...prev, resultsPanelCollapsed: !prev.resultsPanelCollapsed }));
                // Trigger resize after CSS transition completes so Blockly can resize
                setTimeout(() => window.dispatchEvent(new Event('resize')), 250);
              }}
              title={state.resultsPanelCollapsed ? 'Expand panel' : 'Collapse panel'}
            >
              {state.resultsPanelCollapsed ? '◀' : '▶'}
            </button>
            {!state.resultsPanelCollapsed && (
              <>
                <h2>Results</h2>
                {state.results.length > 0 && (
                  <div className="results-actions">
                    <button
                      className="btn-report"
                      onClick={handleDownloadHTMLReport}
                      title="Download HTML Report"
                    >
                      HTML
                    </button>
                    <button
                      className="btn-report"
                      onClick={handleDownloadJUnitReport}
                      title="Download JUnit XML Report"
                    >
                      xUnit
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
          {!state.resultsPanelCollapsed && state.results.length > 0 && (
            <div className="results-summary">
              <span className="passed-count">{state.results.filter(r => r.status === 'passed').length} passed</span>
              {state.results.filter(r => r.status === 'failed' || r.status === 'error').length > 0 && (
                <span className="failed-count">{state.results.filter(r => r.status === 'failed' || r.status === 'error').length} failed</span>
              )}
              {state.results.filter(r => r.status === 'skipped').length > 0 && (
                <span className="skipped-count">{state.results.filter(r => r.status === 'skipped').length} skipped</span>
              )}
            </div>
          )}
          {!state.resultsPanelCollapsed && (
          <div className="results-content">
            {state.results.length === 0 ? (
              <div className="empty-state">
                <h3>No results yet</h3>
                <p>Run your tests to see results here</p>
              </div>
            ) : (
              state.results.map((result) => (
                <div
                  key={result.testId}
                  className={`result-item ${result.status}${result.isLifecycle ? ' lifecycle' : ''}`}
                >
                  <div className="result-test-header">
                    <span className={`status-indicator ${result.status}`} />
                    {result.isLifecycle && (
                      <span className="lifecycle-badge">{result.lifecycleType}</span>
                    )}
                    {(result as TestResult & { fileName?: string }).fileName && (
                      <span className="result-file-name">{(result as TestResult & { fileName?: string }).fileName} /</span>
                    )}
                    <span className="result-test-name">{result.testName}</span>
                    <span className="result-duration">{result.duration}ms</span>
                  </div>
                  {result.error && (
                    <div className="result-error">{result.error.message}</div>
                  )}
                  {result.steps && result.steps.length > 0 && (
                    <div className="result-steps">
                      {result.steps.map((step, index) => (
                        <StepResultItem key={step.stepId || index} step={step} />
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          )}
        </aside>
      </main>

      <HelpDialog
        isOpen={state.showHelpDialog}
        onClose={() => setState(prev => ({ ...prev, showHelpDialog: false }))}
      />

      <RecordDialog
        isOpen={state.showRecordDialog}
        onClose={() => setState(prev => ({ ...prev, showRecordDialog: false }))}
        onStepsRecorded={handleStepsRecorded}
      />

      <OpenApiImportDialog
        isOpen={state.showOpenApiDialog}
        onClose={() => setState(prev => ({ ...prev, showOpenApiDialog: false }))}
        onImport={handleOpenApiImport}
        hasProjectOpen={!!state.projectRoot?.folderHandle}
      />

      {promptDialog && (
        <PromptDialog
          isOpen={promptDialog.isOpen}
          title={promptDialog.title}
          fields={promptDialog.fields}
          onSubmit={(values) => {
            promptDialog.onSubmit(values);
            closePrompt();
          }}
          onCancel={closePrompt}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

// Helper to collect folder hooks from root to a file's parent folder
// Returns array of FolderHooks in order from outermost to innermost folder
function collectFolderHooks(root: FileNode | null, filePath: string | null): FolderHooks[] {
  if (!root || !filePath) return [];

  const hooks: FolderHooks[] = [];

  // Recursively find the path and collect hooks along the way
  function findAndCollect(node: FileNode, targetPath: string, currentHooks: FolderHooks[]): FolderHooks[] | null {
    // If this folder has hooks, add them to the chain
    const newHooks = node.folderHooks
      ? [...currentHooks, node.folderHooks]
      : currentHooks;

    // Check if the target file is in this folder's direct children
    if (node.children) {
      for (const child of node.children) {
        if (child.type === 'file' && child.path === targetPath) {
          // Found the file - return the hooks collected so far
          return newHooks;
        }
        if (child.type === 'folder') {
          const result = findAndCollect(child, targetPath, newHooks);
          if (result !== null) {
            return result;
          }
        }
      }
    }

    return null;
  }

  return findAndCollect(root, filePath, []) || [];
}
