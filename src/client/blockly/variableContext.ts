/**
 * Variable context for autocomplete suggestions.
 * Maintains the current scope of available variables based on editing context.
 */

export interface VariableInfo {
  name: string;
  scope: 'global' | 'file' | 'folder' | 'test' | 'procedure';
  value?: unknown;
  description?: string;
}

interface VariableContext {
  // Global variables from globals.json
  globalVariables: Record<string, unknown>;
  // File-level variables from testFile.variables
  fileVariables: Record<string, unknown>;
  // Current editing mode
  editingMode: 'file' | 'folder';
  // Procedure parameters (when editing inside a procedure)
  procedureParams: string[];
  // Data-driven test columns (when in a data-driven test)
  dataColumns: string[];
}

let context: VariableContext = {
  globalVariables: {},
  fileVariables: {},
  editingMode: 'file',
  procedureParams: [],
  dataColumns: [],
};

/**
 * Set the global variables (from globals.json)
 */
export function setGlobalVariables(vars: Record<string, unknown> | null): void {
  context.globalVariables = vars || {};
}

/**
 * Set the file-level variables (from testFile.variables)
 */
export function setFileVariables(vars: Record<string, unknown> | null): void {
  context.fileVariables = vars || {};
}

/**
 * Set the current editing mode (file or folder hooks)
 */
export function setEditingMode(mode: 'file' | 'folder'): void {
  context.editingMode = mode;
}

/**
 * Set procedure parameters (when editing inside a procedure/custom block)
 */
export function setProcedureParams(params: string[]): void {
  context.procedureParams = params;
}

/**
 * Set data-driven test columns (from CSV header)
 */
export function setDataColumns(columns: string[]): void {
  context.dataColumns = columns;
}

/**
 * Flatten nested object keys into dot-notation paths
 * e.g., { user: { email: "test" } } -> ["user.email"]
 */
function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      // Recurse into nested objects
      keys.push(...flattenKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }

  return keys;
}

/**
 * Get value at a dot-notation path
 */
function getValueAtPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Get all available variables for autocomplete based on current context
 */
export function getAvailableVariables(): VariableInfo[] {
  const variables: VariableInfo[] = [];

  // Global variables are always available
  const globalKeys = flattenKeys(context.globalVariables);
  for (const key of globalKeys) {
    const value = getValueAtPath(context.globalVariables, key);
    variables.push({
      name: key,
      scope: 'global',
      value,
      description: `Global: ${formatValue(value)}`,
    });
  }

  // File variables (not available in folder hooks mode)
  if (context.editingMode === 'file') {
    for (const [key, def] of Object.entries(context.fileVariables)) {
      const value = typeof def === 'object' && def !== null && 'default' in def
        ? (def as { default: unknown }).default
        : def;
      variables.push({
        name: key,
        scope: 'file',
        value,
        description: `File: ${formatValue(value)}`,
      });
    }
  }

  // Procedure parameters
  for (const param of context.procedureParams) {
    variables.push({
      name: param,
      scope: 'procedure',
      description: 'Procedure parameter',
    });
  }

  // Data-driven test columns
  for (const column of context.dataColumns) {
    variables.push({
      name: column,
      scope: 'test',
      description: 'Data column',
    });
  }

  return variables;
}

/**
 * Get filtered variable suggestions based on search text
 */
export function getVariableSuggestions(searchText: string): VariableInfo[] {
  const variables = getAvailableVariables();

  if (!searchText) {
    return variables;
  }

  const search = searchText.toLowerCase();
  return variables.filter(v => v.name.toLowerCase().includes(search));
}

/**
 * Format a value for display in the description
 */
function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') {
    return value.length > 30 ? `"${value.substring(0, 30)}..."` : `"${value}"`;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.length} items]`;
  }
  if (typeof value === 'object') {
    return '{...}';
  }
  return String(value);
}

/**
 * Get the current context (for debugging)
 */
export function getContext(): VariableContext {
  return { ...context };
}
