import { StatementBlock } from '../base';
import { BlockInput, ExecutionContext } from '../../types';

/**
 * Steps to run only if the test fails.
 */
export class LifecycleOnFailureBlock extends StatementBlock {
  readonly type = 'lifecycle_on_failure';
  readonly category = 'Lifecycle';
  readonly color = '#C62828';
  readonly tooltip = 'Steps to run only if the test fails';

  getInputs(): BlockInput[] {
    return [
      { name: 'DO', type: 'statement' },
    ];
  }

  async execute(_params: Record<string, unknown>, _context: ExecutionContext): Promise<unknown> {
    return { lifecycle: 'onFailure', statement: 'DO' };
  }
}
