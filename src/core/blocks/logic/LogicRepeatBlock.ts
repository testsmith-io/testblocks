import { ControlFlowBlock } from '../base';
import { BlockInput, ExecutionContext } from '../../types';

/**
 * Repeat blocks a specified number of times.
 */
export class LogicRepeatBlock extends ControlFlowBlock {
  readonly type = 'logic_repeat';
  readonly category = 'Logic';
  readonly color = '#5C6BC0';
  readonly tooltip = 'Repeat blocks a specified number of times';

  getInputs(): BlockInput[] {
    return [
      { name: 'TIMES', type: 'field', fieldType: 'number', default: 10, required: true },
      { name: 'DO', type: 'statement' },
    ];
  }

  async execute(params: Record<string, unknown>, _context: ExecutionContext): Promise<unknown> {
    const times = params.TIMES as number;
    return { loop: true, times, statement: 'DO' };
  }
}
