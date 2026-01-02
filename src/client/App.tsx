import React, { useState, useCallback, useRef, useEffect } from 'react';
import * as Blockly from 'blockly';
import { TestFile, TestCase, TestResult, VariableDefinition, TestStep, ProcedureDefinition } from '../core';
import { BlocklyWorkspace } from './components/BlocklyWorkspace';
import { StepResultItem } from './components/StepResultItem';
import { FileTree, FileNode } from './components/FileTree';
import { HelpDialog } from './components/HelpDialog';
import { RecordDialog } from './components/RecordDialog';
import { workspaceToTestSteps } from './blockly/blockDefinitions';
import { exportCustomBlocksAsProcedures, loadCustomBlocksFromProcedures, clearCustomBlocks } from './blockly/customBlockCreator';
import { applyMatchToTestFile, BlockMatch } from './blockly/blockMatcher';
import { CreateBlockResult } from './components/CreateBlockDialog';

// IndexedDB helpers for storing directory handles
const DB_NAME = 'testblocks-storage';
const STORE_NAME = 'handles';

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

async function saveDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(handle, 'lastDirectory');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

async function getStoredDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get('lastDirectory');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  } catch {
    return null;
  }
}

type EditorTab = 'test' | 'beforeAll' | 'afterAll' | 'beforeEach' | 'afterEach';

interface GlobalsFile {
  variables?: Record<string, unknown>;
  config?: Record<string, unknown>;
  testIdAttribute?: string;
}

interface AppState {
  // Project state
  projectRoot: FileNode | null;
  lastFolderName: string | null; // Name of last opened folder (for re-open prompt)
  selectedFilePath: string | null;
  globalVariables: Record<string, unknown> | null;
  globalsFileContent: GlobalsFile | null;
  // Current file state
  testFile: TestFile;
  selectedTestIndex: number;
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

// Recursively scan a directory for .testblocks.json files
async function scanDirectory(
  dirHandle: FileSystemDirectoryHandle,
  path: string = ''
): Promise<FileNode> {
  const node: FileNode = {
    name: dirHandle.name,
    path: path || dirHandle.name,
    type: 'folder',
    children: [],
  };

  const entries: { name: string; kind: 'file' | 'directory'; handle: FileSystemHandle }[] = [];

  for await (const entry of dirHandle.values()) {
    entries.push({ name: entry.name, kind: entry.kind, handle: entry });
  }

  // Sort: folders first, then files, alphabetically
  entries.sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  for (const entry of entries) {
    const entryPath = path ? `${path}/${entry.name}` : entry.name;

    if (entry.kind === 'directory') {
      const subDir = await scanDirectory(entry.handle as FileSystemDirectoryHandle, entryPath);
      // Only include folders that have test files in them
      if (subDir.children && subDir.children.length > 0) {
        node.children!.push(subDir);
      }
    } else if (entry.name.endsWith('.testblocks.json') || entry.name.endsWith('.json')) {
      try {
        const fileHandle = entry.handle as FileSystemFileHandle;
        const file = await fileHandle.getFile();
        const content = await file.text();
        const testFile = JSON.parse(content) as TestFile;

        // Verify it's a valid test file
        if (testFile.version && testFile.tests && Array.isArray(testFile.tests)) {
          node.children!.push({
            name: entry.name,
            path: entryPath,
            type: 'file',
            testFile,
            handle: fileHandle,
          });
        }
      } catch (e) {
        // Skip invalid files
        console.warn(`Skipping invalid file: ${entry.name}`, e);
      }
    }
  }

  return node;
}

// Load globals.json from a directory
async function loadGlobalsFile(dirHandle: FileSystemDirectoryHandle): Promise<{
  variables: Record<string, unknown> | null;
  handle: FileSystemFileHandle | null;
  fullContent: GlobalsFile | null;
}> {
  try {
    const globalsHandle = await dirHandle.getFileHandle('globals.json');
    const file = await globalsHandle.getFile();
    const content = await file.text();
    const globals = JSON.parse(content) as GlobalsFile;
    console.log('[loadGlobalsFile] Loaded globals:', globals);
    return {
      variables: globals.variables || null,
      handle: globalsHandle,
      fullContent: globals,
    };
  } catch {
    // globals.json doesn't exist or couldn't be parsed
    console.log('[loadGlobalsFile] No globals.json found');
    return { variables: null, handle: null, fullContent: null };
  }
}

// Helper to set a nested value in an object using dot notation path
function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const result = JSON.parse(JSON.stringify(obj)); // Deep clone
  const parts = path.split('.');
  let current: Record<string, unknown> = result;

  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in current)) {
      current[parts[i]] = {};
    }
    current = current[parts[i]] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
  return result;
}

export default function App() {
  const [state, setState] = useState<AppState>({
    projectRoot: null,
    lastFolderName: null,
    selectedFilePath: null,
    globalVariables: null,
    globalsFileContent: null,
    testFile: initialTestFile,
    selectedTestIndex: 0,
    results: [],
    isRunning: false,
    runningTestId: null,
    showVariables: false,
    showGlobalVariables: true,
    headless: true,
    editorTab: 'test',
    sidebarTab: 'files',
    showHelpDialog: false,
    showRecordDialog: false,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const dirHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const globalsHandleRef = useRef<FileSystemFileHandle | null>(null);

  const selectedTest = state.testFile.tests[state.selectedTestIndex];

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
  useEffect(() => {
    const tryRestoreLastFolder = async () => {
      try {
        const storedHandle = await getStoredDirectoryHandle();
        if (storedHandle) {
          // Check current permission state first
          const currentPermission = await storedHandle.queryPermission({ mode: 'readwrite' });

          if (currentPermission === 'granted') {
            // Already have permission, open directly
            await openDirectoryFromHandle(storedHandle);
            console.log('Restored last opened folder:', storedHandle.name);
          } else {
            // Need permission - show the folder name so user can re-open
            setState(prev => ({ ...prev, lastFolderName: storedHandle.name }));
            console.log('Last folder needs permission:', storedHandle.name);
          }
        }
      } catch (e) {
        // Permission denied or handle expired - that's okay
        console.log('Could not restore last folder:', (e as Error).message);
      }
    };

    tryRestoreLastFolder();
  }, [openDirectoryFromHandle]);

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
        const dirHandle = await (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker();

        // Save the handle for future sessions
        await saveDirectoryHandle(dirHandle);

        await openDirectoryFromHandle(dirHandle);
        setState(prev => ({ ...prev, lastFolderName: null }));
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          console.error('Failed to open folder:', e);
          alert('Failed to open folder: ' + (e as Error).message);
        }
      }
    } else {
      // Fallback: use webkitdirectory input
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

    setState(prev => ({
      ...prev,
      selectedFilePath: node.path,
      testFile: node.testFile!,
      selectedTestIndex: 0,
      results: [],
      editorTab: 'test',
      sidebarTab: 'tests',
    }));
  }, []);

  // Handle workspace changes for test steps
  const handleWorkspaceChange = useCallback((steps: unknown[], testName?: string, testData?: Array<{ name?: string; values: Record<string, unknown> }>) => {
    setState(prev => {
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
    if (state.editorTab === 'test') {
      return selectedTest?.steps as unknown[];
    }
    return (state.testFile[state.editorTab] || []) as unknown[];
  }, [state.editorTab, state.testFile, selectedTest]);

  // Get the name for the current editor tab
  const getEditorTitle = useCallback(() => {
    switch (state.editorTab) {
      case 'beforeAll': return 'Before All Tests';
      case 'afterAll': return 'After All Tests';
      case 'beforeEach': return 'Before Each Test';
      case 'afterEach': return 'After Each Test';
      default: return selectedTest?.name || 'Test';
    }
  }, [state.editorTab, selectedTest]);

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
        alert('Failed to load test file: ' + (err as Error).message);
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
      alert('Cannot delete the last test case');
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

  // Run all tests
  const handleRunAll = useCallback(async () => {
    setState(prev => ({ ...prev, isRunning: true, runningTestId: null, results: [] }));

    try {
      const response = await fetch(`/api/run?headless=${state.headless}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state.testFile),
      });

      const data = await response.json();

      if (!response.ok || !Array.isArray(data)) {
        const errorMsg = data.message || data.error || 'Unknown error';
        console.error('Test run failed:', errorMsg);
        setState(prev => ({ ...prev, isRunning: false }));
        alert(`Test run failed: ${errorMsg}`);
        return;
      }

      setState(prev => ({ ...prev, results: data, isRunning: false }));
    } catch (err) {
      console.error('Failed to run tests:', err);
      setState(prev => ({ ...prev, isRunning: false }));
      alert('Failed to run tests. Make sure the server is running.');
    }
  }, [state.testFile, state.headless]);

  // Run single test
  const handleRunTest = useCallback(async (testId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }

    setState(prev => ({ ...prev, isRunning: true, runningTestId: testId, results: [] }));

    try {
      const response = await fetch(`/api/run?headless=${state.headless}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...state.testFile,
          tests: state.testFile.tests.filter(t => t.id === testId),
        }),
      });

      const data = await response.json();

      if (!response.ok || !Array.isArray(data)) {
        const errorMsg = data.message || data.error || 'Unknown error';
        console.error('Test run failed:', errorMsg);
        setState(prev => ({ ...prev, isRunning: false, runningTestId: null }));
        alert(`Test run failed: ${errorMsg}`);
        return;
      }

      setState(prev => ({ ...prev, results: data, isRunning: false, runningTestId: null }));
    } catch (err) {
      console.error('Failed to run test:', err);
      setState(prev => ({ ...prev, isRunning: false, runningTestId: null }));
      alert('Failed to run test. Make sure the server is running.');
    }
  }, [state.testFile, state.headless]);

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
    const name = prompt('Variable name:');
    if (!name) return;

    const defaultValue = prompt('Default value:', '');

    setState(prev => ({
      ...prev,
      testFile: {
        ...prev.testFile,
        variables: {
          ...prev.testFile.variables,
          [name]: {
            type: 'string',
            default: defaultValue || '',
          },
        },
      },
    }));
  }, []);

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
        return {
          ...prev,
          testFile: { ...prev.testFile, tests: newTests },
          showRecordDialog: false,
        };
      });
    } else {
      // Create new test with steps
      const newTest: TestCase = {
        id: `test-${Date.now()}`,
        name: 'Recorded Test',
        description: 'Test recorded from browser actions',
        steps,
        tags: ['recorded'],
      };
      setState(prev => ({
        ...prev,
        testFile: { ...prev.testFile, tests: [...prev.testFile.tests, newTest] },
        selectedTestIndex: prev.testFile.tests.length,
        showRecordDialog: false,
        editorTab: 'test',
      }));
    }
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
      alert('Failed to download HTML report');
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
      alert('Failed to download JUnit report');
    }
  }, [state.testFile, state.results]);

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
          {state.selectedFilePath && (
            <span className="header-file-path">
              {state.selectedFilePath}
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
          {state.globalsFileContent?.testIdAttribute && (
            <span className="test-id-indicator" title="Test ID Attribute (from globals.json)">
              TestID: <code>{state.globalsFileContent.testIdAttribute}</code>
            </span>
          )}
          <label className="headless-toggle">
            <input
              type="checkbox"
              checked={state.headless}
              onChange={(e) => setState(prev => ({ ...prev, headless: e.target.checked }))}
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
        <aside className="sidebar">
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
                onRefresh={state.projectRoot ? handleRefreshFolder : undefined}
              />
            </div>
          ) : (
            <>
              {/* Global Variables Section */}
              {state.globalVariables && Object.keys(state.globalVariables).length > 0 && (
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
                    <div className="variables-list global-variables">
                      {renderGlobalVariables(state.globalVariables)}
                    </div>
                  )}
                </div>
              )}

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
                  <div className="variables-list">
                    {Object.entries(state.testFile.variables || {}).map(([name, def]) => (
                      <div key={name} className="variable-item">
                        <span className="variable-name">${`{${name}}`}</span>
                        <input
                          type="text"
                          value={(def as VariableDefinition).default?.toString() || ''}
                          onChange={(e) => handleUpdateVariable(name, e.target.value)}
                          className="variable-value"
                          placeholder="value"
                        />
                        <button
                          className="btn-icon"
                          onClick={() => handleDeleteVariable(name)}
                          title="Delete variable"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button className="add-variable-btn" onClick={handleAddVariable}>
                      + Add Variable
                    </button>
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
                    return (
                      <div
                        key={test.id}
                        className={`test-item ${index === state.selectedTestIndex ? 'active' : ''} ${result?.status || ''}`}
                        onClick={() => setState(prev => ({ ...prev, selectedTestIndex: index, editorTab: 'test' }))}
                      >
                        <div className="test-item-content">
                          <div className="test-item-name">
                            {result && (
                              <span className={`status-dot ${result.status}`} />
                            )}
                            {test.name}
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
                          disabled={state.isRunning}
                          title="Run this test"
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
        </aside>

        {/* Editor area */}
        <div className="editor-area">
          {/* Lifecycle tabs */}
          <div className="editor-tabs">
            <button
              className={`editor-tab ${state.editorTab === 'beforeAll' ? 'active' : ''}`}
              onClick={() => setState(prev => ({ ...prev, editorTab: 'beforeAll' }))}
            >
              Before All
              {state.testFile.beforeAll && state.testFile.beforeAll.length > 0 && (
                <span className="tab-badge">{state.testFile.beforeAll.length}</span>
              )}
            </button>
            <button
              className={`editor-tab ${state.editorTab === 'beforeEach' ? 'active' : ''}`}
              onClick={() => setState(prev => ({ ...prev, editorTab: 'beforeEach' }))}
            >
              Before Each
              {state.testFile.beforeEach && state.testFile.beforeEach.length > 0 && (
                <span className="tab-badge">{state.testFile.beforeEach.length}</span>
              )}
            </button>
            <button
              className={`editor-tab test-tab ${state.editorTab === 'test' ? 'active' : ''}`}
              onClick={() => setState(prev => ({ ...prev, editorTab: 'test' }))}
            >
              Test Steps
            </button>
            <button
              className={`editor-tab ${state.editorTab === 'afterEach' ? 'active' : ''}`}
              onClick={() => setState(prev => ({ ...prev, editorTab: 'afterEach' }))}
            >
              After Each
              {state.testFile.afterEach && state.testFile.afterEach.length > 0 && (
                <span className="tab-badge">{state.testFile.afterEach.length}</span>
              )}
            </button>
            <button
              className={`editor-tab ${state.editorTab === 'afterAll' ? 'active' : ''}`}
              onClick={() => setState(prev => ({ ...prev, editorTab: 'afterAll' }))}
            >
              After All
              {state.testFile.afterAll && state.testFile.afterAll.length > 0 && (
                <span className="tab-badge">{state.testFile.afterAll.length}</span>
              )}
            </button>
          </div>

          <div className="editor-toolbar">
            {state.editorTab === 'test' ? (
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
                  disabled={state.isRunning}
                  style={{ padding: '6px 12px', fontSize: '12px', marginRight: '8px' }}
                >
                  {state.runningTestId === selectedTest?.id ? 'Running...' : 'Run Test'}
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
                <span className="lifecycle-icon">⚡</span>
                <span>{getEditorTitle()}</span>
                <span className="lifecycle-hint">
                  {state.editorTab === 'beforeAll' && '— Runs once before all tests'}
                  {state.editorTab === 'afterAll' && '— Runs once after all tests'}
                  {state.editorTab === 'beforeEach' && '— Runs before each test'}
                  {state.editorTab === 'afterEach' && '— Runs after each test'}
                </span>
              </div>
            )}
          </div>
          <div className="blockly-container">
            <BlocklyWorkspace
              key={`${state.editorTab}-${state.editorTab === 'test' ? selectedTest?.id : 'lifecycle'}-${state.selectedFilePath}`}
              onWorkspaceChange={handleWorkspaceChange}
              onReplaceMatches={handleReplaceMatches}
              initialSteps={getCurrentSteps()}
              testName={state.editorTab === 'test' ? selectedTest?.name : getEditorTitle()}
              lifecycleType={state.editorTab !== 'test' ? state.editorTab : undefined}
              testData={state.editorTab === 'test' ? selectedTest?.data : undefined}
              projectRoot={state.projectRoot}
              currentFilePath={state.selectedFilePath || undefined}
            />
          </div>
        </div>

        {/* Results panel */}
        <aside className="results-panel">
          <div className="results-header">
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
          </div>
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
    </div>
  );
}

// Helper to find a node by path
function findNodeByPath(root: FileNode | null, path: string | null): FileNode | null {
  if (!root || !path) return null;

  if (root.path === path) return root;

  if (root.children) {
    for (const child of root.children) {
      const found = findNodeByPath(child, path);
      if (found) return found;
    }
  }

  return null;
}
