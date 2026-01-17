import { StatementBlock } from '../base';
import { BlockInput, ExecutionContext } from '../../types';

/**
 * Teardown steps to run after the test.
 */
export class LifecycleTeardownBlock extends StatementBlock {
  readonly type = 'lifecycle_teardown';
  readonly category = 'Lifecycle';
  readonly color = '#8E24AA';
  readonly tooltip = 'Teardown steps to run after the test';

  getInputs(): BlockInput[] {
    return [
      { name: 'DESCRIPTION', type: 'field', fieldType: 'text', default: 'Teardown' },
      { name: 'DO', type: 'statement' },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    context.logger.info(`Teardown: ${params.DESCRIPTION}`);
    return { lifecycle: 'teardown', statement: 'DO' };
  }
}
