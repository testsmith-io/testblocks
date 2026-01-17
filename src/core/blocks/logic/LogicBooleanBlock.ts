import { ValueBlock } from '../base';
import { BlockInput, BlockOutput, ExecutionContext } from '../../types';

/**
 * A boolean value.
 */
export class LogicBooleanBlock extends ValueBlock {
  readonly type = 'logic_boolean';
  readonly category = 'Logic';
  readonly color = '#795548';
  readonly tooltip = 'A boolean value';
  readonly output: BlockOutput = { type: 'Boolean' };

  getInputs(): BlockInput[] {
    return [
      { name: 'BOOL', type: 'field', fieldType: 'dropdown', options: [['true', 'true'], ['false', 'false']] },
    ];
  }

  async execute(params: Record<string, unknown>, _context: ExecutionContext): Promise<unknown> {
    return params.BOOL === 'true';
  }
}
