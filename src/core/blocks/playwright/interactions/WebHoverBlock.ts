import { StatementBlock } from '../../base';
import { BlockInput, ExecutionContext } from '../../../types';
import { PlaywrightPage } from '../types';
import { resolveSelector, getTimeout } from '../utils';

/**
 * Hover over an element (auto-waits).
 */
export class WebHoverBlock extends StatementBlock {
  readonly type = 'web_hover';
  readonly category = 'Web';
  readonly color = '#E91E63';
  readonly tooltip = 'Hover over an element (auto-waits)';

  getInputs(): BlockInput[] {
    return [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const page = context.page as PlaywrightPage;
    const selector = resolveSelector(params, context);
    const timeout = getTimeout(context);

    context.logger.info(`Hovering over ${selector}`);
    await page.locator(selector).hover({ timeout });

    return {
      _summary: params.SELECTOR as string,
      selector,
    };
  }
}
