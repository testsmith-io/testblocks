import { StatementBlock } from '../../base';
import { BlockInput, ExecutionContext } from '../../../types';
import { PlaywrightPage } from '../types';
import { resolveVariables } from '../utils';

/**
 * Navigate to a URL.
 */
export class WebNavigateBlock extends StatementBlock {
  readonly type = 'web_navigate';
  readonly category = 'Web';
  readonly color = '#E91E63';
  readonly tooltip = 'Navigate to a URL';

  getInputs(): BlockInput[] {
    return [
      { name: 'URL', type: 'field', fieldType: 'text', required: true },
      { name: 'WAIT_UNTIL', type: 'field', fieldType: 'dropdown', options: [['Load', 'load'], ['DOM Content Loaded', 'domcontentloaded'], ['Network Idle', 'networkidle']], default: 'load' },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const page = context.page as PlaywrightPage;
    const url = resolveVariables(params.URL as string, context);
    const waitUntil = params.WAIT_UNTIL as string;

    context.logger.info(`Navigating to ${url}`);
    await page.goto(url, { waitUntil });
    return {
      _summary: url,
      url,
      waitUntil,
    };
  }
}
