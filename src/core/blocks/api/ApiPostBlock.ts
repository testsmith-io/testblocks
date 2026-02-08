import { StatementBlock } from '../base';
import { BlockInput, ExecutionContext } from '../../types';
import { resolveVariables, mergeHeaders, parseResponse, storeResponse } from '../utils';

/**
 * Perform HTTP POST request and store response.
 */
export class ApiPostBlock extends StatementBlock {
  readonly type = 'api_post';
  readonly category = 'API';
  readonly color = '#4CAF50';
  readonly tooltip = 'Perform HTTP POST request and store response';

  getInputs(): BlockInput[] {
    return [
      { name: 'URL', type: 'field', fieldType: 'text', required: true },
      { name: 'BODY', type: 'field', fieldType: 'text', default: '{}' },
      { name: 'HEADERS', type: 'field', fieldType: 'text', default: '' },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const url = resolveVariables(params.URL as string, context);
    const bodyStr = resolveVariables(params.BODY as string || '{}', context);
    const inlineHeaders = mergeHeaders(context, params.HEADERS as string);

    let body: unknown;
    try {
      body = JSON.parse(bodyStr);
    } catch {
      body = bodyStr;
    }

    context.logger.info(`POST ${url}`);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...inlineHeaders },
      body: typeof body === 'string' ? body : JSON.stringify(body),
      signal: context.abortSignal,
    });
    const parsed = await parseResponse(response);
    storeResponse(context, parsed);
    const requestHeaders = { 'Content-Type': 'application/json', ...inlineHeaders };
    return { ...parsed, _summary: `POST ${url}`, _requestHeaders: requestHeaders, _requestBody: body };
  }
}
