import { StatementBlock } from '../../base';
import { BlockInput, ExecutionContext } from '../../../types';
import { PlaywrightPage } from '../types';
import { resolveSelector, getTimeout } from '../utils';

/**
 * Scroll an element into view if needed (auto-waits for element to be attached).
 */
export class WebScrollIntoViewBlock extends StatementBlock {
  readonly type = 'web_scroll_into_view';
  readonly category = 'Web';
  readonly color = '#E91E63';
  readonly tooltip = 'Scroll an element into view if needed (auto-waits for element to be attached)';

  getInputs(): BlockInput[] {
    return [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const page = context.page as PlaywrightPage;
    const selector = resolveSelector(params, context);
    const timeout = getTimeout(context);

    context.logger.info(`Scrolling ${selector} into view`);
    await page.locator(selector).scrollIntoViewIfNeeded({ timeout });

    return {
      _summary: params.SELECTOR as string,
      selector,
    };
  }
}
