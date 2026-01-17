import { ValueBlock } from '../../base';
import { BlockInput, ExecutionContext } from '../../../types';
import { PlaywrightPage } from '../types';

/**
 * Get the current URL.
 */
export class WebGetUrlBlock extends ValueBlock {
  readonly type = 'web_get_url';
  readonly category = 'Web';
  readonly color = '#2196F3';
  readonly tooltip = 'Get the current URL';
  readonly output = { type: 'String' };

  getInputs(): BlockInput[] {
    return [];
  }

  async execute(_params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const page = context.page as PlaywrightPage;

    const url = page.url();
    context.logger.debug(`Current URL: "${url}"`);
    return {
      _summary: url,
      _value: url,
      url,
    };
  }
}
