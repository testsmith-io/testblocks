import { StatementBlock } from '../../base';
import { BlockInput, ExecutionContext } from '../../../types';
import { PlaywrightPage } from '../types';
import { resolveSelector, getDisplaySelector, getExpect, executeWebAssertion, getTimeout } from '../utils';

/**
 * Assert that a container element is empty (auto-waits).
 */
export class WebAssertEmptyBlock extends StatementBlock {
  readonly type = 'web_assert_empty';
  readonly category = 'Web';
  readonly color = '#FF9800';
  readonly tooltip = 'Assert that a container element is empty (auto-waits)';

  getInputs(): BlockInput[] {
    return [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const page = context.page as PlaywrightPage;
    const selector = resolveSelector(params, context);
    const displaySelector = getDisplaySelector(params, context);
    const timeout = getTimeout(context);

    const expect = await getExpect();
    const locator = page.locator(selector);

    context.logger.info(`Asserting ${displaySelector} is empty`);
    await executeWebAssertion(
      context,
      async () => { await expect(locator).toBeEmpty({ timeout }); },
      `Expected element ${displaySelector} to be empty`,
      { stepType: 'web_assert_empty', expected: 'empty', actual: 'not empty' }
    );
    context.logger.info(`✓ Element ${displaySelector} is empty`);
    return {
      _summary: `${displaySelector} is empty`,
      selector,
      isEmpty: true,
    };
  }
}
