import { ValueBlock } from '../base';
import { BlockInput, BlockOutput, ExecutionContext } from '../../types';
import { resolveVariables } from '../utils';

/**
 * Create a headers object.
 */
export class ApiHeadersBlock extends ValueBlock {
  readonly type = 'api_headers';
  readonly category = 'API';
  readonly color = '#9C27B0';
  readonly tooltip = 'Create a headers object';
  readonly output: BlockOutput = { type: 'Object' };

  getInputs(): BlockInput[] {
    return [
      { name: 'AUTH_TYPE', type: 'field', fieldType: 'dropdown', options: [['None', 'none'], ['Bearer Token', 'bearer'], ['Basic Auth', 'basic'], ['API Key', 'apikey']] },
      { name: 'AUTH_VALUE', type: 'field', fieldType: 'text' },
      { name: 'CUSTOM', type: 'value', check: 'Object' },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const authType = params.AUTH_TYPE as string;
    const authValue = resolveVariables(params.AUTH_VALUE as string || '', context);
    const custom = (params.CUSTOM as Record<string, string>) || {};

    const headers: Record<string, string> = { ...custom };

    switch (authType) {
      case 'bearer':
        headers['Authorization'] = `Bearer ${authValue}`;
        break;
      case 'basic':
        headers['Authorization'] = `Basic ${Buffer.from(authValue).toString('base64')}`;
        break;
      case 'apikey':
        headers['X-API-Key'] = authValue;
        break;
    }

    return headers;
  }
}
