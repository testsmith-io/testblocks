import { StatementBlock } from '../../base';
import { BlockInput, ExecutionContext } from '../../../types';
import { PlaywrightPage } from '../types';
import { resolveVariables, resolveSelector, getDisplaySelector, getExpect, executeWebAssertion, getTimeout } from '../utils';

/**
 * Assert that an element has a specific accessible description (auto-waits).
 */
export class WebAssertAccessibleDescriptionBlock extends StatementBlock {
  readonly type = 'web_assert_accessible_description';
  readonly category = 'Web';
  readonly color = '#FF9800';
  readonly tooltip = 'Assert that an element has a specific accessible description (auto-waits)';

  getInputs(): BlockInput[] {
    return [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
      { name: 'DESCRIPTION', type: 'field', fieldType: 'text', required: true },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const page = context.page as PlaywrightPage;
    const selector = resolveSelector(params, context);
    const displaySelector = getDisplaySelector(params, context);
    const expectedDescription = resolveVariables(params.DESCRIPTION as string, context);
    const timeout = getTimeout(context);

    const expect = await getExpect();
    const locator = page.locator(selector);

    context.logger.info(`Asserting ${displaySelector} has accessible description "${expectedDescription}"`);
    await executeWebAssertion(
      context,
      async () => { await expect(locator).toHaveAccessibleDescription(expectedDescription, { timeout }); },
      `Expected element ${displaySelector} to have accessible description "${expectedDescription}"`,
      { stepType: 'web_assert_accessible_description', expected: expectedDescription }
    );
    context.logger.info(`✓ Element ${displaySelector} has accessible description "${expectedDescription}"`);
    return {
      _summary: `accessible description "${expectedDescription}"`,
      selector,
      expectedDescription,
    };
  }
}
