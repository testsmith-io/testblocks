import { StatementBlock } from '../../base';
import { BlockInput, ExecutionContext } from '../../../types';
import { PlaywrightPage } from '../types';
import { resolveVariables, resolveSelector, getDisplaySelector, getExpect, executeWebAssertion, getTimeout } from '../utils';

/**
 * Assert that an element has a specific attribute value (auto-waits).
 */
export class WebAssertAttributeBlock extends StatementBlock {
  readonly type = 'web_assert_attribute';
  readonly category = 'Web';
  readonly color = '#FF9800';
  readonly tooltip = 'Assert that an element has a specific attribute value (auto-waits)';

  getInputs(): BlockInput[] {
    return [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
      { name: 'ATTRIBUTE', type: 'field', fieldType: 'text', required: true },
      { name: 'VALUE', type: 'field', fieldType: 'text', required: true },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const page = context.page as PlaywrightPage;
    const selector = resolveSelector(params, context);
    const displaySelector = getDisplaySelector(params, context);
    const attribute = params.ATTRIBUTE as string;
    const expectedValue = resolveVariables(params.VALUE as string, context);
    const timeout = getTimeout(context);

    const expect = await getExpect();
    const locator = page.locator(selector);

    context.logger.info(`Asserting ${displaySelector} has attribute ${attribute}="${expectedValue}"`);
    await executeWebAssertion(
      context,
      async () => { await expect(locator).toHaveAttribute(attribute, expectedValue, { timeout }); },
      `Expected element ${displaySelector} to have attribute ${attribute}="${expectedValue}"`,
      { stepType: 'web_assert_attribute', expected: expectedValue }
    );
    context.logger.info(`✓ Element ${displaySelector} has attribute ${attribute}="${expectedValue}"`);
    return {
      _summary: `${attribute}="${expectedValue}"`,
      selector,
      attribute,
      expectedValue,
    };
  }
}
