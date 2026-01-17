import { StatementBlock } from '../../base';
import { BlockInput, ExecutionContext } from '../../../types';
import { PlaywrightPage } from '../types';

/**
 * Wait for a specified time.
 */
export class WebWaitBlock extends StatementBlock {
  readonly type = 'web_wait';
  readonly category = 'Web';
  readonly color = '#9C27B0';
  readonly tooltip = 'Wait for a specified time';

  getInputs(): BlockInput[] {
    return [
      { name: 'MILLISECONDS', type: 'field', fieldType: 'number', default: 1000 },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const page = context.page as PlaywrightPage;
    const ms = params.MILLISECONDS as number;

    context.logger.info(`Waiting ${ms}ms`);
    await page.waitForTimeout(ms);
    return {
      _summary: `${ms}ms`,
      milliseconds: ms,
    };
  }
}
