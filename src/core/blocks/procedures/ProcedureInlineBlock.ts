import { ValueBlock } from '../base';
import { BlockInput, BlockOutput, ExecutionContext } from '../../types';

/**
 * Define and immediately use an inline procedure.
 */
export class ProcedureInlineBlock extends ValueBlock {
  readonly type = 'procedure_inline';
  readonly category = 'Procedures';
  readonly color = '#9C27B0';
  readonly tooltip = 'Define and immediately use an inline procedure';
  readonly output: BlockOutput = { type: 'Procedure' };

  getInputs(): BlockInput[] {
    return [
      { name: 'PARAMS', type: 'field', fieldType: 'text', default: '' },
      { name: 'DO', type: 'statement' },
    ];
  }

  async execute(params: Record<string, unknown>, _context: ExecutionContext): Promise<unknown> {
    return {
      inlineProcedure: true,
      params: (params.PARAMS as string).split(',').map(p => p.trim()).filter(p => p),
      statement: 'DO',
    };
  }
}
