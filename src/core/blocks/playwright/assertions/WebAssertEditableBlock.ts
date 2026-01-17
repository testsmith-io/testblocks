import { StatementBlock } from '../../base';
import { BlockInput, ExecutionContext } from '../../../types';
import { PlaywrightPage } from '../types';
import { resolveSelector, getDisplaySelector, getExpect, executeWebAssertion, getTimeout } from '../utils';

/**
 * Assert that an element is editable (auto-waits).
 */
export class WebAssertEditableBlock extends StatementBlock {
  readonly type = 'web_assert_editable';
  readonly category = 'Web';
  readonly color = '#FF9800';
  readonly tooltip = 'Assert that an element is editable (auto-waits)';

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

    context.logger.info(`Asserting ${displaySelector} is editable`);
    await executeWebAssertion(
      context,
      async () => { await expect(locator).toBeEditable({ timeout }); },
      `Expected element ${displaySelector} to be editable`,
      { stepType: 'web_assert_editable', expected: 'editable', actual: 'not editable' }
    );
    context.logger.info(`✓ Element ${displaySelector} is editable`);
    return {
      _summary: `${displaySelector} is editable`,
      selector,
      isEditable: true,
    };
  }
}
