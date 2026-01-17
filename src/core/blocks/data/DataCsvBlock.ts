import { ValueBlock } from '../base';
import { BlockInput, BlockOutput, ExecutionContext } from '../../types';
import { resolveVariables } from '../utils';

/**
 * Parse CSV-style data (first row as headers).
 */
export class DataCsvBlock extends ValueBlock {
  readonly type = 'data_csv';
  readonly category = 'Data';
  readonly color = '#00897B';
  readonly tooltip = 'Parse CSV-style data (first row as headers)';
  readonly output: BlockOutput = { type: 'Array' };

  getInputs(): BlockInput[] {
    return [
      { name: 'CSV', type: 'field', fieldType: 'text', default: 'name,value\ntest1,100\ntest2,200' },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const csv = resolveVariables(params.CSV as string, context);
    const lines = csv.split('\n').filter(l => l.trim());

    if (lines.length < 2) {
      return [];
    }

    const headers = lines[0].split(',').map(h => h.trim());

    return lines.slice(1).map((line, index) => {
      const values = line.split(',').map(v => {
        const trimmed = v.trim();
        try {
          return JSON.parse(trimmed);
        } catch {
          return trimmed;
        }
      });

      const obj: Record<string, unknown> = {};
      headers.forEach((header, i) => {
        obj[header] = values[i];
      });

      return {
        name: `Row ${index + 1}`,
        values: obj,
      };
    });
  }
}
