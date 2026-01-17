import { ValueBlock } from '../../base';
import { BlockInput, ExecutionContext } from '../../../types';
import { PlaywrightPage } from '../types';

/**
 * Get the page title.
 */
export class WebGetTitleBlock extends ValueBlock {
  readonly type = 'web_get_title';
  readonly category = 'Web';
  readonly color = '#2196F3';
  readonly tooltip = 'Get the page title';
  readonly output = { type: 'String' };

  getInputs(): BlockInput[] {
    return [];
  }

  async execute(_params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const page = context.page as PlaywrightPage;

    const title = await page.title();
    context.logger.debug(`Page title: "${title}"`);
    return {
      _summary: `"${title}"`,
      _value: title,
      title,
    };
  }
}
