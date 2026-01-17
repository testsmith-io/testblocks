import { ControlFlowBlock } from '../base';
import { BlockInput, ExecutionContext } from '../../types';

/**
 * Execute blocks if condition is true.
 */
export class LogicIfBlock extends ControlFlowBlock {
  readonly type = 'logic_if';
  readonly category = 'Logic';
  readonly color = '#5C6BC0';
  readonly tooltip = 'Execute blocks if condition is true';

  getInputs(): BlockInput[] {
    return [
      { name: 'CONDITION', type: 'value', check: 'Boolean', required: true },
      { name: 'DO', type: 'statement' },
      { name: 'ELSE', type: 'statement' },
    ];
  }

  async execute(params: Record<string, unknown>, _context: ExecutionContext): Promise<unknown> {
    const condition = params.CONDITION as boolean;

    if (condition && params.DO) {
      // Execute DO block - handled by executor
      return { branch: 'DO' };
    } else if (!condition && params.ELSE) {
      // Execute ELSE block - handled by executor
      return { branch: 'ELSE' };
    }
    return undefined;
  }
}
