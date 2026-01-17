import { StatementBlock } from '../base';
import { BlockInput, ExecutionContext } from '../../types';
import { getLastResponse, getValueByPath } from '../utils';

/**
 * Extract a value from response using dot notation (e.g., data.user.name).
 * Legacy block kept for backwards compatibility.
 */
export class ApiExtractBlock extends StatementBlock {
  readonly type = 'api_extract';
  readonly category = 'API';
  readonly color = '#2196F3';
  readonly tooltip = 'Extract a value from response using dot notation (e.g., data.user.name)';

  getInputs(): BlockInput[] {
    return [
      { name: 'PATH', type: 'field', fieldType: 'text', required: true },
      { name: 'VARIABLE', type: 'field', fieldType: 'text', required: true },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const response = getLastResponse(context);
    const path = params.PATH as string;
    const varName = params.VARIABLE as string;

    const value = getValueByPath(response.body, path);
    context.variables.set(varName, value);
    const valueStr = JSON.stringify(value);
    context.logger.info(`Extracted ${path} → ${varName} = ${valueStr}`);
    return {
      _summary: `${varName} = ${valueStr.substring(0, 50)}${valueStr.length > 50 ? '...' : ''}`,
      variable: varName,
      path,
      value,
    };
  }
}
