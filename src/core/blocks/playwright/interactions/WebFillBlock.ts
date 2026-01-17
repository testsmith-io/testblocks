import { StatementBlock } from '../../base';
import { BlockInput, ExecutionContext } from '../../../types';
import { PlaywrightPage } from '../types';
import { resolveVariables, resolveSelector, getTimeout } from '../utils';

/**
 * Fill an input field (clears existing value, auto-waits).
 */
export class WebFillBlock extends StatementBlock {
  readonly type = 'web_fill';
  readonly category = 'Web';
  readonly color = '#E91E63';
  readonly tooltip = 'Fill an input field (clears existing value, auto-waits)';

  getInputs(): BlockInput[] {
    return [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
      { name: 'VALUE', type: 'field', fieldType: 'text', required: true },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const page = context.page as PlaywrightPage;
    const selector = resolveSelector(params, context);
    const value = resolveVariables(params.VALUE as string, context);
    const timeout = getTimeout(context);

    context.logger.info(`Filling ${selector} with "${value}"`);
    await page.locator(selector).fill(value, { timeout });

    const displayValue = value.length > 30 ? value.substring(0, 30) + '...' : value;
    return {
      _summary: `${params.SELECTOR} = "${displayValue}"`,
      selector,
      value,
    };
  }
}
