import { StatementBlock } from '../base';
import { BlockInput, ExecutionContext } from '../../types';

/**
 * Add a comment (does nothing).
 */
export class LogicCommentBlock extends StatementBlock {
  readonly type = 'logic_comment';
  readonly category = 'Logic';
  readonly color = '#9E9E9E';
  readonly tooltip = 'Add a comment (does nothing)';

  getInputs(): BlockInput[] {
    return [
      { name: 'TEXT', type: 'field', fieldType: 'text', default: 'Comment' },
    ];
  }

  async execute(_params: Record<string, unknown>, _context: ExecutionContext): Promise<unknown> {
    // No-op
    return undefined;
  }
}
