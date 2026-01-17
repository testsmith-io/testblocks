import { ControlFlowBlock } from '../base';
import { BlockInput, ExecutionContext } from '../../types';

/**
 * Run steps for each item in a data set.
 */
export class DataForeachBlock extends ControlFlowBlock {
  readonly type = 'data_foreach';
  readonly category = 'Data';
  readonly color = '#00897B';
  readonly tooltip = 'Run steps for each item in a data set';

  getInputs(): BlockInput[] {
    return [
      { name: 'DATA', type: 'value', check: 'Array', required: true },
      { name: 'ITEM_VAR', type: 'field', fieldType: 'text', default: 'item' },
      { name: 'INDEX_VAR', type: 'field', fieldType: 'text', default: 'index' },
      { name: 'DO', type: 'statement' },
    ];
  }

  async execute(params: Record<string, unknown>, _context: ExecutionContext): Promise<unknown> {
    const data = params.DATA as unknown[];
    const itemVar = params.ITEM_VAR as string;
    const indexVar = params.INDEX_VAR as string;

    return {
      dataLoop: true,
      data,
      itemVar,
      indexVar,
      statement: 'DO',
    };
  }
}
