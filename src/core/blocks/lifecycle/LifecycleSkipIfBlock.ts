import { StatementBlock } from '../base';
import { BlockInput, ExecutionContext } from '../../types';

/**
 * Skip the rest of the test if condition is true.
 */
export class LifecycleSkipIfBlock extends StatementBlock {
  readonly type = 'lifecycle_skip_if';
  readonly category = 'Lifecycle';
  readonly color = '#757575';
  readonly tooltip = 'Skip the rest of the test if condition is true';

  getInputs(): BlockInput[] {
    return [
      { name: 'CONDITION', type: 'value', check: 'Boolean', required: true },
      { name: 'REASON', type: 'field', fieldType: 'text', default: 'Condition not met' },
    ];
  }

  async execute(params: Record<string, unknown>, _context: ExecutionContext): Promise<unknown> {
    const condition = params.CONDITION as boolean;
    const reason = params.REASON as string;

    if (condition) {
      throw { skip: true, reason };
    }
    return undefined;
  }
}
