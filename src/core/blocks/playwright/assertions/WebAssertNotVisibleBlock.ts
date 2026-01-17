import { StatementBlock } from '../../base';
import { BlockInput, ExecutionContext } from '../../../types';
import { PlaywrightPage } from '../types';
import { resolveSelector, getDisplaySelector, getExpect, executeWebAssertion, getTimeout } from '../utils';

/**
 * Assert that an element is not visible (auto-waits).
 */
export class WebAssertNotVisibleBlock extends StatementBlock {
  readonly type = 'web_assert_not_visible';
  readonly category = 'Web';
  readonly color = '#FF9800';
  readonly tooltip = 'Assert that an element is not visible (auto-waits)';

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

    context.logger.info(`Asserting ${displaySelector} is not visible`);
    await executeWebAssertion(
      context,
      async () => { await expect(locator).toBeHidden({ timeout }); },
      `Expected element ${displaySelector} to be hidden`,
      { stepType: 'web_assert_not_visible', expected: 'hidden', actual: 'visible' }
    );
    context.logger.info(`✓ Element ${displaySelector} is not visible`);
    return {
      _summary: `${displaySelector} is not visible`,
      selector,
      isVisible: false,
    };
  }
}
