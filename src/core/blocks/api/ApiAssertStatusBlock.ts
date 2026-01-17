import { StatementBlock } from '../base';
import { BlockInput, ExecutionContext } from '../../types';
import { getLastResponse } from '../utils';
import { handleAssertion } from '../assertions';

/**
 * Assert that response has expected status code.
 */
export class ApiAssertStatusBlock extends StatementBlock {
  readonly type = 'api_assert_status';
  readonly category = 'API';
  readonly color = '#FF9800';
  readonly tooltip = 'Assert that response has expected status code';

  getInputs(): BlockInput[] {
    return [
      { name: 'STATUS', type: 'field', fieldType: 'number', default: 200, required: true },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const response = getLastResponse(context);
    const expectedStatus = params.STATUS as number;

    handleAssertion(
      context,
      response.status === expectedStatus,
      `Expected status ${expectedStatus} but got ${response.status}`,
      { stepType: 'api_assert_status', expected: expectedStatus, actual: response.status }
    );

    context.logger.info(`✓ Status is ${expectedStatus}`);
    return {
      _summary: `✓ Status ${response.status} === ${expectedStatus}`,
      expected: expectedStatus,
      actual: response.status,
    };
  }
}
