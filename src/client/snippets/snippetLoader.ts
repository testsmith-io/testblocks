/**
 * Snippet Loader for TestBlocks Client
 *
 * This module handles loading snippets from the server and converting them
 * to BlockDefinitions for display in the Blockly toolbox.
 */

import { BlockDefinition } from '../../core';

// Snippet definition from server
export interface SnippetDefinition {
  name: string;
  description?: string;
  category?: string;
  color?: string;
  params?: SnippetParam[];
  stepCount: number;
}

export interface SnippetParam {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'any';
  default?: unknown;
  description?: string;
}

// Track loaded snippets and their blocks
const loadedSnippets: Map<string, SnippetDefinition> = new Map();
const snippetBlocks: BlockDefinition[] = [];
let snippetsLoaded = false;

/**
 * Convert a snippet definition to a BlockDefinition for Blockly
 */
function snippetToBlockDefinition(snippet: SnippetDefinition): BlockDefinition {
  const blockType = `snippet_${snippet.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

  return {
    type: blockType,
    category: snippet.category || 'Snippets',
    color: snippet.color || '#795548',
    tooltip: snippet.description || `Snippet: ${snippet.name}`,
    inputs: (snippet.params || []).map(param => ({
      name: param.name.toUpperCase(),
      type: 'field' as const,
      fieldType: param.type === 'number' ? 'number' as const : 'text' as const,
      default: param.default,
    })),
    previousStatement: true,
    nextStatement: true,
    // Note: execute function is handled server-side
    execute: async () => ({ _summary: `Snippet: ${snippet.name}` }),
  };
}

/**
 * Load snippets from the server API
 */
export async function loadSnippetsFromServer(): Promise<void> {
  if (snippetsLoaded) {
    return;
  }

  try {
    const response = await fetch('/api/globals');
    if (!response.ok) {
      console.warn('Failed to fetch snippets from server:', response.statusText);
      return;
    }

    const data = await response.json();
    const snippets: SnippetDefinition[] = data.snippets || [];

    // Register each snippet as a block
    snippets.forEach(snippet => {
      if (!loadedSnippets.has(snippet.name)) {
        loadedSnippets.set(snippet.name, snippet);
        const blockDef = snippetToBlockDefinition(snippet);
        snippetBlocks.push(blockDef);
        console.log(`Loaded snippet block: ${blockDef.type} (${snippet.stepCount} steps)`);
      }
    });

    snippetsLoaded = true;
    console.log(`Loaded ${snippets.length} snippet(s) from server`);
  } catch (error) {
    console.error('Failed to load snippets from server:', error);
  }
}

/**
 * Get all blocks from loaded snippets
 */
export function getSnippetBlocks(): BlockDefinition[] {
  return [...snippetBlocks];
}

/**
 * Get all loaded snippets
 */
export function getLoadedSnippets(): SnippetDefinition[] {
  return Array.from(loadedSnippets.values());
}

/**
 * Check if snippets have been loaded
 */
export function areSnippetsLoaded(): boolean {
  return snippetsLoaded;
}

/**
 * Clear all loaded snippets (useful for testing/refresh)
 */
export function clearSnippets(): void {
  loadedSnippets.clear();
  snippetBlocks.length = 0;
  snippetsLoaded = false;
}

/**
 * Force reload snippets from server
 */
export async function reloadSnippets(): Promise<void> {
  clearSnippets();
  await loadSnippetsFromServer();
}
