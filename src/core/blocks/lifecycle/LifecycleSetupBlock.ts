import { StatementBlock } from '../base';
import { BlockInput, ExecutionContext } from '../../types';

/**
 * Setup steps to run before the test.
 */
export class LifecycleSetupBlock extends StatementBlock {
  readonly type = 'lifecycle_setup';
  readonly category = 'Lifecycle';
  readonly color = '#8E24AA';
  readonly tooltip = 'Setup steps to run before the test';

  getInputs(): BlockInput[] {
    return [
      { name: 'DESCRIPTION', type: 'field', fieldType: 'text', default: 'Setup' },
      { name: 'DO', type: 'statement' },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    context.logger.info(`Setup: ${params.DESCRIPTION}`);
    return { lifecycle: 'setup', statement: 'DO' };
  }
}
