import { StatementBlock } from '../base';
import { BlockInput, ExecutionContext } from '../../types';
import { resolveVariables, mergeHeaders, parseResponse, storeResponse } from '../utils';

/**
 * Perform HTTP GET request and store response.
 */
export class ApiGetBlock extends StatementBlock {
  readonly type = 'api_get';
  readonly category = 'API';
  readonly color = '#4CAF50';
  readonly tooltip = 'Perform HTTP GET request and store response';

  getInputs(): BlockInput[] {
    return [
      { name: 'URL', type: 'field', fieldType: 'text', required: true },
      { name: 'HEADERS', type: 'field', fieldType: 'text', default: '' },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const url = resolveVariables(params.URL as string, context);
    const headers = mergeHeaders(context, params.HEADERS as string);

    context.logger.info(`GET ${url}`);
    const response = await fetch(url, {
      headers,
      signal: context.abortSignal,
    });
    const parsed = await parseResponse(response);
    storeResponse(context, parsed);
    return { ...parsed, _summary: `GET ${url}`, _requestHeaders: headers };
  }
}
