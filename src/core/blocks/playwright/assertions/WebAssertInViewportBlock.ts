import { StatementBlock } from '../../base';
import { BlockInput, ExecutionContext } from '../../../types';
import { PlaywrightPage } from '../types';
import { resolveSelector, getDisplaySelector, getExpect, executeWebAssertion, getTimeout } from '../utils';

/**
 * Assert that an element is in the viewport (auto-waits).
 */
export class WebAssertInViewportBlock extends StatementBlock {
  readonly type = 'web_assert_in_viewport';
  readonly category = 'Web';
  readonly color = '#FF9800';
  readonly tooltip = 'Assert that an element is in the viewport (auto-waits)';

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

    context.logger.info(`Asserting ${displaySelector} is in viewport`);
    await executeWebAssertion(
      context,
      async () => { await expect(locator).toBeInViewport({ timeout }); },
      `Expected element ${displaySelector} to be in viewport`,
      { stepType: 'web_assert_in_viewport', expected: 'in viewport', actual: 'not in viewport' }
    );
    context.logger.info(`✓ Element ${displaySelector} is in viewport`);
    return {
      _summary: `${displaySelector} is in viewport`,
      selector,
      isInViewport: true,
    };
  }
}
