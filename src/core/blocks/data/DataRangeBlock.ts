import { ValueBlock } from '../base';
import { BlockInput, BlockOutput, ExecutionContext } from '../../types';

/**
 * Generate a range of numbers as data.
 */
export class DataRangeBlock extends ValueBlock {
  readonly type = 'data_range';
  readonly category = 'Data';
  readonly color = '#00897B';
  readonly tooltip = 'Generate a range of numbers as data';
  readonly output: BlockOutput = { type: 'Array' };

  getInputs(): BlockInput[] {
    return [
      { name: 'START', type: 'field', fieldType: 'number', default: 1 },
      { name: 'END', type: 'field', fieldType: 'number', default: 10 },
      { name: 'STEP', type: 'field', fieldType: 'number', default: 1 },
      { name: 'VAR_NAME', type: 'field', fieldType: 'text', default: 'n' },
    ];
  }

  async execute(params: Record<string, unknown>, _context: ExecutionContext): Promise<unknown> {
    const start = params.START as number;
    const end = params.END as number;
    const step = params.STEP as number;
    const varName = params.VAR_NAME as string;

    const result = [];
    for (let i = start; i <= end; i += step) {
      result.push({
        name: `${varName}=${i}`,
        values: { [varName]: i },
      });
    }
    return result;
  }
}
