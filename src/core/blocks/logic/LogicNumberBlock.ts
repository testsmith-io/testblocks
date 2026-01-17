import { ValueBlock } from '../base';
import { BlockInput, BlockOutput, ExecutionContext } from '../../types';

/**
 * A number value.
 */
export class LogicNumberBlock extends ValueBlock {
  readonly type = 'logic_number';
  readonly category = 'Logic';
  readonly color = '#795548';
  readonly tooltip = 'A number value';
  readonly output: BlockOutput = { type: 'Number' };

  getInputs(): BlockInput[] {
    return [
      { name: 'NUM', type: 'field', fieldType: 'number', default: 0 },
    ];
  }

  async execute(params: Record<string, unknown>, _context: ExecutionContext): Promise<unknown> {
    return params.NUM;
  }
}
