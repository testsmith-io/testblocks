import { StatementBlock } from '../../base';
import { BlockInput, ExecutionContext } from '../../../types';
import { PlaywrightPage } from '../types';
import { resolveSelector, getDisplaySelector, getExpect, executeWebAssertion, getTimeout } from '../utils';

/**
 * Assert that an element is visible (auto-waits).
 */
export class WebAssertVisibleBlock extends StatementBlock {
  readonly type = 'web_assert_visible';
  readonly category = 'Web';
  readonly color = '#FF9800';
  readonly tooltip = 'Assert that an element is visible (auto-waits)';

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

    context.logger.info(`Asserting ${displaySelector} is visible`);
    await executeWebAssertion(
      context,
      async () => { await expect(locator).toBeVisible({ timeout }); },
      `Expected element ${displaySelector} to be visible`,
      { stepType: 'web_assert_visible', expected: 'visible', actual: 'not visible' }
    );
    context.logger.info(`✓ Element ${displaySelector} is visible`);
    return {
      _summary: `${displaySelector} is visible`,
      selector,
      isVisible: true,
    };
  }
}
