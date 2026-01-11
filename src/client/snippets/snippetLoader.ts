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

// Track loaded procedures from globals.json
const loadedProcedures: Map<string, SnippetDefinition> = new Map();
const procedureBlocks: BlockDefinition[] = [];

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
 * Convert a procedure definition to a BlockDefinition for Blockly
 * Procedures use 'custom_' prefix to match how they're registered on server
 */
function procedureToBlockDefinition(procedure: SnippetDefinition): BlockDefinition {
  const blockType = `custom_${procedure.name.toLowerCase().replace(/\s+/g, '_')}`;

  return {
    type: blockType,
    category: procedure.category || 'Custom',
    color: '#607D8B',
    tooltip: procedure.description || `Custom block: ${procedure.name}`,
    inputs: (procedure.params || []).map(param => ({
      name: param.name.toUpperCase(),
      type: 'field' as const,
      fieldType: param.type === 'number' ? 'number' as const : 'text' as const,
      default: param.default,
    })),
    previousStatement: true,
    nextStatement: true,
    // Note: execute function is handled server-side
    execute: async () => ({ _summary: `Procedure: ${procedure.name}` }),
  };
}

/**
 * Load snippets and procedures from the server API
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
    const procedures: SnippetDefinition[] = data.procedures || [];

    // Register each snippet as a block
    snippets.forEach(snippet => {
      if (!loadedSnippets.has(snippet.name)) {
        loadedSnippets.set(snippet.name, snippet);
        const blockDef = snippetToBlockDefinition(snippet);
        snippetBlocks.push(blockDef);
        console.log(`Loaded snippet block: ${blockDef.type} (${snippet.stepCount} steps)`);
      }
    });

    // Register each procedure from globals.json as a block
    console.log(`[snippetLoader] Found ${procedures.length} procedures from server:`, procedures.map(p => p.name));
    procedures.forEach(procedure => {
      if (!loadedProcedures.has(procedure.name)) {
        loadedProcedures.set(procedure.name, procedure);
        const blockDef = procedureToBlockDefinition(procedure);
        procedureBlocks.push(blockDef);
        console.log(`[snippetLoader] Loaded procedure block: ${blockDef.type} (category: ${blockDef.category}, ${procedure.stepCount} steps)`);
      }
    });
    console.log(`[snippetLoader] Total procedure blocks: ${procedureBlocks.length}`);

    snippetsLoaded = true;
    console.log(`Loaded ${snippets.length} snippet(s) and ${procedures.length} procedure(s) from server`);
  } catch (error) {
    console.error('Failed to load snippets from server:', error);
  }
}

/**
 * Get all blocks from loaded snippets
 */
export function getSnippetBlocks(): BlockDefinition[] {
  // Include both snippets and procedures from globals.json
  console.log(`[snippetLoader] getSnippetBlocks called: ${snippetBlocks.length} snippets, ${procedureBlocks.length} procedures`);
  return [...snippetBlocks, ...procedureBlocks];
}

/**
 * Get all blocks from loaded procedures (from globals.json)
 */
export function getProcedureBlocks(): BlockDefinition[] {
  return [...procedureBlocks];
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
 * Clear all loaded snippets and procedures (useful for testing/refresh)
 */
export function clearSnippets(): void {
  loadedSnippets.clear();
  snippetBlocks.length = 0;
  loadedProcedures.clear();
  procedureBlocks.length = 0;
  snippetsLoaded = false;
}

/**
 * Force reload snippets from server
 */
export async function reloadSnippets(): Promise<void> {
  clearSnippets();
  await loadSnippetsFromServer();
}
