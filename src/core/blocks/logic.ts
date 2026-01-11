import { BlockDefinition, ExecutionContext } from '../types';
import { handleAssertion } from './assertions';

// Logic and Control Flow Blocks
export const logicBlocks: BlockDefinition[] = [
  // Set Variable
  {
    type: 'logic_set_variable',
    category: 'Logic',
    color: '#795548',
    tooltip: 'Set a variable value',
    inputs: [
      { name: 'NAME', type: 'field', fieldType: 'text', required: true },
      { name: 'VALUE', type: 'value', required: true },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      const name = params.NAME as string;
      const value = params.VALUE;

      context.variables.set(name, value);
      context.logger.debug(`Set variable ${name} = ${JSON.stringify(value)}`);
    },
  },

  // Get Variable
  {
    type: 'logic_get_variable',
    category: 'Logic',
    color: '#795548',
    tooltip: 'Get a variable value',
    inputs: [
      { name: 'NAME', type: 'field', fieldType: 'text', required: true },
    ],
    output: { type: ['String', 'Number', 'Boolean', 'Object', 'Array'] },
    execute: async (params, context) => {
      const name = params.NAME as string;
      return context.variables.get(name);
    },
  },

  // If Condition
  {
    type: 'logic_if',
    category: 'Logic',
    color: '#5C6BC0',
    tooltip: 'Execute blocks if condition is true',
    inputs: [
      { name: 'CONDITION', type: 'value', check: 'Boolean', required: true },
      { name: 'DO', type: 'statement' },
      { name: 'ELSE', type: 'statement' },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, _context) => {
      const condition = params.CONDITION as boolean;

      if (condition && params.DO) {
        // Execute DO block - handled by executor
        return { branch: 'DO' };
      } else if (!condition && params.ELSE) {
        // Execute ELSE block - handled by executor
        return { branch: 'ELSE' };
      }
    },
  },

  // Compare Values
  {
    type: 'logic_compare',
    category: 'Logic',
    color: '#5C6BC0',
    tooltip: 'Compare two values',
    inputs: [
      { name: 'A', type: 'value', required: true },
      { name: 'OP', type: 'field', fieldType: 'dropdown', options: [['=', 'eq'], ['≠', 'neq'], ['<', 'lt'], ['≤', 'lte'], ['>', 'gt'], ['≥', 'gte'], ['contains', 'contains']] },
      { name: 'B', type: 'value', required: true },
    ],
    output: { type: 'Boolean' },
    execute: async (params, _context) => {
      const a = params.A;
      const b = params.B;
      const op = params.OP as string;

      switch (op) {
        case 'eq':
          return JSON.stringify(a) === JSON.stringify(b);
        case 'neq':
          return JSON.stringify(a) !== JSON.stringify(b);
        case 'lt':
          return (a as number) < (b as number);
        case 'lte':
          return (a as number) <= (b as number);
        case 'gt':
          return (a as number) > (b as number);
        case 'gte':
          return (a as number) >= (b as number);
        case 'contains':
          if (typeof a === 'string') return a.includes(b as string);
          if (Array.isArray(a)) return a.includes(b);
          return false;
        default:
          return false;
      }
    },
  },

  // Boolean Operations
  {
    type: 'logic_boolean_op',
    category: 'Logic',
    color: '#5C6BC0',
    tooltip: 'Combine boolean values',
    inputs: [
      { name: 'A', type: 'value', check: 'Boolean', required: true },
      { name: 'OP', type: 'field', fieldType: 'dropdown', options: [['and', 'and'], ['or', 'or']] },
      { name: 'B', type: 'value', check: 'Boolean', required: true },
    ],
    output: { type: 'Boolean' },
    execute: async (params) => {
      const a = params.A as boolean;
      const b = params.B as boolean;
      const op = params.OP as string;

      return op === 'and' ? a && b : a || b;
    },
  },

  // Not
  {
    type: 'logic_not',
    category: 'Logic',
    color: '#5C6BC0',
    tooltip: 'Negate a boolean value',
    inputs: [
      { name: 'VALUE', type: 'value', check: 'Boolean', required: true },
    ],
    output: { type: 'Boolean' },
    execute: async (params) => {
      return !(params.VALUE as boolean);
    },
  },

  // Loop (repeat n times)
  {
    type: 'logic_repeat',
    category: 'Logic',
    color: '#5C6BC0',
    tooltip: 'Repeat blocks a specified number of times',
    inputs: [
      { name: 'TIMES', type: 'field', fieldType: 'number', default: 10, required: true },
      { name: 'DO', type: 'statement' },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, _context) => {
      const times = params.TIMES as number;
      return { loop: true, times, statement: 'DO' };
    },
  },

  // For Each
  {
    type: 'logic_foreach',
    category: 'Logic',
    color: '#5C6BC0',
    tooltip: 'Iterate over an array',
    inputs: [
      { name: 'ARRAY', type: 'value', check: 'Array', required: true },
      { name: 'VAR', type: 'field', fieldType: 'text', default: 'item', required: true },
      { name: 'DO', type: 'statement' },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, _context) => {
      const array = params.ARRAY as unknown[];
      const varName = params.VAR as string;
      return { loop: true, array, varName, statement: 'DO' };
    },
  },

  // Try/Catch
  {
    type: 'logic_try_catch',
    category: 'Logic',
    color: '#5C6BC0',
    tooltip: 'Handle errors gracefully',
    inputs: [
      { name: 'TRY', type: 'statement' },
      { name: 'CATCH', type: 'statement' },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (_params, _context) => {
      return { tryCatch: true };
    },
  },

  // Log Message
  {
    type: 'logic_log',
    category: 'Logic',
    color: '#607D8B',
    tooltip: 'Log a message',
    inputs: [
      { name: 'LEVEL', type: 'field', fieldType: 'dropdown', options: [['Info', 'info'], ['Warning', 'warn'], ['Error', 'error'], ['Debug', 'debug']] },
      { name: 'MESSAGE', type: 'field', fieldType: 'text', required: true },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      const level = (params.LEVEL as 'info' | 'warn' | 'error' | 'debug') || 'info';
      const message = resolveVariables(params.MESSAGE as string, context);

      context.logger[level](message);
      return { _message: message, _summary: message };
    },
  },

  // Comment (no-op, for documentation)
  {
    type: 'logic_comment',
    category: 'Logic',
    color: '#9E9E9E',
    tooltip: 'Add a comment (does nothing)',
    inputs: [
      { name: 'TEXT', type: 'field', fieldType: 'text', default: 'Comment' },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async () => {
      // No-op
    },
  },

  // Text/String block
  {
    type: 'logic_text',
    category: 'Logic',
    color: '#795548',
    tooltip: 'A text value',
    inputs: [
      { name: 'TEXT', type: 'field', fieldType: 'text', default: '' },
    ],
    output: { type: 'String' },
    execute: async (params, context) => {
      return resolveVariables(params.TEXT as string, context);
    },
  },

  // Number block
  {
    type: 'logic_number',
    category: 'Logic',
    color: '#795548',
    tooltip: 'A number value',
    inputs: [
      { name: 'NUM', type: 'field', fieldType: 'number', default: 0 },
    ],
    output: { type: 'Number' },
    execute: async (params) => {
      return params.NUM;
    },
  },

  // Boolean block
  {
    type: 'logic_boolean',
    category: 'Logic',
    color: '#795548',
    tooltip: 'A boolean value',
    inputs: [
      { name: 'BOOL', type: 'field', fieldType: 'dropdown', options: [['true', 'true'], ['false', 'false']] },
    ],
    output: { type: 'Boolean' },
    execute: async (params) => {
      return params.BOOL === 'true';
    },
  },

  // Create Object
  {
    type: 'logic_object',
    category: 'Logic',
    color: '#795548',
    tooltip: 'Create a JSON object',
    inputs: [
      { name: 'JSON', type: 'field', fieldType: 'text', default: '{}' },
    ],
    output: { type: 'Object' },
    execute: async (params, context) => {
      const json = resolveVariables(params.JSON as string, context);
      return JSON.parse(json);
    },
  },

  // Create Array
  {
    type: 'logic_array',
    category: 'Logic',
    color: '#795548',
    tooltip: 'Create an array',
    inputs: [
      { name: 'JSON', type: 'field', fieldType: 'text', default: '[]' },
    ],
    output: { type: 'Array' },
    execute: async (params, context) => {
      const json = resolveVariables(params.JSON as string, context);
      return JSON.parse(json);
    },
  },

  // Fail Test
  {
    type: 'logic_fail',
    category: 'Logic',
    color: '#f44336',
    tooltip: 'Fail the test with a message',
    inputs: [
      { name: 'MESSAGE', type: 'field', fieldType: 'text', default: 'Test failed' },
    ],
    previousStatement: true,
    execute: async (params, context) => {
      const message = resolveVariables(params.MESSAGE as string, context);
      throw new Error(message);
    },
  },

  // Assert
  {
    type: 'logic_assert',
    category: 'Logic',
    color: '#FF9800',
    tooltip: 'Assert a condition is true',
    inputs: [
      { name: 'CONDITION', type: 'value', check: 'Boolean', required: true },
      { name: 'MESSAGE', type: 'field', fieldType: 'text', default: 'Assertion failed' },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      const condition = params.CONDITION as boolean;
      const message = resolveVariables(params.MESSAGE as string, context);

      handleAssertion(
        context,
        condition,
        message,
        { stepType: 'logic_assert', expected: true, actual: condition }
      );

      context.logger.info('✓ Assertion passed');
    },
  },
];

// Helper function
function resolveVariables(text: string, context: ExecutionContext): string {
  // Match ${varName} or ${varName.property.path}
  return text.replace(/\$\{([\w.]+)\}/g, (match, path) => {
    const parts = path.split('.');
    const varName = parts[0];
    let value: unknown = context.variables.get(varName);

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
