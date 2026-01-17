import { ValueBlock } from '../base';
import { BlockInput, BlockOutput, ExecutionContext } from '../../types';

/**
 * Get a procedure parameter value.
 */
export class ProcedureGetParamBlock extends ValueBlock {
  readonly type = 'procedure_get_param';
  readonly category = 'Procedures';
  readonly color = '#9C27B0';
  readonly tooltip = 'Get a procedure parameter value';
  readonly output: BlockOutput = { type: ['String', 'Number', 'Boolean', 'Object', 'Array'] };

  getInputs(): BlockInput[] {
    return [
      { name: 'NAME', type: 'field', fieldType: 'text', required: true },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const name = params.NAME as string;

    // Parameters are stored in variables with a prefix
    const value = context.variables.get(`__param_${name}`);

    if (value === undefined) {
      // Check regular variables as fallback
      return context.variables.get(name);
    }

    return value;
  }
}
