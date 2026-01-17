import { StatementBlock } from '../../base';
import { BlockInput, ExecutionContext } from '../../../types';
import { PlaywrightPage } from '../types';
import { resolveSelector, getDisplaySelector, getExpect, executeWebAssertion, getTimeout } from '../utils';

/**
 * Assert that an element is disabled (auto-waits).
 */
export class WebAssertDisabledBlock extends StatementBlock {
  readonly type = 'web_assert_disabled';
  readonly category = 'Web';
  readonly color = '#FF9800';
  readonly tooltip = 'Assert that an element is disabled (auto-waits)';

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

    context.logger.info(`Asserting ${displaySelector} is disabled`);
    await executeWebAssertion(
      context,
      async () => { await expect(locator).toBeDisabled({ timeout }); },
      `Expected element ${displaySelector} to be disabled`,
      { stepType: 'web_assert_disabled', expected: 'disabled', actual: 'enabled' }
    );
    context.logger.info(`✓ Element ${displaySelector} is disabled`);
    return {
      _summary: `${displaySelector} is disabled`,
      selector,
      isDisabled: true,
    };
  }
}
