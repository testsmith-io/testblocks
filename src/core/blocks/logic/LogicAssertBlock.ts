import { StatementBlock } from '../base';
import { BlockInput, ExecutionContext } from '../../types';
import { resolveVariables } from '../utils';
import { handleAssertion } from '../assertions';

/**
 * Assert a condition is true.
 */
export class LogicAssertBlock extends StatementBlock {
  readonly type = 'logic_assert';
  readonly category = 'Logic';
  readonly color = '#FF9800';
  readonly tooltip = 'Assert a condition is true';

  getInputs(): BlockInput[] {
    return [
      { name: 'CONDITION', type: 'value', check: 'Boolean', required: true },
      { name: 'MESSAGE', type: 'field', fieldType: 'text', default: 'Assertion failed' },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const condition = params.CONDITION as boolean;
    const message = resolveVariables(params.MESSAGE as string, context);

    handleAssertion(
      context,
      condition,
      message,
      { stepType: 'logic_assert', expected: true, actual: condition }
    );

    context.logger.info('✓ Assertion passed');
    return undefined;
  }
}
