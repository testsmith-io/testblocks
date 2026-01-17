import { StatementBlock } from '../../base';
import { BlockInput, ExecutionContext } from '../../../types';
import { PlaywrightPage } from '../types';
import { resolveVariables, resolveSelector, getDisplaySelector, getExpect, executeWebAssertion, getTimeout } from '../utils';

/**
 * Assert that an input field value contains specific text (auto-waits).
 */
export class WebAssertValueContainsBlock extends StatementBlock {
  readonly type = 'web_assert_value_contains';
  readonly category = 'Web';
  readonly color = '#FF9800';
  readonly tooltip = 'Assert that an input field value contains specific text (auto-waits)';

  getInputs(): BlockInput[] {
    return [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
      { name: 'VALUE', type: 'field', fieldType: 'text', required: true },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const page = context.page as PlaywrightPage;
    const selector = resolveSelector(params, context);
    const displaySelector = getDisplaySelector(params, context);
    const expectedValue = resolveVariables(params.VALUE as string, context);
    const timeout = getTimeout(context);

    const expect = await getExpect();
    const locator = page.locator(selector);

    context.logger.info(`Asserting ${displaySelector} value contains "${expectedValue}"`);
    await executeWebAssertion(
      context,
      async () => {
        await expect(locator).toHaveValue(new RegExp(expectedValue), { timeout });
      },
      `Expected input ${displaySelector} value to contain "${expectedValue}"`,
      { stepType: 'web_assert_value_contains', expected: expectedValue }
    );
    context.logger.info(`✓ Input ${displaySelector} value contains "${expectedValue}"`);
    return {
      _summary: `${displaySelector} contains "${expectedValue}"`,
      selector,
      expected: expectedValue,
    };
  }
}
