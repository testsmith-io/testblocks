import { StatementBlock } from '../base';
import { BlockInput, ExecutionContext } from '../../types';

/**
 * Set a variable value.
 */
export class LogicSetVariableBlock extends StatementBlock {
  readonly type = 'logic_set_variable';
  readonly category = 'Logic';
  readonly color = '#795548';
  readonly tooltip = 'Set a variable value';

  getInputs(): BlockInput[] {
    return [
      { name: 'NAME', type: 'field', fieldType: 'text', required: true },
      { name: 'VALUE', type: 'value', required: true },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const name = params.NAME as string;
    let value = params.VALUE;

    // If the value is a block result with _value, extract just the value
    if (value && typeof value === 'object' && '_value' in value) {
      value = (value as { _value: unknown })._value;
    }

    context.variables.set(name, value);
    context.logger.debug(`Set variable ${name} = ${JSON.stringify(value)}`);
    return undefined;
  }
}
