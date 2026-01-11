import { ExecutionContext } from '../types';

/**
 * Utility class for resolving variable placeholders in strings
 */
export class VariableResolver {
  /**
   * Resolve ${variable} placeholders in a string using context variables and currentData
   * Supports dot notation for nested object access (e.g., ${user.email})
   */
  static resolve(text: string, context: ExecutionContext): string {
    if (typeof text !== 'string') return text;

    return text.replace(/\$\{([\w.]+)\}/g, (match, path) => {
      const parts = path.split('.');
      const varName = parts[0];

      // Check currentData first (for data-driven tests)
      if (context.currentData?.values[varName] !== undefined) {
        let value: unknown = context.currentData.values[varName];
        // Handle dot notation for nested access
        if (parts.length > 1 && value !== null && typeof value === 'object') {
          for (let i = 1; i < parts.length; i++) {
            if (value === undefined || value === null) break;
            value = (value as Record<string, unknown>)[parts[i]];
          }
        }
        if (value !== undefined && value !== null) {
          return typeof value === 'object' ? JSON.stringify(value) : String(value);
        }
      }

      // Then check context variables
      let value: unknown = context.variables.get(varName);
      if (parts.length > 1 && value !== undefined && value !== null) {
        for (let i = 1; i < parts.length; i++) {
          if (value === undefined || value === null) break;
          value = (value as Record<string, unknown>)[parts[i]];
        }
      }

      if (value === undefined || value === null) return match;
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
    });
  }

  /**
   * Resolve variables in an object recursively
   */
  static resolveObject(obj: unknown, context: ExecutionContext): unknown {
    if (typeof obj === 'string') {
      return this.resolve(obj, context);
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.resolveObject(item, context));
    }
    if (obj && typeof obj === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.resolveObject(value, context);
      }
      return result;
    }
    return obj;
  }

  /**
   * Check if a string contains variable placeholders
   */
  static hasVariables(text: string): boolean {
    return typeof text === 'string' && /\$\{[\w.]+\}/.test(text);
  }
}

/**
 * Resolve variable defaults from globals format
 * Handles objects with { type, default, description } structure
 */
export function resolveVariableDefaults(vars?: Record<string, unknown>): Record<string, unknown> {
  if (!vars) return {};

  const resolved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(vars)) {
    if (value && typeof value === 'object' && 'default' in value) {
      resolved[key] = (value as { default: unknown }).default;
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
}
