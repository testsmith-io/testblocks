import { StatementBlock } from '../../base';
import { BlockInput, ExecutionContext } from '../../../types';
import { PlaywrightPage } from '../types';
import { resolveSelector, getTimeout } from '../utils';

/**
 * Wait for an element to appear/disappear.
 */
export class WebWaitForElementBlock extends StatementBlock {
  readonly type = 'web_wait_for_element';
  readonly category = 'Web';
  readonly color = '#9C27B0';
  readonly tooltip = 'Wait for an element to appear/disappear';

  getInputs(): BlockInput[] {
    return [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
      { name: 'STATE', type: 'field', fieldType: 'dropdown', options: [['Visible', 'visible'], ['Hidden', 'hidden'], ['Attached', 'attached'], ['Detached', 'detached']] },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const page = context.page as PlaywrightPage;
    const selector = resolveSelector(params, context);
    const state = params.STATE as string;
    const timeout = getTimeout(context);

    context.logger.info(`Waiting for ${selector} to be ${state}`);
    await page.waitForSelector(selector, { state, timeout });
    return {
      _summary: `${params.SELECTOR} is ${state}`,
      selector,
      state,
    };
  }
}
