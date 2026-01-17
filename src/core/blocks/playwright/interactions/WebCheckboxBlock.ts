import { StatementBlock } from '../../base';
import { BlockInput, ExecutionContext } from '../../../types';
import { PlaywrightPage } from '../types';
import { resolveSelector, getTimeout } from '../utils';

/**
 * Check or uncheck a checkbox (auto-waits).
 */
export class WebCheckboxBlock extends StatementBlock {
  readonly type = 'web_checkbox';
  readonly category = 'Web';
  readonly color = '#E91E63';
  readonly tooltip = 'Check or uncheck a checkbox (auto-waits)';

  getInputs(): BlockInput[] {
    return [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
      { name: 'ACTION', type: 'field', fieldType: 'dropdown', options: [['Check', 'check'], ['Uncheck', 'uncheck']] },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const page = context.page as PlaywrightPage;
    const selector = resolveSelector(params, context);
    const action = params.ACTION as string;
    const timeout = getTimeout(context);

    context.logger.info(`${action === 'check' ? 'Checking' : 'Unchecking'} ${selector}`);
    const locator = page.locator(selector);

    if (action === 'check') {
      await locator.check({ timeout });
    } else {
      await locator.uncheck({ timeout });
    }

    return {
      _summary: `${action} ${params.SELECTOR}`,
      selector,
      action,
    };
  }
}
