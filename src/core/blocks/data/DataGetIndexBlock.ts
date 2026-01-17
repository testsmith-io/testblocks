import { ValueBlock } from '../base';
import { BlockInput, BlockOutput, ExecutionContext } from '../../types';

/**
 * Get the current data iteration index (0-based).
 */
export class DataGetIndexBlock extends ValueBlock {
  readonly type = 'data_get_index';
  readonly category = 'Data';
  readonly color = '#00897B';
  readonly tooltip = 'Get the current data iteration index (0-based)';
  readonly output: BlockOutput = { type: 'Number' };

  getInputs(): BlockInput[] {
    return [];
  }

  async execute(_params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    return context.dataIndex ?? 0;
  }
}
