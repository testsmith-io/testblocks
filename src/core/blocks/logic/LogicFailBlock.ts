import { Block } from '../base';
import { BlockInput, ExecutionContext } from '../../types';
import { resolveVariables } from '../utils';

/**
 * Fail the test with a message.
 * Note: This block has previousStatement but no nextStatement.
 */
export class LogicFailBlock extends Block {
  readonly type = 'logic_fail';
  readonly category = 'Logic';
  readonly color = '#f44336';
  readonly tooltip = 'Fail the test with a message';
  readonly previousStatement = true;
  readonly nextStatement = false;

  getInputs(): BlockInput[] {
    return [
      { name: 'MESSAGE', type: 'field', fieldType: 'text', default: 'Test failed' },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const message = resolveVariables(params.MESSAGE as string, context);
    throw new Error(message);
  }
}
