import { StatementBlock } from '../base';
import { BlockInput, ExecutionContext } from '../../types';

/**
 * Retry steps on failure.
 */
export class LifecycleRetryBlock extends StatementBlock {
  readonly type = 'lifecycle_retry';
  readonly category = 'Lifecycle';
  readonly color = '#FF6F00';
  readonly tooltip = 'Retry steps on failure';

  getInputs(): BlockInput[] {
    return [
      { name: 'TIMES', type: 'field', fieldType: 'number', default: 3 },
      { name: 'DELAY', type: 'field', fieldType: 'number', default: 1000 },
      { name: 'DO', type: 'statement' },
    ];
  }

  async execute(params: Record<string, unknown>, _context: ExecutionContext): Promise<unknown> {
    const times = params.TIMES as number;
    const delay = params.DELAY as number;

    return { retry: true, times, delay, statement: 'DO' };
  }
}
