import { ValueBlock } from '../../base';
import { BlockInput, ExecutionContext } from '../../../types';
import { PlaywrightPage } from '../types';
import { resolveSelector, getTimeout } from '../utils';

/**
 * Get current value of an input field (auto-waits).
 */
export class WebGetInputValueBlock extends ValueBlock {
  readonly type = 'web_get_input_value';
  readonly category = 'Web';
  readonly color = '#2196F3';
  readonly tooltip = 'Get current value of an input field (auto-waits)';
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
    const value = await locator.inputValue({ timeout });
    context.logger.debug(`Input value of ${selector}: "${value}"`);
    const displayValue = value.length > 40 ? value.substring(0, 40) + '...' : value;
    return {
      _summary: `"${displayValue}"`,
      _value: value,
      selector,
      value,
    };
  }
}
