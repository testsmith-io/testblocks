import { StatementBlock } from '../../base';
import { BlockInput, ExecutionContext } from '../../../types';
import { PlaywrightPage } from '../types';

/**
 * Take a screenshot.
 */
export class WebScreenshotBlock extends StatementBlock {
  readonly type = 'web_screenshot';
  readonly category = 'Web';
  readonly color = '#607D8B';
  readonly tooltip = 'Take a screenshot';

  getInputs(): BlockInput[] {
    return [
      { name: 'NAME', type: 'field', fieldType: 'text', default: 'screenshot' },
      { name: 'FULL_PAGE', type: 'field', fieldType: 'checkbox', default: false },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const page = context.page as PlaywrightPage;
    const name = params.NAME as string;
    const fullPage = params.FULL_PAGE as boolean;

    context.logger.info(`Taking screenshot: ${name}`);
    const buffer = await page.screenshot({ fullPage });
    return {
      _summary: `${name}${fullPage ? ' (full page)' : ''}`,
      name,
      fullPage,
      buffer: buffer.toString('base64'),
    };
  }
}
