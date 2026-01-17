import { StatementBlock } from '../../base';
import { BlockInput, ExecutionContext } from '../../../types';
import { PlaywrightPage } from '../types';
import { resolveVariables, resolveSelector, getTimeout } from '../utils';

/**
 * Select an option from a dropdown (auto-waits).
 */
export class WebSelectBlock extends StatementBlock {
  readonly type = 'web_select';
  readonly category = 'Web';
  readonly color = '#E91E63';
  readonly tooltip = 'Select an option from a dropdown (auto-waits)';

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

    context.logger.info(`Selecting "${value}" in ${selector}`);
    await page.locator(selector).selectOption(value, { timeout });

    return {
      _summary: `${params.SELECTOR} = "${value}"`,
      selector,
      value,
    };
  }
}
