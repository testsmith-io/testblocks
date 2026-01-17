import { ValueBlock } from '../base';
import { BlockInput, BlockOutput, ExecutionContext } from '../../types';
import { resolveVariables } from '../utils';

/**
 * A text value.
 */
export class LogicTextBlock extends ValueBlock {
  readonly type = 'logic_text';
  readonly category = 'Logic';
  readonly color = '#795548';
  readonly tooltip = 'A text value';
  readonly output: BlockOutput = { type: 'String' };

  getInputs(): BlockInput[] {
    return [
      { name: 'TEXT', type: 'field', fieldType: 'text', default: '' },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    return resolveVariables(params.TEXT as string, context);
  }
}
