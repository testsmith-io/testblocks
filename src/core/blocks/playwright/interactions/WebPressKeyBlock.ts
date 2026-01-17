import { StatementBlock } from '../../base';
import { BlockInput, ExecutionContext } from '../../../types';
import { PlaywrightPage } from '../types';
import { resolveSelector, getTimeout } from '../utils';

/**
 * Press a keyboard key (auto-waits).
 */
export class WebPressKeyBlock extends StatementBlock {
  readonly type = 'web_press_key';
  readonly category = 'Web';
  readonly color = '#E91E63';
  readonly tooltip = 'Press a keyboard key (auto-waits)';

  getInputs(): BlockInput[] {
    return [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
      { name: 'KEY', type: 'field', fieldType: 'dropdown', options: [['Enter', 'Enter'], ['Tab', 'Tab'], ['Escape', 'Escape'], ['Backspace', 'Backspace'], ['ArrowUp', 'ArrowUp'], ['ArrowDown', 'ArrowDown'], ['ArrowLeft', 'ArrowLeft'], ['ArrowRight', 'ArrowRight']] },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const page = context.page as PlaywrightPage;
    const selector = resolveSelector(params, context);
    const key = params.KEY as string;
    const timeout = getTimeout(context);

    context.logger.info(`Pressing ${key} on ${selector}`);
    await page.locator(selector).press(key, { timeout });

    return {
      _summary: `${key} on ${params.SELECTOR}`,
      selector,
      key,
    };
  }
}
