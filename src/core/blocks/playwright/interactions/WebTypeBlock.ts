import { StatementBlock } from '../../base';
import { BlockInput, ExecutionContext } from '../../../types';
import { PlaywrightPage } from '../types';
import { resolveVariables, resolveSelector, getTimeout } from '../utils';

/**
 * Type text character by character (auto-waits).
 */
export class WebTypeBlock extends StatementBlock {
  readonly type = 'web_type';
  readonly category = 'Web';
  readonly color = '#E91E63';
  readonly tooltip = 'Type text character by character (auto-waits)';

  getInputs(): BlockInput[] {
    return [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
      { name: 'TEXT', type: 'field', fieldType: 'text', required: true },
      { name: 'DELAY', type: 'field', fieldType: 'number', default: 50 },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const page = context.page as PlaywrightPage;
    const selector = resolveSelector(params, context);
    const text = resolveVariables(params.TEXT as string, context);
    const delay = params.DELAY as number;
    const timeout = getTimeout(context);

    context.logger.info(`Typing "${text}" into ${selector}`);
    await page.locator(selector).pressSequentially(text, { delay, timeout });

    const displayText = text.length > 30 ? text.substring(0, 30) + '...' : text;
    return {
      _summary: `${params.SELECTOR} = "${displayText}"`,
      selector,
      text,
      delay,
    };
  }
}
