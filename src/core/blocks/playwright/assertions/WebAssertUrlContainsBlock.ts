import { StatementBlock } from '../../base';
import { BlockInput, ExecutionContext } from '../../../types';
import { PlaywrightPage } from '../types';
import { resolveVariables, getExpect, executeWebAssertion, getTimeout } from '../utils';

/**
 * Assert that current URL contains expected value (auto-waits).
 */
export class WebAssertUrlContainsBlock extends StatementBlock {
  readonly type = 'web_assert_url_contains';
  readonly category = 'Web';
  readonly color = '#FF9800';
  readonly tooltip = 'Assert that current URL contains expected value (auto-waits)';

  getInputs(): BlockInput[] {
    return [
      { name: 'TEXT', type: 'field', fieldType: 'text', required: true },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const page = context.page as PlaywrightPage;
    const expectedText = resolveVariables(params.TEXT as string, context);
    const timeout = getTimeout(context);

    const expect = await getExpect();

    // Escape special regex characters and create a regex pattern
    const escapedText = expectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const urlPattern = new RegExp(escapedText);

    context.logger.info(`Asserting URL contains "${expectedText}"`);
    await executeWebAssertion(
      context,
      async () => { await expect(page).toHaveURL(urlPattern, { timeout }); },
      `Expected URL to contain "${expectedText}"`,
      { stepType: 'web_assert_url_contains', expected: expectedText, actual: page.url() }
    );
    context.logger.info(`✓ URL contains "${expectedText}"`);
    return {
      _summary: `"${expectedText}" in URL`,
      expectedText,
      actualUrl: page.url(),
    };
  }
}
