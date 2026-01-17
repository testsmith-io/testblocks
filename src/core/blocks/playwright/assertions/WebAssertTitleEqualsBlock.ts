import { StatementBlock } from '../../base';
import { BlockInput, ExecutionContext } from '../../../types';
import { PlaywrightPage } from '../types';
import { resolveVariables, getExpect, executeWebAssertion, getTimeout } from '../utils';

/**
 * Assert that the page title equals an expected value (auto-waits).
 */
export class WebAssertTitleEqualsBlock extends StatementBlock {
  readonly type = 'web_assert_title_equals';
  readonly category = 'Web';
  readonly color = '#FF9800';
  readonly tooltip = 'Assert that the page title equals an expected value (auto-waits)';

  getInputs(): BlockInput[] {
    return [
      { name: 'TITLE', type: 'field', fieldType: 'text', required: true },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const page = context.page as PlaywrightPage;
    const expectedTitle = resolveVariables(params.TITLE as string, context);
    const timeout = getTimeout(context);

    const expect = await getExpect();

    context.logger.info(`Asserting title equals "${expectedTitle}"`);
    await executeWebAssertion(
      context,
      async () => { await expect(page).toHaveTitle(expectedTitle, { timeout }); },
      `Expected title to equal "${expectedTitle}"`,
      { stepType: 'web_assert_title_equals', expected: expectedTitle }
    );
    context.logger.info(`✓ Title equals "${expectedTitle}"`);
    return {
      _summary: `"${expectedTitle}"`,
      expectedTitle,
    };
  }
}
