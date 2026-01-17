import { ValueBlock } from '../base';
import { BlockInput, BlockOutput, ExecutionContext } from '../../types';

/**
 * Get the name of the current data set.
 */
export class DataGetNameBlock extends ValueBlock {
  readonly type = 'data_get_name';
  readonly category = 'Data';
  readonly color = '#00897B';
  readonly tooltip = 'Get the name of the current data set';
  readonly output: BlockOutput = { type: 'String' };

  getInputs(): BlockInput[] {
    return [];
  }

  async execute(_params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    return context.currentData?.name ?? `Iteration ${(context.dataIndex ?? 0) + 1}`;
  }
}
