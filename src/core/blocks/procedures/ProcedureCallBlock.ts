import { StatementBlock } from '../base';
import { BlockInput, ExecutionContext } from '../../types';
import { resolveVariables } from '../utils';
import { getProcedure } from './procedureRegistry';

/**
 * Call a defined procedure.
 */
export class ProcedureCallBlock extends StatementBlock {
  readonly type = 'procedure_call';
  readonly category = 'Procedures';
  readonly color = '#9C27B0';
  readonly tooltip = 'Call a defined procedure';

  getInputs(): BlockInput[] {
    return [
      { name: 'NAME', type: 'field', fieldType: 'text', required: true },
      { name: 'ARGS', type: 'field', fieldType: 'text', default: '' }, // JSON object or comma-separated values
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
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
  }
}
