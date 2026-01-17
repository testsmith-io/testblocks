import { StatementBlock } from '../base';
import { BlockInput, ExecutionContext } from '../../types';

/**
 * Clear all request headers.
 */
export class ApiClearHeadersBlock extends StatementBlock {
  readonly type = 'api_clear_headers';
  readonly category = 'API';
  readonly color = '#7B1FA2';
  readonly tooltip = 'Clear all request headers';

  getInputs(): BlockInput[] {
    return [];
  }

  async execute(_params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    context.variables.delete('__requestHeaders');
    context.logger.info('Cleared all request headers');
    return { _summary: 'Headers cleared' };
  }
}
