import { ValueBlock } from '../base';
import { BlockInput, BlockOutput, ExecutionContext } from '../../types';
import { resolveVariables } from '../utils';

/**
 * Create a JSON object.
 */
export class LogicObjectBlock extends ValueBlock {
  readonly type = 'logic_object';
  readonly category = 'Logic';
  readonly color = '#795548';
  readonly tooltip = 'Create a JSON object';
  readonly output: BlockOutput = { type: 'Object' };

  getInputs(): BlockInput[] {
    return [
      { name: 'JSON', type: 'field', fieldType: 'text', default: '{}' },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const json = resolveVariables(params.JSON as string, context);
    return JSON.parse(json);
  }
}
