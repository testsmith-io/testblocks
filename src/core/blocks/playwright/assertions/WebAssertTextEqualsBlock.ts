import { StatementBlock } from '../../base';
import { BlockInput, ExecutionContext } from '../../../types';
import { PlaywrightPage } from '../types';
import { resolveVariables, resolveSelector, getDisplaySelector, getExpect, executeWebAssertion, getTimeout } from '../utils';

/**
 * Assert that element text equals expected value (auto-waits).
 */
export class WebAssertTextEqualsBlock extends StatementBlock {
  readonly type = 'web_assert_text_equals';
  readonly category = 'Web';
  readonly color = '#FF9800';
  readonly tooltip = 'Assert that element text equals expected value (auto-waits)';

  getInputs(): BlockInput[] {
    return [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
      { name: 'TEXT', type: 'field', fieldType: 'text', required: true },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const page = context.page as PlaywrightPage;
    const selector = resolveSelector(params, context);
    const displaySelector = getDisplaySelector(params, context);
    const expectedText = resolveVariables(params.TEXT as string, context);
    const timeout = getTimeout(context);

    const expect = await getExpect();
    const locator = page.locator(selector);

    context.logger.info(`Asserting ${displaySelector} text equals "${expectedText}"`);
    await executeWebAssertion(
      context,
      async () => { await expect(locator).toHaveText(expectedText, { timeout }); },
      `Expected element ${displaySelector} text to equal "${expectedText}"`,
      { stepType: 'web_assert_text_equals', expected: expectedText }
    );
    context.logger.info(`✓ Element ${displaySelector} text equals "${expectedText}"`);
    return {
      _summary: `"${expectedText}" matches`,
      selector,
      expectedText,
    };
  }
}
