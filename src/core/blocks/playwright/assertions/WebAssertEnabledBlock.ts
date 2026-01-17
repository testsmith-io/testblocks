import { StatementBlock } from '../../base';
import { BlockInput, ExecutionContext } from '../../../types';
import { PlaywrightPage } from '../types';
import { resolveSelector, getDisplaySelector, getExpect, executeWebAssertion, getTimeout } from '../utils';

/**
 * Assert that an element is enabled (auto-waits).
 */
export class WebAssertEnabledBlock extends StatementBlock {
  readonly type = 'web_assert_enabled';
  readonly category = 'Web';
  readonly color = '#FF9800';
  readonly tooltip = 'Assert that an element is enabled (auto-waits)';

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

    context.logger.info(`Asserting ${displaySelector} is enabled`);
    await executeWebAssertion(
      context,
      async () => { await expect(locator).toBeEnabled({ timeout }); },
      `Expected element ${displaySelector} to be enabled`,
      { stepType: 'web_assert_enabled', expected: 'enabled', actual: 'disabled' }
    );
    context.logger.info(`✓ Element ${displaySelector} is enabled`);
    return {
      _summary: `${displaySelector} is enabled`,
      selector,
      isEnabled: true,
    };
  }
}
