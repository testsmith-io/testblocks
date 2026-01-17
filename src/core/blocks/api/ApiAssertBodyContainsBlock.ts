import { StatementBlock } from '../base';
import { BlockInput, ExecutionContext } from '../../types';
import { resolveVariables, getLastResponse, getValueByPath } from '../utils';
import { handleAssertion } from '../assertions';

/**
 * Assert that response body contains expected value.
 */
export class ApiAssertBodyContainsBlock extends StatementBlock {
  readonly type = 'api_assert_body_contains';
  readonly category = 'API';
  readonly color = '#FF9800';
  readonly tooltip = 'Assert that response body contains expected value';

  getInputs(): BlockInput[] {
    return [
      { name: 'PATH', type: 'field', fieldType: 'text', default: '' },
      { name: 'VALUE', type: 'field', fieldType: 'text', required: true },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const response = getLastResponse(context);
    const path = params.PATH as string;
    const expectedValue = resolveVariables(params.VALUE as string, context);

    const actualValue = path ? getValueByPath(response.body, path) : response.body;
    const actualStr = typeof actualValue === 'string' ? actualValue : JSON.stringify(actualValue);

    handleAssertion(
      context,
      actualStr.includes(expectedValue),
      `Expected ${path || 'body'} to contain "${expectedValue}" but got "${actualStr}"`,
      { stepType: 'api_assert_body_contains', expected: expectedValue, actual: actualStr }
    );

    context.logger.info(`✓ ${path || 'body'} contains "${expectedValue}"`);
    return {
      _summary: `✓ ${path || 'body'} contains "${expectedValue}"`,
      path: path || 'body',
      expected: expectedValue,
      actual: actualStr.substring(0, 100) + (actualStr.length > 100 ? '...' : ''),
    };
  }
}
