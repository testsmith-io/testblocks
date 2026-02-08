/**
 * File system utilities for the web client
 */

import { TestFile, FolderHooks } from '../../core';
import { FileNode } from '../components/FileTree';

export interface GlobalsFile {
  variables?: Record<string, unknown>;
  config?: Record<string, unknown>;
  testIdAttribute?: string;
}

/**
 * Check if server has a project directory configured
 */
export async function getServerProjectDir(): Promise<string | null> {
  try {
    const response = await fetch('/api/initial-project');
    const data = await response.json();
    return data.projectDir || null;
  } catch {
    return null;
  }
}

/**
 * Load project file tree from server (when --project-dir is specified)
 */
export async function loadProjectFromServer(): Promise<FileNode | null> {
  try {
    const response = await fetch('/api/project/files');
    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    // Convert server response to FileNode structure
    const convertToFileNode = (item: { name: string; path: string; type: 'file' | 'folder'; children?: unknown[] }, parentPath: string = ''): FileNode => {
      const node: FileNode = {
        name: item.name,
        path: item.path,
        type: item.type,
        serverManaged: true, // Mark as server-managed
      };

      if (item.type === 'folder' && item.children) {
        node.children = (item.children as { name: string; path: string; type: 'file' | 'folder'; children?: unknown[] }[])
          .map(child => convertToFileNode(child, item.path));
      }

      return node;
    };

    const root: FileNode = {
      name: data.name,
      path: data.name,
      type: 'folder',
      serverManaged: true,
      children: (data.files as { name: string; path: string; type: 'file' | 'folder'; children?: unknown[] }[])
        .map(item => convertToFileNode(item, '')),
    };

    // Now load the actual test file contents
    await loadTestFilesFromServer(root);

    return root;
  } catch (error) {
    console.error('Failed to load project from server:', error);
    return null;
  }
}

/**
 * Recursively load test file contents from server
 */
async function loadTestFilesFromServer(node: FileNode): Promise<void> {
  if (node.type === 'file' && node.path.endsWith('.testblocks.json')) {
    try {
      const content = await readFileFromServer(node.path);
      if (content && content.version && content.tests) {
        node.testFile = content as TestFile;
      }
    } catch (error) {
      console.warn(`Failed to load test file: ${node.path}`, error);
    }
  }

  if (node.children) {
    await Promise.all(node.children.map(child => loadTestFilesFromServer(child)));
  }
}

/**
 * Read a file from server project directory
 */
export async function readFileFromServer(filePath: string): Promise<unknown | null> {
  try {
    const response = await fetch(`/api/project/read?path=${encodeURIComponent(filePath)}`);
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return data.content;
  } catch {
    return null;
  }
}

/**
 * Write a file to server project directory
 */
export async function writeFileToServer(filePath: string, content: unknown): Promise<boolean> {
  try {
    const response = await fetch('/api/project/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath, content }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Create a new file in server project directory
 */
export async function createFileOnServer(filePath: string, content: unknown): Promise<boolean> {
  try {
    const response = await fetch('/api/project/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath, content }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Delete a file from server project directory
 */
export async function deleteFileFromServer(filePath: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/project/delete?path=${encodeURIComponent(filePath)}`, {
      method: 'DELETE',
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Load globals.json from server project directory
 */
export async function loadGlobalsFromServer(): Promise<{
  variables: Record<string, unknown> | null;
  fullContent: GlobalsFile | null;
}> {
  try {
    const content = await readFileFromServer('globals.json');
    if (content) {
      const globals = content as GlobalsFile;
      return {
        variables: globals.variables || null,
        fullContent: globals,
      };
    }
  } catch {
    // globals.json doesn't exist
  }
  return { variables: null, fullContent: null };
}

/**
 * Recursively scan a directory for .testblocks.json files
 */
export async function scanDirectory(
  dirHandle: FileSystemDirectoryHandle,
  path: string = ''
): Promise<FileNode> {
  const node: FileNode = {
    name: dirHandle.name,
    path: path || dirHandle.name,
    type: 'folder',
    children: [],
    folderHandle: dirHandle,
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
    } else if (entry.name === '_hooks.testblocks.json') {
      // Load folder hooks
      try {
        const fileHandle = entry.handle as FileSystemFileHandle;
        const file = await fileHandle.getFile();
        const content = await file.text();
        const hooks = JSON.parse(content) as FolderHooks;
        node.folderHooks = hooks;
        node.hooksFileHandle = fileHandle;
      } catch (e) {
        console.warn(`Skipping invalid hooks file: ${entry.name}`, e);
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

/**
 * Load globals.json from a directory
 */
export async function loadGlobalsFile(dirHandle: FileSystemDirectoryHandle): Promise<{
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

/**
 * Find a node in the file tree by path
 */
export function findNodeByPath(root: FileNode | null, path: string | null): FileNode | null {
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

/**
 * Find a folder node in the file tree by path
 */
export function findFolderByPath(root: FileNode | null, path: string | null): FileNode | null {
  if (!root || !path) return null;

  if (root.path === path && root.type === 'folder') return root;

  if (root.children) {
    for (const child of root.children) {
      const found = findFolderByPath(child, path);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Helper to set a nested value in an object using dot notation path
 */
export function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
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

/**
 * Collect all test files under a folder (for running all tests in folder)
 */
export function collectAllTestFiles(node: FileNode): FileNode[] {
  const testFiles: FileNode[] = [];

  if (node.type === 'file' && node.testFile) {
    testFiles.push(node);
  }

  if (node.children) {
    for (const child of node.children) {
      testFiles.push(...collectAllTestFiles(child));
    }
  }

  return testFiles;
}
