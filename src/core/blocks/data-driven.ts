import { BlockDefinition, ExecutionContext } from '../types';

// Data-Driven Testing Blocks
export const dataDrivenBlocks: BlockDefinition[] = [
  // Define test data inline
  {
    type: 'data_define',
    category: 'Data',
    color: '#00897B',
    tooltip: 'Define test data sets for data-driven testing',
    inputs: [
      { name: 'DATA_JSON', type: 'field', fieldType: 'text', default: '[{"name": "test1", "value": 1}]' },
    ],
    output: { type: 'Array' },
    execute: async (params, context) => {
      const json = resolveVariables(params.DATA_JSON as string, context);
      return JSON.parse(json);
    },
  },

  // Load data from variable
  {
    type: 'data_from_variable',
    category: 'Data',
    color: '#00897B',
    tooltip: 'Get test data from a variable',
    inputs: [
      { name: 'NAME', type: 'field', fieldType: 'text', required: true },
    ],
    output: { type: 'Array' },
    execute: async (params, context) => {
      const name = params.NAME as string;
      return context.variables.get(name) || [];
    },
  },

  // Get current data value
  {
    type: 'data_get_current',
    category: 'Data',
    color: '#00897B',
    tooltip: 'Get a value from the current data set',
    inputs: [
      { name: 'KEY', type: 'field', fieldType: 'text', required: true },
    ],
    output: { type: ['String', 'Number', 'Boolean', 'Object', 'Array'] },
    execute: async (params, context) => {
      const key = params.KEY as string;

      if (!context.currentData) {
        throw new Error('No data set available. This block must be used inside a data-driven test.');
      }

      const value = context.currentData.values[key];
      if (value === undefined) {
        context.logger.warn(`Data key "${key}" not found in current data set`);
      }
      return value;
    },
  },

  // Get current iteration index
  {
    type: 'data_get_index',
    category: 'Data',
    color: '#00897B',
    tooltip: 'Get the current data iteration index (0-based)',
    inputs: [],
    output: { type: 'Number' },
    execute: async (params, context) => {
      return context.dataIndex ?? 0;
    },
  },

  // Get current data set name
  {
    type: 'data_get_name',
    category: 'Data',
    color: '#00897B',
    tooltip: 'Get the name of the current data set',
    inputs: [],
    output: { type: 'String' },
    execute: async (params, context) => {
      return context.currentData?.name ?? `Iteration ${(context.dataIndex ?? 0) + 1}`;
    },
  },

  // For each data - iterate over data array
  {
    type: 'data_foreach',
    category: 'Data',
    color: '#00897B',
    tooltip: 'Run steps for each item in a data set',
    inputs: [
      { name: 'DATA', type: 'value', check: 'Array', required: true },
      { name: 'ITEM_VAR', type: 'field', fieldType: 'text', default: 'item' },
      { name: 'INDEX_VAR', type: 'field', fieldType: 'text', default: 'index' },
      { name: 'DO', type: 'statement' },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, _context) => {
      const data = params.DATA as unknown[];
      const itemVar = params.ITEM_VAR as string;
      const indexVar = params.INDEX_VAR as string;

      return {
        dataLoop: true,
        data,
        itemVar,
        indexVar,
        statement: 'DO',
      };
    },
  },

  // Create data row
  {
    type: 'data_row',
    category: 'Data',
    color: '#00897B',
    tooltip: 'Create a single data row with key-value pairs',
    inputs: [
      { name: 'NAME', type: 'field', fieldType: 'text', default: '' },
      { name: 'JSON', type: 'field', fieldType: 'text', default: '{}' },
    ],
    output: { type: 'Object' },
    execute: async (params, context) => {
      const name = params.NAME as string;
      const json = resolveVariables(params.JSON as string, context);

      return {
        name: name || undefined,
        values: JSON.parse(json),
      };
    },
  },

  // Data table - create multiple rows at once
  {
    type: 'data_table',
    category: 'Data',
    color: '#00897B',
    tooltip: 'Create a data table with headers and rows',
    inputs: [
      { name: 'HEADERS', type: 'field', fieldType: 'text', default: 'username, password, expected' },
      { name: 'ROWS', type: 'field', fieldType: 'text', default: 'user1, pass1, true\nuser2, pass2, false' },
    ],
    output: { type: 'Array' },
    execute: async (params, context) => {
      const headersStr = params.HEADERS as string;
      const rowsStr = resolveVariables(params.ROWS as string, context);

      const headers = headersStr.split(',').map(h => h.trim());
      const rows = rowsStr.split('\n').filter(r => r.trim());

      return rows.map((row, index) => {
        const values = row.split(',').map(v => {
          const trimmed = v.trim();
          // Try to parse as JSON for numbers, booleans, etc.
          try {
            return JSON.parse(trimmed);
          } catch {
            return trimmed;
          }
        });

        const obj: Record<string, unknown> = {};
        headers.forEach((header, i) => {
          obj[header] = values[i];
        });

        return {
          name: `Row ${index + 1}`,
          values: obj,
        };
      });
    },
  },

  // CSV-style data
  {
    type: 'data_csv',
    category: 'Data',
    color: '#00897B',
    tooltip: 'Parse CSV-style data (first row as headers)',
    inputs: [
      { name: 'CSV', type: 'field', fieldType: 'text', default: 'name,value\ntest1,100\ntest2,200' },
    ],
    output: { type: 'Array' },
    execute: async (params, context) => {
      const csv = resolveVariables(params.CSV as string, context);
      const lines = csv.split('\n').filter(l => l.trim());

      if (lines.length < 2) {
        return [];
      }

      const headers = lines[0].split(',').map(h => h.trim());

      return lines.slice(1).map((line, index) => {
        const values = line.split(',').map(v => {
          const trimmed = v.trim();
          try {
            return JSON.parse(trimmed);
          } catch {
            return trimmed;
          }
        });

        const obj: Record<string, unknown> = {};
        headers.forEach((header, i) => {
          obj[header] = values[i];
        });

        return {
          name: `Row ${index + 1}`,
          values: obj,
        };
      });
    },
  },

  // Generate range of numbers
  {
    type: 'data_range',
    category: 'Data',
    color: '#00897B',
    tooltip: 'Generate a range of numbers as data',
    inputs: [
      { name: 'START', type: 'field', fieldType: 'number', default: 1 },
      { name: 'END', type: 'field', fieldType: 'number', default: 10 },
      { name: 'STEP', type: 'field', fieldType: 'number', default: 1 },
      { name: 'VAR_NAME', type: 'field', fieldType: 'text', default: 'n' },
    ],
    output: { type: 'Array' },
    execute: async (params, _context) => {
      const start = params.START as number;
      const end = params.END as number;
      const step = params.STEP as number;
      const varName = params.VAR_NAME as string;

      const result = [];
      for (let i = start; i <= end; i += step) {
        result.push({
          name: `${varName}=${i}`,
          values: { [varName]: i },
        });
      }
      return result;
    },
  },
];

// Helper function
function resolveVariables(text: string, context: ExecutionContext): string {
  return text.replace(/\$\{(\w+)\}/g, (_, varName) => {
    // First check current data
    if (context.currentData?.values[varName] !== undefined) {
      return String(context.currentData.values[varName]);
    }
    // Then check variables
    const value = context.variables.get(varName);
    return value !== undefined ? String(value) : '';
  });
}
