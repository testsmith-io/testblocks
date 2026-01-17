import { StatementBlock } from '../../base';
import { BlockInput, ExecutionContext } from '../../../types';
import { PlaywrightPage } from '../types';
import { resolveSelector, getDisplaySelector, getExpect, executeWebAssertion, getTimeout } from '../utils';

/**
 * Assert that an element is focused (auto-waits).
 */
export class WebAssertFocusedBlock extends StatementBlock {
  readonly type = 'web_assert_focused';
  readonly category = 'Web';
  readonly color = '#FF9800';
  readonly tooltip = 'Assert that an element is focused (auto-waits)';

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

    context.logger.info(`Asserting ${displaySelector} is focused`);
    await executeWebAssertion(
      context,
      async () => { await expect(locator).toBeFocused({ timeout }); },
      `Expected element ${displaySelector} to be focused`,
      { stepType: 'web_assert_focused', expected: 'focused', actual: 'not focused' }
    );
    context.logger.info(`✓ Element ${displaySelector} is focused`);
    return {
      _summary: `${displaySelector} is focused`,
      selector,
      isFocused: true,
    };
  }
}
