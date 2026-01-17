import { ControlFlowBlock } from '../base';
import { BlockInput, ExecutionContext } from '../../types';

/**
 * Iterate over an array.
 */
export class LogicForeachBlock extends ControlFlowBlock {
  readonly type = 'logic_foreach';
  readonly category = 'Logic';
  readonly color = '#5C6BC0';
  readonly tooltip = 'Iterate over an array';

  getInputs(): BlockInput[] {
    return [
      { name: 'ARRAY', type: 'value', check: 'Array', required: true },
      { name: 'VAR', type: 'field', fieldType: 'text', default: 'item', required: true },
      { name: 'DO', type: 'statement' },
    ];
  }

  async execute(params: Record<string, unknown>, _context: ExecutionContext): Promise<unknown> {
    const array = params.ARRAY as unknown[];
    const varName = params.VAR as string;
    return { loop: true, array, varName, statement: 'DO' };
  }
}
