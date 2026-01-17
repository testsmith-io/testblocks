import { ValueBlock } from '../base';
import { BlockInput, BlockOutput, ExecutionContext } from '../../types';

/**
 * Get a value from the current data set.
 */
export class DataGetCurrentBlock extends ValueBlock {
  readonly type = 'data_get_current';
  readonly category = 'Data';
  readonly color = '#00897B';
  readonly tooltip = 'Get a value from the current data set';
  readonly output: BlockOutput = { type: ['String', 'Number', 'Boolean', 'Object', 'Array'] };

  getInputs(): BlockInput[] {
    return [
      { name: 'KEY', type: 'field', fieldType: 'text', required: true },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const key = params.KEY as string;

    if (!context.currentData) {
      throw new Error('No data set available. This block must be used inside a data-driven test.');
    }

    const value = context.currentData.values[key];
    if (value === undefined) {
      context.logger.warn(`Data key "${key}" not found in current data set`);
    }
    return value;
  }
}
