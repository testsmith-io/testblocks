import { StatementBlock } from '../../base';
import { BlockInput, ExecutionContext } from '../../../types';
import { PlaywrightPage } from '../types';
import { resolveSelector, getTimeout } from '../utils';

/**
 * Click on an element (auto-waits for element to be visible and stable).
 */
export class WebClickBlock extends StatementBlock {
  readonly type = 'web_click';
  readonly category = 'Web';
  readonly color = '#E91E63';
  readonly tooltip = 'Click on an element (auto-waits for element to be visible and stable)';

  getInputs(): BlockInput[] {
    return [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const page = context.page as PlaywrightPage;
    const selector = resolveSelector(params, context);
    const timeout = getTimeout(context);

    context.logger.info(`Clicking: ${selector}`);
    await page.locator(selector).click({ timeout });

    return {
      _summary: params.SELECTOR as string,
      selector,
    };
  }
}
