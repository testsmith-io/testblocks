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
