import { Block } from '../base';
import { BlockInput, ExecutionContext } from '../../types';

/**
 * Steps to run before each test.
 */
export class LifecycleBeforeEachBlock extends Block {
  readonly type = 'lifecycle_before_each';
  readonly category = 'Lifecycle';
  readonly color = '#8E24AA';
  readonly tooltip = 'Steps to run before each test';
  readonly previousStatement = false;
  readonly nextStatement = false;

  getInputs(): BlockInput[] {
    return [
      { name: 'DO', type: 'statement' },
    ];
  }

  async execute(_params: Record<string, unknown>, _context: ExecutionContext): Promise<unknown> {
    return { lifecycle: 'beforeEach', statement: 'DO' };
  }
}
