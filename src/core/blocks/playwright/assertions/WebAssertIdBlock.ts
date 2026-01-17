import { StatementBlock } from '../../base';
import { BlockInput, ExecutionContext } from '../../../types';
import { PlaywrightPage } from '../types';
import { resolveVariables, resolveSelector, getDisplaySelector, getExpect, executeWebAssertion, getTimeout } from '../utils';

/**
 * Assert that an element has a specific ID (auto-waits).
 */
export class WebAssertIdBlock extends StatementBlock {
  readonly type = 'web_assert_id';
  readonly category = 'Web';
  readonly color = '#FF9800';
  readonly tooltip = 'Assert that an element has a specific ID (auto-waits)';

  getInputs(): BlockInput[] {
    return [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
      { name: 'ID', type: 'field', fieldType: 'text', required: true },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const page = context.page as PlaywrightPage;
    const selector = resolveSelector(params, context);
    const displaySelector = getDisplaySelector(params, context);
    const expectedId = resolveVariables(params.ID as string, context);
    const timeout = getTimeout(context);

    const expect = await getExpect();
    const locator = page.locator(selector);

    context.logger.info(`Asserting ${displaySelector} has ID "${expectedId}"`);
    await executeWebAssertion(
      context,
      async () => { await expect(locator).toHaveId(expectedId, { timeout }); },
      `Expected element ${displaySelector} to have ID "${expectedId}"`,
      { stepType: 'web_assert_id', expected: expectedId }
    );
    context.logger.info(`✓ Element ${displaySelector} has ID "${expectedId}"`);
    return {
      _summary: `id="${expectedId}"`,
      selector,
      expectedId,
    };
  }
}
