import { ValueBlock } from '../base';
import { BlockInput, BlockOutput, ExecutionContext } from '../../types';

/**
 * Get test data from a variable.
 */
export class DataFromVariableBlock extends ValueBlock {
  readonly type = 'data_from_variable';
  readonly category = 'Data';
  readonly color = '#00897B';
  readonly tooltip = 'Get test data from a variable';
  readonly output: BlockOutput = { type: 'Array' };

  getInputs(): BlockInput[] {
    return [
      { name: 'NAME', type: 'field', fieldType: 'text', required: true },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const name = params.NAME as string;
    return context.variables.get(name) || [];
  }
}
