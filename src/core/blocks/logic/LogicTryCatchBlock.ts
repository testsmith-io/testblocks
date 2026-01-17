import { ControlFlowBlock } from '../base';
import { BlockInput, ExecutionContext } from '../../types';

/**
 * Handle errors gracefully.
 */
export class LogicTryCatchBlock extends ControlFlowBlock {
  readonly type = 'logic_try_catch';
  readonly category = 'Logic';
  readonly color = '#5C6BC0';
  readonly tooltip = 'Handle errors gracefully';

  getInputs(): BlockInput[] {
    return [
      { name: 'TRY', type: 'statement' },
      { name: 'CATCH', type: 'statement' },
    ];
  }

  async execute(_params: Record<string, unknown>, _context: ExecutionContext): Promise<unknown> {
    return { tryCatch: true };
  }
}
