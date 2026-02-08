import { StatementBlock } from '../base';
import { BlockInput, ExecutionContext } from '../../types';
import { resolveVariables, mergeHeaders, parseResponse, storeResponse } from '../utils';

/**
 * Perform HTTP DELETE request and store response.
 */
export class ApiDeleteBlock extends StatementBlock {
  readonly type = 'api_delete';
  readonly category = 'API';
  readonly color = '#4CAF50';
  readonly tooltip = 'Perform HTTP DELETE request and store response';

  getInputs(): BlockInput[] {
    return [
      { name: 'URL', type: 'field', fieldType: 'text', required: true },
      { name: 'HEADERS', type: 'field', fieldType: 'text', default: '' },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const url = resolveVariables(params.URL as string, context);
    const headers = mergeHeaders(context, params.HEADERS as string);

    context.logger.info(`DELETE ${url}`);
    const response = await fetch(url, {
      method: 'DELETE',
      headers,
      signal: context.abortSignal,
    });
    const parsed = await parseResponse(response);
    storeResponse(context, parsed);
    return { ...parsed, _summary: `DELETE ${url}`, _requestHeaders: headers };
  }
}
