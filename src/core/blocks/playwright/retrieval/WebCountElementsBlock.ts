import { ValueBlock } from '../../base';
import { BlockInput, ExecutionContext } from '../../../types';
import { PlaywrightPage } from '../types';
import { resolveSelector } from '../utils';

/**
 * Count the number of elements matching a selector.
 */
export class WebCountElementsBlock extends ValueBlock {
  readonly type = 'web_count_elements';
  readonly category = 'Web';
  readonly color = '#2196F3';
  readonly tooltip = 'Count the number of elements matching a selector';
  readonly output = { type: 'Number' };

  getInputs(): BlockInput[] {
    return [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const page = context.page as PlaywrightPage;
    const selector = resolveSelector(params, context);

    const count = await page.locator(selector).count();
    context.logger.debug(`Found ${count} elements matching ${selector}`);
    return {
      _summary: `${count} elements`,
      _value: count,
      selector,
      count,
    };
  }
}
