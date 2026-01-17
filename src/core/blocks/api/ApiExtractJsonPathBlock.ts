import { StatementBlock } from '../base';
import { BlockInput, ExecutionContext } from '../../types';
import { getLastResponse } from '../utils';
import { JSONPath } from 'jsonpath-plus';

/**
 * Extract a value from JSON response using JSONPath expression.
 */
export class ApiExtractJsonPathBlock extends StatementBlock {
  readonly type = 'api_extract_jsonpath';
  readonly category = 'API';
  readonly color = '#2196F3';
  readonly tooltip = 'Extract a value from JSON response using JSONPath expression';

  getInputs(): BlockInput[] {
    return [
      { name: 'JSONPATH', type: 'field', fieldType: 'text', required: true, default: '$.data.id' },
      { name: 'VARIABLE', type: 'field', fieldType: 'text', required: true },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const response = getLastResponse(context);
    const jsonPath = params.JSONPATH as string;
    const varName = params.VARIABLE as string;

    try {
      const results = JSONPath({ path: jsonPath, json: response.body as object }) as unknown[];
      // If single result, unwrap from array
      const value = results.length === 1 ? results[0] : results;
      context.variables.set(varName, value);
      const valueStr = JSON.stringify(value);
      context.logger.info(`Extracted (JSONPath) ${jsonPath} → ${varName} = ${valueStr}`);
      return {
        _summary: `${varName} = ${valueStr.substring(0, 50)}${valueStr.length > 50 ? '...' : ''}`,
        variable: varName,
        jsonPath,
        value,
      };
    } catch (e) {
      throw new Error(`Invalid JSONPath expression: ${jsonPath}. Error: ${(e as Error).message}`);
    }
  }
}
