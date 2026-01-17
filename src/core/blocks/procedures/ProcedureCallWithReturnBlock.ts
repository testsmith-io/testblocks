import { ValueBlock } from '../base';
import { BlockInput, BlockOutput, ExecutionContext } from '../../types';
import { resolveVariables } from '../utils';
import { getProcedure } from './procedureRegistry';

/**
 * Call a procedure and get return value.
 */
export class ProcedureCallWithReturnBlock extends ValueBlock {
  readonly type = 'procedure_call_with_return';
  readonly category = 'Procedures';
  readonly color = '#9C27B0';
  readonly tooltip = 'Call a procedure and get return value';
  readonly output: BlockOutput = { type: ['String', 'Number', 'Boolean', 'Object', 'Array'] };

  getInputs(): BlockInput[] {
    return [
      { name: 'NAME', type: 'field', fieldType: 'text', required: true },
      { name: 'ARGS', type: 'field', fieldType: 'text', default: '' },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
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
  }
}
