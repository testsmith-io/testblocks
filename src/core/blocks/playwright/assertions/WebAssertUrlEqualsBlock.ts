import { StatementBlock } from '../../base';
import { BlockInput, ExecutionContext } from '../../../types';
import { PlaywrightPage } from '../types';
import { resolveVariables, getExpect, executeWebAssertion, getTimeout } from '../utils';

/**
 * Assert that the page URL equals an expected value (auto-waits).
 */
export class WebAssertUrlEqualsBlock extends StatementBlock {
  readonly type = 'web_assert_url_equals';
  readonly category = 'Web';
  readonly color = '#FF9800';
  readonly tooltip = 'Assert that the page URL equals an expected value (auto-waits)';

  getInputs(): BlockInput[] {
    return [
      { name: 'URL', type: 'field', fieldType: 'text', required: true },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const page = context.page as PlaywrightPage;
    const expectedUrl = resolveVariables(params.URL as string, context);
    const timeout = getTimeout(context);

    const expect = await getExpect();

    context.logger.info(`Asserting URL equals "${expectedUrl}"`);
    await executeWebAssertion(
      context,
      async () => { await expect(page).toHaveURL(expectedUrl, { timeout }); },
      `Expected URL to equal "${expectedUrl}"`,
      { stepType: 'web_assert_url_equals', expected: expectedUrl, actual: page.url() }
    );
    context.logger.info(`✓ URL equals "${expectedUrl}"`);
    return {
      _summary: expectedUrl,
      expectedUrl,
      actualUrl: page.url(),
    };
  }
}
