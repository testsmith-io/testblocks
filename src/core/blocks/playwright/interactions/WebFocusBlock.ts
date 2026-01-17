import { StatementBlock } from '../../base';
import { BlockInput, ExecutionContext } from '../../../types';
import { PlaywrightPage } from '../types';
import { resolveSelector, getTimeout } from '../utils';

/**
 * Focus on an element (auto-waits).
 */
export class WebFocusBlock extends StatementBlock {
  readonly type = 'web_focus';
  readonly category = 'Web';
  readonly color = '#E91E63';
  readonly tooltip = 'Focus on an element (auto-waits)';

  getInputs(): BlockInput[] {
    return [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const page = context.page as PlaywrightPage;
    const selector = resolveSelector(params, context);
    const timeout = getTimeout(context);

    context.logger.info(`Focusing on ${selector}`);
    await page.locator(selector).focus({ timeout });

    return {
      _summary: params.SELECTOR as string,
      selector,
    };
  }
}
