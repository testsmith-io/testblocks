import { ValueBlock } from '../base';
import { BlockInput, BlockOutput, ExecutionContext } from '../../types';

/**
 * Combine boolean values.
 */
export class LogicBooleanOpBlock extends ValueBlock {
  readonly type = 'logic_boolean_op';
  readonly category = 'Logic';
  readonly color = '#5C6BC0';
  readonly tooltip = 'Combine boolean values';
  readonly output: BlockOutput = { type: 'Boolean' };

  getInputs(): BlockInput[] {
    return [
      { name: 'A', type: 'value', check: 'Boolean', required: true },
      { name: 'OP', type: 'field', fieldType: 'dropdown', options: [['and', 'and'], ['or', 'or']] },
      { name: 'B', type: 'value', check: 'Boolean', required: true },
    ];
  }

  async execute(params: Record<string, unknown>, _context: ExecutionContext): Promise<unknown> {
    const a = params.A as boolean;
    const b = params.B as boolean;
    const op = params.OP as string;

    return op === 'and' ? a && b : a || b;
  }
}
