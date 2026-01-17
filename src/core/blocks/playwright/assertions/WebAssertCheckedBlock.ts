import { StatementBlock } from '../../base';
import { BlockInput, ExecutionContext } from '../../../types';
import { PlaywrightPage } from '../types';
import { resolveSelector, getDisplaySelector, getExpect, executeWebAssertion, getTimeout } from '../utils';

/**
 * Assert that a checkbox is checked (auto-waits).
 */
export class WebAssertCheckedBlock extends StatementBlock {
  readonly type = 'web_assert_checked';
  readonly category = 'Web';
  readonly color = '#FF9800';
  readonly tooltip = 'Assert that a checkbox is checked (auto-waits)';

  getInputs(): BlockInput[] {
    return [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
      { name: 'EXPECTED', type: 'field', fieldType: 'checkbox', default: true },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const page = context.page as PlaywrightPage;
    const selector = resolveSelector(params, context);
    const displaySelector = getDisplaySelector(params, context);
    const expected = params.EXPECTED as boolean;
    const timeout = getTimeout(context);

    const expect = await getExpect();
    const locator = page.locator(selector);

    context.logger.info(`Asserting ${displaySelector} is ${expected ? 'checked' : 'unchecked'}`);
    await executeWebAssertion(
      context,
      async () => {
        if (expected) {
          await expect(locator).toBeChecked({ timeout });
        } else {
          await expect(locator).not.toBeChecked({ timeout });
        }
      },
      `Expected checkbox ${displaySelector} to be ${expected ? 'checked' : 'unchecked'}`,
      { stepType: 'web_assert_checked', expected: expected ? 'checked' : 'unchecked' }
    );
    context.logger.info(`✓ Checkbox ${displaySelector} is ${expected ? 'checked' : 'unchecked'}`);
    return {
      _summary: `${displaySelector} is ${expected ? 'checked' : 'unchecked'}`,
      selector,
      expected,
    };
  }
}
