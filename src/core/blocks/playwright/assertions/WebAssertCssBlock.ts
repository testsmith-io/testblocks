import { StatementBlock } from '../../base';
import { BlockInput, ExecutionContext } from '../../../types';
import { PlaywrightPage } from '../types';
import { resolveVariables, resolveSelector, getDisplaySelector, getExpect, executeWebAssertion, getTimeout } from '../utils';

/**
 * Assert that an element has a specific CSS property value (auto-waits).
 */
export class WebAssertCssBlock extends StatementBlock {
  readonly type = 'web_assert_css';
  readonly category = 'Web';
  readonly color = '#FF9800';
  readonly tooltip = 'Assert that an element has a specific CSS property value (auto-waits)';

  getInputs(): BlockInput[] {
    return [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
      { name: 'PROPERTY', type: 'field', fieldType: 'text', required: true },
      { name: 'VALUE', type: 'field', fieldType: 'text', required: true },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const page = context.page as PlaywrightPage;
    const selector = resolveSelector(params, context);
    const displaySelector = getDisplaySelector(params, context);
    const property = params.PROPERTY as string;
    const expectedValue = resolveVariables(params.VALUE as string, context);
    const timeout = getTimeout(context);

    const expect = await getExpect();
    const locator = page.locator(selector);

    context.logger.info(`Asserting ${displaySelector} has CSS ${property}: ${expectedValue}`);
    await executeWebAssertion(
      context,
      async () => { await expect(locator).toHaveCSS(property, expectedValue, { timeout }); },
      `Expected element ${displaySelector} to have CSS ${property}: ${expectedValue}`,
      { stepType: 'web_assert_css', expected: expectedValue }
    );
    context.logger.info(`✓ Element ${displaySelector} has CSS ${property}: ${expectedValue}`);
    return {
      _summary: `${property}: ${expectedValue}`,
      selector,
      property,
      expectedValue,
    };
  }
}
