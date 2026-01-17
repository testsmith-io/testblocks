import { ValueBlock } from '../base';
import { BlockInput, BlockOutput, ExecutionContext } from '../../types';

/**
 * Apply a procedure to each item in an array.
 */
export class ProcedureMapBlock extends ValueBlock {
  readonly type = 'procedure_map';
  readonly category = 'Procedures';
  readonly color = '#9C27B0';
  readonly tooltip = 'Apply a procedure to each item in an array';
  readonly output: BlockOutput = { type: 'Array' };

  getInputs(): BlockInput[] {
    return [
      { name: 'ARRAY', type: 'value', check: 'Array', required: true },
      { name: 'PROCEDURE', type: 'field', fieldType: 'text', required: true },
      { name: 'ITEM_PARAM', type: 'field', fieldType: 'text', default: 'item' },
    ];
  }

  async execute(params: Record<string, unknown>, _context: ExecutionContext): Promise<unknown> {
    const array = params.ARRAY as unknown[];
    const procedureName = params.PROCEDURE as string;
    const itemParam = params.ITEM_PARAM as string;

    return {
      procedureMap: true,
      array,
      procedureName,
      itemParam,
    };
  }
}
