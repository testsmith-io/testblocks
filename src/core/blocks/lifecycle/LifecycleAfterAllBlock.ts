import { Block } from '../base';
import { BlockInput, ExecutionContext } from '../../types';

/**
 * Steps to run once after all tests in the suite.
 */
export class LifecycleAfterAllBlock extends Block {
  readonly type = 'lifecycle_after_all';
  readonly category = 'Lifecycle';
  readonly color = '#8E24AA';
  readonly tooltip = 'Steps to run once after all tests in the suite';
  readonly previousStatement = false;
  readonly nextStatement = false;

  getInputs(): BlockInput[] {
    return [
      { name: 'DO', type: 'statement' },
    ];
  }

  async execute(_params: Record<string, unknown>, _context: ExecutionContext): Promise<unknown> {
    return { lifecycle: 'afterAll', statement: 'DO' };
  }
}
