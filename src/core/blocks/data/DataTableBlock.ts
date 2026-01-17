import { ValueBlock } from '../base';
import { BlockInput, BlockOutput, ExecutionContext } from '../../types';
import { resolveVariables } from '../utils';

/**
 * Create a data table with headers and rows.
 */
export class DataTableBlock extends ValueBlock {
  readonly type = 'data_table';
  readonly category = 'Data';
  readonly color = '#00897B';
  readonly tooltip = 'Create a data table with headers and rows';
  readonly output: BlockOutput = { type: 'Array' };

  getInputs(): BlockInput[] {
    return [
      { name: 'HEADERS', type: 'field', fieldType: 'text', default: 'username, password, expected' },
      { name: 'ROWS', type: 'field', fieldType: 'text', default: 'user1, pass1, true\nuser2, pass2, false' },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const headersStr = params.HEADERS as string;
    const rowsStr = resolveVariables(params.ROWS as string, context);

    const headers = headersStr.split(',').map(h => h.trim());
    const rows = rowsStr.split('\n').filter(r => r.trim());

    return rows.map((row, index) => {
      const values = row.split(',').map(v => {
        const trimmed = v.trim();
        // Try to parse as JSON for numbers, booleans, etc.
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
