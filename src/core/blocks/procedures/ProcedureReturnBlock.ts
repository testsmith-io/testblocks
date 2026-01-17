import { Block } from '../base';
import { BlockInput, ExecutionContext } from '../../types';

/**
 * Return a value from a procedure.
 */
export class ProcedureReturnBlock extends Block {
  readonly type = 'procedure_return';
  readonly category = 'Procedures';
  readonly color = '#9C27B0';
  readonly tooltip = 'Return a value from a procedure';
  readonly previousStatement = true;
  readonly nextStatement = false;

  getInputs(): BlockInput[] {
    return [
      { name: 'VALUE', type: 'value' },
    ];
  }

  async execute(params: Record<string, unknown>, _context: ExecutionContext): Promise<unknown> {
    const value = params.VALUE;
    return { procedureReturn: true, value };
  }
}
