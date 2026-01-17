import { StatementBlock } from '../../base';
import { BlockInput, ExecutionContext } from '../../../types';
import { PlaywrightPage } from '../types';
import { resolveSelector, getDisplaySelector, getExpect, executeWebAssertion, getTimeout } from '../utils';

/**
 * Assert that a selector matches a specific number of elements (auto-waits).
 */
export class WebAssertCountBlock extends StatementBlock {
  readonly type = 'web_assert_count';
  readonly category = 'Web';
  readonly color = '#FF9800';
  readonly tooltip = 'Assert that a selector matches a specific number of elements (auto-waits)';

  getInputs(): BlockInput[] {
    return [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
      { name: 'COUNT', type: 'field', fieldType: 'number', required: true, default: 1 },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const page = context.page as PlaywrightPage;
    const selector = resolveSelector(params, context);
    const displaySelector = getDisplaySelector(params, context);
    const expectedCount = params.COUNT as number;
    const timeout = getTimeout(context);

    const expect = await getExpect();
    const locator = page.locator(selector);

    context.logger.info(`Asserting ${displaySelector} has count ${expectedCount}`);
    await executeWebAssertion(
      context,
      async () => { await expect(locator).toHaveCount(expectedCount, { timeout }); },
      `Expected ${displaySelector} to have ${expectedCount} elements`,
      { stepType: 'web_assert_count', expected: expectedCount }
    );
    context.logger.info(`✓ Selector ${displaySelector} has ${expectedCount} elements`);
    return {
      _summary: `${expectedCount} elements`,
      selector,
      expectedCount,
    };
  }
}
