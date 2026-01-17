import { ValueBlock } from '../../base';
import { BlockInput, ExecutionContext } from '../../../types';
import { PlaywrightPage } from '../types';
import { resolveSelector, getTimeout } from '../utils';

/**
 * Get text content of an element (auto-waits).
 */
export class WebGetTextBlock extends ValueBlock {
  readonly type = 'web_get_text';
  readonly category = 'Web';
  readonly color = '#2196F3';
  readonly tooltip = 'Get text content of an element (auto-waits)';
  readonly output = { type: 'String' };

  getInputs(): BlockInput[] {
    return [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const page = context.page as PlaywrightPage;
    const selector = resolveSelector(params, context);
    const timeout = getTimeout(context);

    const locator = page.locator(selector);
    await locator.waitFor({ state: 'visible', timeout });
    const text = await locator.textContent({ timeout });
    context.logger.debug(`Text content of ${selector}: "${text}"`);
    const displayText = text && text.length > 40 ? text.substring(0, 40) + '...' : text;
    return {
      _summary: `"${displayText}"`,
      _value: text,
      selector,
      text,
    };
  }
}
