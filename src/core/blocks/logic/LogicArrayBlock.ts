import { ValueBlock } from '../base';
import { BlockInput, BlockOutput, ExecutionContext } from '../../types';
import { resolveVariables } from '../utils';

/**
 * Create an array.
 */
export class LogicArrayBlock extends ValueBlock {
  readonly type = 'logic_array';
  readonly category = 'Logic';
  readonly color = '#795548';
  readonly tooltip = 'Create an array';
  readonly output: BlockOutput = { type: 'Array' };

  getInputs(): BlockInput[] {
    return [
      { name: 'JSON', type: 'field', fieldType: 'text', default: '[]' },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const json = resolveVariables(params.JSON as string, context);
    return JSON.parse(json);
  }
}
