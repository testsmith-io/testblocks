import { ExecutionContext } from '../../types';

/**
 * Resolve variable references in a text string.
 * Supports ${varName} and ${varName.property.path} syntax.
 *
 * @param text - The text containing variable references
 * @param context - The execution context containing variables
 * @returns The text with variables resolved
 */
export function resolveVariables(text: string, context: ExecutionContext): string {
  // Match ${varName} or ${varName.property.path}
  return text.replace(/\$\{([\w.]+)\}/g, (match, path) => {
    const parts = path.split('.');
    const varName = parts[0];

    // Check param prefix first (for procedures)
    let value: unknown = context.variables.get(`__param_${varName}`);

    // Then check current data (for data-driven tests)
    if (value === undefined && context.currentData?.values[varName] !== undefined) {
      value = context.currentData.values[varName];
    }

    // Then check regular variables
    if (value === undefined) {
      value = context.variables.get(varName);
    }

    // Navigate through object properties if path has dots
    if (parts.length > 1 && value !== undefined && value !== null) {
      for (let i = 1; i < parts.length; i++) {
        if (value === undefined || value === null) break;
        value = (value as Record<string, unknown>)[parts[i]];
      }
    }

    if (value === undefined || value === null) {
      return match; // Keep original if not found
    }

    // Return stringified value
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  });
}

/**
 * Simple variable resolution that only handles ${varName} syntax.
 * Used in data-driven contexts where nested paths are not needed.
 *
 * @param text - The text containing variable references
 * @param context - The execution context
 * @returns The text with variables resolved
 */
export function resolveSimpleVariables(text: string, context: ExecutionContext): string {
  return text.replace(/\$\{(\w+)\}/g, (_, varName) => {
    // Check param prefix first
    const paramValue = context.variables.get(`__param_${varName}`);
    if (paramValue !== undefined) {
      return String(paramValue);
    }
    // Then check current data
    if (context.currentData?.values[varName] !== undefined) {
      return String(context.currentData.values[varName]);
    }
    // Then regular variables
    const value = context.variables.get(varName);
    return value !== undefined ? String(value) : '';
  });
}
