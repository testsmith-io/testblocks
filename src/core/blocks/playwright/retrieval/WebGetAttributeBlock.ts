import { ValueBlock } from '../../base';
import { BlockInput, ExecutionContext } from '../../../types';
import { PlaywrightPage } from '../types';
import { resolveSelector, getTimeout } from '../utils';

/**
 * Get attribute value of an element (auto-waits).
 */
export class WebGetAttributeBlock extends ValueBlock {
  readonly type = 'web_get_attribute';
  readonly category = 'Web';
  readonly color = '#2196F3';
  readonly tooltip = 'Get attribute value of an element (auto-waits)';
  readonly output = { type: 'String' };

  getInputs(): BlockInput[] {
    return [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
      { name: 'ATTRIBUTE', type: 'field', fieldType: 'text', required: true },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const page = context.page as PlaywrightPage;
    const selector = resolveSelector(params, context);
    const attribute = params.ATTRIBUTE as string;
    const timeout = getTimeout(context);

    const locator = page.locator(selector);
    await locator.waitFor({ state: 'attached', timeout });
    const value = await locator.getAttribute(attribute, { timeout });
    context.logger.debug(`Attribute ${attribute} of ${selector}: "${value}"`);
    return {
      _summary: `${attribute} = "${value}"`,
      _value: value,
      selector,
      attribute,
      value,
    };
  }
}
