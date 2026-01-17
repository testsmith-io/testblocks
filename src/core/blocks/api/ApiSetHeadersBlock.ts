import { StatementBlock } from '../base';
import { BlockInput, ExecutionContext } from '../../types';
import { resolveVariables, getContextHeaders, setContextHeaders } from '../utils';

/**
 * Set multiple request headers from a JSON object.
 */
export class ApiSetHeadersBlock extends StatementBlock {
  readonly type = 'api_set_headers';
  readonly category = 'API';
  readonly color = '#7B1FA2';
  readonly tooltip = 'Set multiple request headers from JSON object';

  getInputs(): BlockInput[] {
    return [
      { name: 'HEADERS', type: 'field', fieldType: 'text', required: true, default: '{"Content-Type": "application/json"}' },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const headersStr = resolveVariables(params.HEADERS as string, context);

    try {
      const newHeaders = JSON.parse(headersStr) as Record<string, string>;

      const headers = getContextHeaders(context);
      Object.assign(headers, newHeaders);
      setContextHeaders(context, headers);

      const headerNames = Object.keys(newHeaders).join(', ');
      context.logger.info(`Set headers: ${headerNames}`);
      return {
        _summary: `Set ${Object.keys(newHeaders).length} headers`,
        headers: newHeaders,
      };
    } catch {
      throw new Error(`Invalid JSON for headers: ${headersStr}`);
    }
  }
}
