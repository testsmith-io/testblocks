import { StatementBlock } from '../base';
import { BlockInput, ExecutionContext } from '../../types';
import { resolveVariables, getContextHeaders, setContextHeaders } from '../utils';

/**
 * Set a single request header that applies to subsequent requests.
 */
export class ApiSetHeaderBlock extends StatementBlock {
  readonly type = 'api_set_header';
  readonly category = 'API';
  readonly color = '#7B1FA2';
  readonly tooltip = 'Set a request header (applies to subsequent requests)';

  getInputs(): BlockInput[] {
    return [
      { name: 'NAME', type: 'field', fieldType: 'text', required: true, default: 'Authorization' },
      { name: 'VALUE', type: 'field', fieldType: 'text', required: true, default: 'Bearer token' },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const name = params.NAME as string;
    const value = resolveVariables(params.VALUE as string, context);

    const headers = getContextHeaders(context);
    headers[name] = value;
    setContextHeaders(context, headers);

    context.logger.info(`Set header: ${name}: ${value.substring(0, 30)}${value.length > 30 ? '...' : ''}`);
    return {
      _summary: `${name}: ${value.substring(0, 30)}${value.length > 30 ? '...' : ''}`,
      name,
      value,
    };
  }
}
