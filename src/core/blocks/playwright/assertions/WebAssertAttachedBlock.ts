import { StatementBlock } from '../../base';
import { BlockInput, ExecutionContext } from '../../../types';
import { PlaywrightPage } from '../types';
import { resolveSelector, getDisplaySelector, getExpect, executeWebAssertion, getTimeout } from '../utils';

/**
 * Assert that an element is attached to the DOM (auto-waits).
 */
export class WebAssertAttachedBlock extends StatementBlock {
  readonly type = 'web_assert_attached';
  readonly category = 'Web';
  readonly color = '#FF9800';
  readonly tooltip = 'Assert that an element is attached to the DOM (auto-waits)';

  getInputs(): BlockInput[] {
    return [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const page = context.page as PlaywrightPage;
    const selector = resolveSelector(params, context);
    const displaySelector = getDisplaySelector(params, context);
    const timeout = getTimeout(context);

    const expect = await getExpect();
    const locator = page.locator(selector);

    context.logger.info(`Asserting ${displaySelector} is attached`);
    await executeWebAssertion(
      context,
      async () => { await expect(locator).toBeAttached({ timeout }); },
      `Expected element ${displaySelector} to be attached`,
      { stepType: 'web_assert_attached', expected: 'attached', actual: 'detached' }
    );
    context.logger.info(`✓ Element ${displaySelector} is attached`);
    return {
      _summary: `${displaySelector} is attached`,
      selector,
      isAttached: true,
    };
  }
}
