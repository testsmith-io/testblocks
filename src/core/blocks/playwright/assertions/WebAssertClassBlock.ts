import { StatementBlock } from '../../base';
import { BlockInput, ExecutionContext } from '../../../types';
import { PlaywrightPage } from '../types';
import { resolveVariables, resolveSelector, getDisplaySelector, getExpect, executeWebAssertion, getTimeout } from '../utils';

/**
 * Assert that an element has a specific CSS class (auto-waits).
 */
export class WebAssertClassBlock extends StatementBlock {
  readonly type = 'web_assert_class';
  readonly category = 'Web';
  readonly color = '#FF9800';
  readonly tooltip = 'Assert that an element has a specific CSS class (auto-waits)';

  getInputs(): BlockInput[] {
    return [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
      { name: 'CLASS', type: 'field', fieldType: 'text', required: true },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const page = context.page as PlaywrightPage;
    const selector = resolveSelector(params, context);
    const displaySelector = getDisplaySelector(params, context);
    const expectedClass = resolveVariables(params.CLASS as string, context);
    const timeout = getTimeout(context);

    const expect = await getExpect();
    const locator = page.locator(selector);

    // Use regex to match class anywhere in the class attribute
    const classPattern = new RegExp(`(^|\\s)${expectedClass}($|\\s)`);

    context.logger.info(`Asserting ${displaySelector} has class "${expectedClass}"`);
    await executeWebAssertion(
      context,
      async () => { await expect(locator).toHaveClass(classPattern, { timeout }); },
      `Expected element ${displaySelector} to have class "${expectedClass}"`,
      { stepType: 'web_assert_class', expected: expectedClass }
    );
    context.logger.info(`✓ Element ${displaySelector} has class "${expectedClass}"`);
    return {
      _summary: `has class "${expectedClass}"`,
      selector,
      expectedClass,
    };
  }
}
