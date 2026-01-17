import { StatementBlock } from '../../base';
import { BlockInput, ExecutionContext } from '../../../types';
import { PlaywrightPage } from '../types';
import { resolveVariables, getTimeout } from '../utils';

/**
 * Wait for URL to match.
 */
export class WebWaitForUrlBlock extends StatementBlock {
  readonly type = 'web_wait_for_url';
  readonly category = 'Web';
  readonly color = '#9C27B0';
  readonly tooltip = 'Wait for URL to match';

  getInputs(): BlockInput[] {
    return [
      { name: 'URL', type: 'field', fieldType: 'text', required: true },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const page = context.page as PlaywrightPage;
    const url = resolveVariables(params.URL as string, context);
    const timeout = getTimeout(context);

    context.logger.info(`Waiting for URL to match: ${url}`);
    await page.waitForURL(url, { timeout });
    return {
      _summary: url,
      url,
    };
  }
}
