import { BlockDefinition, ExecutionContext, ProcedureDefinition } from '../types';

// Procedure registry for runtime
const procedureRegistry = new Map<string, ProcedureDefinition>();

export function registerProcedure(name: string, procedure: ProcedureDefinition): void {
  procedureRegistry.set(name, procedure);
}

export function getProcedure(name: string): ProcedureDefinition | undefined {
  return procedureRegistry.get(name);
}

export function clearProcedures(): void {
  procedureRegistry.clear();
}

// Procedure Blocks - Custom Reusable Actions
export const procedureBlocks: BlockDefinition[] = [
  // Define a procedure (function)
  {
    type: 'procedure_define',
    category: 'Procedures',
    color: '#9C27B0',
    tooltip: 'Define a reusable procedure with parameters',
    inputs: [
      { name: 'NAME', type: 'field', fieldType: 'text', required: true },
      { name: 'DESCRIPTION', type: 'field', fieldType: 'text', default: '' },
      { name: 'PARAMS', type: 'field', fieldType: 'text', default: '' }, // comma-separated: "username, password, timeout"
      { name: 'DO', type: 'statement' },
    ],
    execute: async (params, context) => {
      const name = params.NAME as string;
      const description = params.DESCRIPTION as string;
      const paramsStr = params.PARAMS as string;

      // Parse parameters
      const procedureParams = paramsStr
        .split(',')
        .map(p => p.trim())
        .filter(p => p)
        .map(p => {
          // Support type annotations: "username:string", "count:number"
          const [paramName, paramType] = p.split(':').map(s => s.trim());
          return {
            name: paramName,
            type: (paramType as 'string' | 'number' | 'boolean' | 'any') || 'any',
          };
        });

      // Register the procedure
      const procedure: ProcedureDefinition = {
        name,
        description,
        params: procedureParams,
        steps: [], // Steps will be extracted by the executor
      };

      registerProcedure(name, procedure);

      if (context.procedures) {
        context.procedures.set(name, procedure);
      }

      context.logger.debug(`Defined procedure: ${name}(${procedureParams.map(p => p.name).join(', ')})`);

      return { procedureDefine: true, name, procedure };
    },
  },

  // Call a procedure
  {
    type: 'procedure_call',
    category: 'Procedures',
    color: '#9C27B0',
    tooltip: 'Call a defined procedure',
    inputs: [
      { name: 'NAME', type: 'field', fieldType: 'text', required: true },
      { name: 'ARGS', type: 'field', fieldType: 'text', default: '' }, // JSON object or comma-separated values
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      const name = params.NAME as string;
      const argsStr = resolveVariables(params.ARGS as string, context);

      // Look up procedure
      const procedure = context.procedures?.get(name) || getProcedure(name);

      if (!procedure) {
        throw new Error(`Procedure not found: ${name}`);
      }

      // Parse arguments
      let args: Record<string, unknown> = {};

      if (argsStr.trim()) {
        try {
          // Try JSON format first: {"username": "test", "password": "123"}
          args = JSON.parse(argsStr);
        } catch {
          // Fall back to comma-separated values matching parameter order
          const values = argsStr.split(',').map(v => {
            const trimmed = v.trim();
            try {
              return JSON.parse(trimmed);
            } catch {
              return trimmed;
            }
          });

          if (procedure.params) {
            procedure.params.forEach((param, index) => {
              if (index < values.length) {
                args[param.name] = values[index];
              } else if (param.default !== undefined) {
                args[param.name] = param.default;
              }
            });
          }
        }
      }

      context.logger.info(`Calling procedure: ${name}`);

      return { procedureCall: true, name, args, procedure };
    },
  },

  // Call procedure with return value
  {
    type: 'procedure_call_with_return',
    category: 'Procedures',
    color: '#9C27B0',
    tooltip: 'Call a procedure and get return value',
    inputs: [
      { name: 'NAME', type: 'field', fieldType: 'text', required: true },
      { name: 'ARGS', type: 'field', fieldType: 'text', default: '' },
    ],
    output: { type: ['String', 'Number', 'Boolean', 'Object', 'Array'] },
    execute: async (params, context) => {
      const name = params.NAME as string;
      const argsStr = resolveVariables(params.ARGS as string, context);

      const procedure = context.procedures?.get(name) || getProcedure(name);

      if (!procedure) {
        throw new Error(`Procedure not found: ${name}`);
      }

      let args: Record<string, unknown> = {};
      if (argsStr.trim()) {
        try {
          args = JSON.parse(argsStr);
        } catch {
          const values = argsStr.split(',').map(v => v.trim());
          if (procedure.params) {
            procedure.params.forEach((param, index) => {
              if (index < values.length) {
                args[param.name] = values[index];
              }
            });
          }
        }
      }

      return { procedureCall: true, name, args, procedure, expectReturn: true };
    },
  },

  // Return from procedure
  {
    type: 'procedure_return',
    category: 'Procedures',
    color: '#9C27B0',
    tooltip: 'Return a value from a procedure',
    inputs: [
      { name: 'VALUE', type: 'value' },
    ],
    previousStatement: true,
    execute: async (params, _context) => {
      const value = params.VALUE;
      return { procedureReturn: true, value };
    },
  },

  // Get procedure parameter
  {
    type: 'procedure_get_param',
    category: 'Procedures',
    color: '#9C27B0',
    tooltip: 'Get a procedure parameter value',
    inputs: [
      { name: 'NAME', type: 'field', fieldType: 'text', required: true },
    ],
    output: { type: ['String', 'Number', 'Boolean', 'Object', 'Array'] },
    execute: async (params, context) => {
      const name = params.NAME as string;

      // Parameters are stored in variables with a prefix
      const value = context.variables.get(`__param_${name}`);

      if (value === undefined) {
        // Check regular variables as fallback
        return context.variables.get(name);
      }

      return value;
    },
  },

  // Define inline procedure (lambda-style)
  {
    type: 'procedure_inline',
    category: 'Procedures',
    color: '#9C27B0',
    tooltip: 'Define and immediately use an inline procedure',
    inputs: [
      { name: 'PARAMS', type: 'field', fieldType: 'text', default: '' },
      { name: 'DO', type: 'statement' },
    ],
    output: { type: 'Procedure' },
    execute: async (params, _context) => {
      return {
        inlineProcedure: true,
        params: (params.PARAMS as string).split(',').map(p => p.trim()).filter(p => p),
        statement: 'DO',
      };
    },
  },

  // Apply/Map procedure to array
  {
    type: 'procedure_map',
    category: 'Procedures',
    color: '#9C27B0',
    tooltip: 'Apply a procedure to each item in an array',
    inputs: [
      { name: 'ARRAY', type: 'value', check: 'Array', required: true },
      { name: 'PROCEDURE', type: 'field', fieldType: 'text', required: true },
      { name: 'ITEM_PARAM', type: 'field', fieldType: 'text', default: 'item' },
    ],
    output: { type: 'Array' },
    execute: async (params, _context) => {
      const array = params.ARRAY as unknown[];
      const procedureName = params.PROCEDURE as string;
      const itemParam = params.ITEM_PARAM as string;

      return {
        procedureMap: true,
        array,
        procedureName,
        itemParam,
      };
    },
  },

  // Common action blocks - frequently used patterns

  // Login procedure template
  {
    type: 'procedure_login',
    category: 'Procedures',
    color: '#AB47BC',
    tooltip: 'Common login action with username and password',
    inputs: [
      { name: 'USERNAME_SELECTOR', type: 'field', fieldType: 'text', default: '#username' },
      { name: 'PASSWORD_SELECTOR', type: 'field', fieldType: 'text', default: '#password' },
      { name: 'SUBMIT_SELECTOR', type: 'field', fieldType: 'text', default: 'button[type="submit"]' },
      { name: 'USERNAME', type: 'value', check: 'String', required: true },
      { name: 'PASSWORD', type: 'value', check: 'String', required: true },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, _context) => {
      // This is a compound action that expands to multiple steps
      return {
        compoundAction: 'login',
        steps: [
          { type: 'web_fill', params: { SELECTOR: params.USERNAME_SELECTOR, VALUE: params.USERNAME } },
          { type: 'web_fill', params: { SELECTOR: params.PASSWORD_SELECTOR, VALUE: params.PASSWORD } },
          { type: 'web_click', params: { SELECTOR: params.SUBMIT_SELECTOR } },
        ],
      };
    },
  },

  // Wait for element and click
  {
    type: 'procedure_wait_and_click',
    category: 'Procedures',
    color: '#AB47BC',
    tooltip: 'Wait for element to be visible then click',
    inputs: [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
      { name: 'TIMEOUT', type: 'field', fieldType: 'number', default: 30000 },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, _context) => {
      return {
        compoundAction: 'waitAndClick',
        steps: [
          { type: 'web_wait_for_element', params: { SELECTOR: params.SELECTOR, STATE: 'visible', TIMEOUT: params.TIMEOUT } },
          { type: 'web_click', params: { SELECTOR: params.SELECTOR } },
        ],
      };
    },
  },

  // Fill form fields from object
  {
    type: 'procedure_fill_form',
    category: 'Procedures',
    color: '#AB47BC',
    tooltip: 'Fill multiple form fields from a data object',
    inputs: [
      { name: 'FIELDS', type: 'value', check: 'Object', required: true },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, _context) => {
      const fields = params.FIELDS as Record<string, string>;

      const steps = Object.entries(fields).map(([selector, value]) => ({
        type: 'web_fill',
        params: { SELECTOR: selector, VALUE: value },
      }));

      return { compoundAction: 'fillForm', steps };
    },
  },
];

// Helper function
function resolveVariables(text: string, context: ExecutionContext): string {
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
