import { StatementBlock } from '../../base';
import { BlockInput, ExecutionContext } from '../../../types';
import { PlaywrightPage } from '../types';
import { resolveVariables, resolveSelector, getDisplaySelector, getExpect, executeWebAssertion, getTimeout } from '../utils';

/**
 * Assert that an element has a specific accessible name (auto-waits).
 */
export class WebAssertAccessibleNameBlock extends StatementBlock {
  readonly type = 'web_assert_accessible_name';
  readonly category = 'Web';
  readonly color = '#FF9800';
  readonly tooltip = 'Assert that an element has a specific accessible name (auto-waits)';

  getInputs(): BlockInput[] {
    return [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
      { name: 'NAME', type: 'field', fieldType: 'text', required: true },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const page = context.page as PlaywrightPage;
    const selector = resolveSelector(params, context);
    const displaySelector = getDisplaySelector(params, context);
    const expectedName = resolveVariables(params.NAME as string, context);
    const timeout = getTimeout(context);

    const expect = await getExpect();
    const locator = page.locator(selector);

    context.logger.info(`Asserting ${displaySelector} has accessible name "${expectedName}"`);
    await executeWebAssertion(
      context,
      async () => { await expect(locator).toHaveAccessibleName(expectedName, { timeout }); },
      `Expected element ${displaySelector} to have accessible name "${expectedName}"`,
      { stepType: 'web_assert_accessible_name', expected: expectedName }
    );
    context.logger.info(`✓ Element ${displaySelector} has accessible name "${expectedName}"`);
    return {
      _summary: `accessible name "${expectedName}"`,
      selector,
      expectedName,
    };
  }
}
