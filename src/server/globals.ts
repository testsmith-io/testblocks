/**
 * Globals and Snippets Loader
 *
 * Loads shared configuration from:
 * - globals.json - Shared variables across all test files
 * - snippets/ - Reusable block sequences (composite blocks)
 */

import * as fs from 'fs';
import * as path from 'path';
import { TestStep, BlockDefinition, registerBlock, getBlock, ProcedureDefinition } from '../core';

// Store loaded globals and snippets
let globalsDirectory: string = process.cwd();
let loadedGlobals: Record<string, unknown> = {};
const loadedSnippets: Map<string, SnippetDefinition> = new Map();

export interface GlobalsConfig {
  variables?: Record<string, unknown>;
  procedures?: Record<string, ProcedureDefinition>;
  baseUrl?: string;
  timeout?: number;
  testIdAttribute?: string;
  // Additional shared config
  [key: string]: unknown;
}

export interface SnippetDefinition {
  name: string;
  description?: string;
  category?: string;
  color?: string;
  // Input parameters that can be passed to the snippet
  params?: SnippetParam[];
  // The steps to execute
  steps: TestStep[];
}

export interface SnippetParam {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'any';
  default?: unknown;
  description?: string;
}

/**
 * Set the directory to look for globals.json and snippets/
 */
export function setGlobalsDirectory(dir: string): void {
  globalsDirectory = path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir);
}

/**
 * Get the current globals directory
 */
export function getGlobalsDirectory(): string {
  return globalsDirectory;
}

/**
 * Load globals.json from the globals directory
 */
export function loadGlobals(): GlobalsConfig {
  const globalsPath = path.join(globalsDirectory, 'globals.json');

  if (!fs.existsSync(globalsPath)) {
    console.log(`No globals.json found at ${globalsPath}`);
    return {};
  }

  try {
    const content = fs.readFileSync(globalsPath, 'utf-8');
    loadedGlobals = JSON.parse(content);
    console.log(`Loaded globals from ${globalsPath}`);
    return loadedGlobals as GlobalsConfig;
  } catch (error) {
    console.error(`Failed to load globals.json:`, error);
    return {};
  }
}

/**
 * Get the loaded globals
 */
export function getGlobals(): GlobalsConfig {
  return loadedGlobals as GlobalsConfig;
}

/**
 * Get global variables
 */
export function getGlobalVariables(): Record<string, unknown> {
  return (loadedGlobals as GlobalsConfig).variables || {};
}

/**
 * Get global procedures from globals.json
 */
export function getGlobalProcedures(): Record<string, ProcedureDefinition> {
  return (loadedGlobals as GlobalsConfig).procedures || {};
}

/**
 * Get the configured test ID attribute (defaults to 'data-testid')
 */
export function getTestIdAttribute(): string {
  return (loadedGlobals as GlobalsConfig).testIdAttribute || 'data-testid';
}

/**
 * Set the test ID attribute and persist to globals.json
 */
export function setTestIdAttribute(attribute: string): void {
  const config = loadedGlobals as GlobalsConfig;
  config.testIdAttribute = attribute;
  saveGlobals();
}

/**
 * Save globals.json to disk
 */
function saveGlobals(): void {
  const globalsPath = path.join(globalsDirectory, 'globals.json');
  try {
    fs.writeFileSync(globalsPath, JSON.stringify(loadedGlobals, null, 2), 'utf-8');
    console.log(`Saved globals to ${globalsPath}`);
  } catch (error) {
    console.error(`Failed to save globals.json:`, error);
  }
}

/**
 * Discover snippet files in the snippets directory
 */
export function discoverSnippets(): string[] {
  const snippetsDir = path.join(globalsDirectory, 'snippets');

  if (!fs.existsSync(snippetsDir)) {
    console.log(`No snippets directory found at ${snippetsDir}`);
    return [];
  }

  const files = fs.readdirSync(snippetsDir);
  const snippets: string[] = [];

  for (const file of files) {
    if (file.endsWith('.snippet.json') || file.endsWith('.testblocks.json')) {
      const snippetName = file.replace(/\.(snippet|testblocks)\.json$/, '');
      snippets.push(snippetName);
    }
  }

  console.log(`Discovered ${snippets.length} snippet(s): ${snippets.join(', ')}`);
  return snippets;
}

/**
 * Load a specific snippet by name
 */
export function loadSnippet(snippetName: string): SnippetDefinition | null {
  if (loadedSnippets.has(snippetName)) {
    return loadedSnippets.get(snippetName)!;
  }

  const snippetsDir = path.join(globalsDirectory, 'snippets');
  const snippetPath = path.join(snippetsDir, `${snippetName}.snippet.json`);
  const altPath = path.join(snippetsDir, `${snippetName}.testblocks.json`);

  let filePath: string | null = null;
  if (fs.existsSync(snippetPath)) {
    filePath = snippetPath;
  } else if (fs.existsSync(altPath)) {
    filePath = altPath;
  }

  if (!filePath) {
    console.error(`Snippet not found: ${snippetName}`);
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const snippet = JSON.parse(content) as SnippetDefinition;

    // Ensure name is set
    if (!snippet.name) {
      snippet.name = snippetName;
    }

    loadedSnippets.set(snippetName, snippet);
    console.log(`Loaded snippet: ${snippetName}`);

    // Register as a block
    registerSnippetAsBlock(snippet);

    return snippet;
  } catch (error) {
    console.error(`Failed to load snippet ${snippetName}:`, error);
    return null;
  }
}

/**
 * Load all discovered snippets
 */
export function loadAllSnippets(): void {
  const snippetNames = discoverSnippets();
  for (const name of snippetNames) {
    loadSnippet(name);
  }
}

/**
 * Register a snippet as a custom composite block
 */
function registerSnippetAsBlock(snippet: SnippetDefinition): void {
  const blockType = `snippet_${snippet.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

  // Check if already registered
  if (getBlock(blockType)) {
    return;
  }

  const blockDef: BlockDefinition = {
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
    execute: async (params, context) => {
      context.logger.info(`Executing snippet: ${snippet.name}`);

      // Set snippet parameters as variables
      if (snippet.params) {
        for (const param of snippet.params) {
          const value = params[param.name.toUpperCase()] ?? param.default;
          context.variables.set(`snippet_${param.name}`, value);
        }
      }

      // Return the steps to be executed by the executor
      return {
        compoundAction: `snippet:${snippet.name}`,
        steps: snippet.steps,
        _summary: `Run snippet: ${snippet.name}`,
      };
    },
  };

  registerBlock(blockDef);
  console.log(`Registered snippet block: ${blockType}`);
}

/**
 * Get a loaded snippet by name
 */
export function getSnippet(snippetName: string): SnippetDefinition | undefined {
  return loadedSnippets.get(snippetName);
}

/**
 * Get all loaded snippets
 */
export function getAllSnippets(): SnippetDefinition[] {
  return Array.from(loadedSnippets.values());
}

/**
 * Initialize globals and snippets from a directory
 */
export function initializeGlobalsAndSnippets(dir?: string): void {
  if (dir) {
    setGlobalsDirectory(dir);
  }
  loadGlobals();
  loadAllSnippets();
}

/**
 * Clear loaded globals and snippets
 */
export function clearGlobalsAndSnippets(): void {
  loadedGlobals = {};
  loadedSnippets.clear();
}
