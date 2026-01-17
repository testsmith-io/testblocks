import { ValueBlock } from '../base';
import { BlockInput, BlockOutput, ExecutionContext } from '../../types';

/**
 * Get a variable value.
 */
export class LogicGetVariableBlock extends ValueBlock {
  readonly type = 'logic_get_variable';
  readonly category = 'Logic';
  readonly color = '#795548';
  readonly tooltip = 'Get a variable value';
  readonly output: BlockOutput = { type: ['String', 'Number', 'Boolean', 'Object', 'Array'] };

  getInputs(): BlockInput[] {
    return [
      { name: 'NAME', type: 'field', fieldType: 'text', required: true },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const name = params.NAME as string;
    return context.variables.get(name);
  }
}
