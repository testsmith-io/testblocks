import { ValueBlock } from '../base';
import { BlockInput, BlockOutput, ExecutionContext } from '../../types';
import { resolveVariables } from '../utils';

/**
 * Create a single data row with key-value pairs.
 */
export class DataRowBlock extends ValueBlock {
  readonly type = 'data_row';
  readonly category = 'Data';
  readonly color = '#00897B';
  readonly tooltip = 'Create a single data row with key-value pairs';
  readonly output: BlockOutput = { type: 'Object' };

  getInputs(): BlockInput[] {
    return [
      { name: 'NAME', type: 'field', fieldType: 'text', default: '' },
      { name: 'JSON', type: 'field', fieldType: 'text', default: '{}' },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const name = params.NAME as string;
    const json = resolveVariables(params.JSON as string, context);

    return {
      name: name || undefined,
      values: JSON.parse(json),
    };
  }
}
