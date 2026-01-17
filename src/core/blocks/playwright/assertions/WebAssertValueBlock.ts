import { StatementBlock } from '../../base';
import { BlockInput, ExecutionContext } from '../../../types';
import { PlaywrightPage } from '../types';
import { resolveVariables, resolveSelector, getDisplaySelector, getExpect, executeWebAssertion, getTimeout } from '../utils';

/**
 * Assert that an input field has a specific value (auto-waits).
 */
export class WebAssertValueBlock extends StatementBlock {
  readonly type = 'web_assert_value';
  readonly category = 'Web';
  readonly color = '#FF9800';
  readonly tooltip = 'Assert that an input field has a specific value (auto-waits)';

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

    context.logger.info(`Asserting ${displaySelector} has value "${expectedValue}"`);
    await executeWebAssertion(
      context,
      async () => {
        await expect(locator).toHaveValue(expectedValue, { timeout });
      },
      `Expected input ${displaySelector} to have value "${expectedValue}"`,
      { stepType: 'web_assert_value', expected: expectedValue }
    );
    context.logger.info(`✓ Input ${displaySelector} has value "${expectedValue}"`);
    return {
      _summary: `${displaySelector} = "${expectedValue}"`,
      selector,
      expected: expectedValue,
    };
  }
}
