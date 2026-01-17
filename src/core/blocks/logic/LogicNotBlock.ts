import { ValueBlock } from '../base';
import { BlockInput, BlockOutput, ExecutionContext } from '../../types';

/**
 * Negate a boolean value.
 */
export class LogicNotBlock extends ValueBlock {
  readonly type = 'logic_not';
  readonly category = 'Logic';
  readonly color = '#5C6BC0';
  readonly tooltip = 'Negate a boolean value';
  readonly output: BlockOutput = { type: 'Boolean' };

  getInputs(): BlockInput[] {
    return [
      { name: 'VALUE', type: 'value', check: 'Boolean', required: true },
    ];
  }

  async execute(params: Record<string, unknown>, _context: ExecutionContext): Promise<unknown> {
    return !(params.VALUE as boolean);
  }
}
