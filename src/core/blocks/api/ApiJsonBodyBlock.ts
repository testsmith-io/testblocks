import { ValueBlock } from '../base';
import { BlockInput, BlockOutput, ExecutionContext } from '../../types';
import { resolveVariables } from '../utils';

/**
 * Create a JSON body from key-value pairs or raw JSON.
 */
export class ApiJsonBodyBlock extends ValueBlock {
  readonly type = 'api_json_body';
  readonly category = 'API';
  readonly color = '#9C27B0';
  readonly tooltip = 'Create a JSON body from key-value pairs or raw JSON';
  readonly output: BlockOutput = { type: 'Object' };

  getInputs(): BlockInput[] {
    return [
      { name: 'JSON', type: 'field', fieldType: 'text', default: '{}' },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const json = resolveVariables(params.JSON as string, context);
    return JSON.parse(json);
  }
}
