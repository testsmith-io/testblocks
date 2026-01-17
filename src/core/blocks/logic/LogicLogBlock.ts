import { StatementBlock } from '../base';
import { BlockInput, ExecutionContext } from '../../types';
import { resolveVariables } from '../utils';

/**
 * Log a message.
 */
export class LogicLogBlock extends StatementBlock {
  readonly type = 'logic_log';
  readonly category = 'Logic';
  readonly color = '#607D8B';
  readonly tooltip = 'Log a message';

  getInputs(): BlockInput[] {
    return [
      { name: 'LEVEL', type: 'field', fieldType: 'dropdown', options: [['Info', 'info'], ['Warning', 'warn'], ['Error', 'error'], ['Debug', 'debug']] },
      { name: 'MESSAGE', type: 'field', fieldType: 'text', required: true },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const level = (params.LEVEL as 'info' | 'warn' | 'error' | 'debug') || 'info';
    const message = resolveVariables(params.MESSAGE as string, context);

    context.logger[level](message);
    return { _message: message, _summary: message };
  }
}
