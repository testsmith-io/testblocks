import { ValueBlock } from '../base';
import { BlockInput, BlockOutput, ExecutionContext } from '../../types';
import { resolveVariables } from '../utils';

/**
 * Define test data sets for data-driven testing.
 */
export class DataDefineBlock extends ValueBlock {
  readonly type = 'data_define';
  readonly category = 'Data';
  readonly color = '#00897B';
  readonly tooltip = 'Define test data sets for data-driven testing';
  readonly output: BlockOutput = { type: 'Array' };

  getInputs(): BlockInput[] {
    return [
      { name: 'DATA_JSON', type: 'field', fieldType: 'text', default: '[{"name": "test1", "value": 1}]' },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const json = resolveVariables(params.DATA_JSON as string, context);
    return JSON.parse(json);
  }
}
