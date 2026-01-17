import { ValueBlock } from '../base';
import { BlockInput, BlockOutput, ExecutionContext } from '../../types';

/**
 * Compare two values.
 */
export class LogicCompareBlock extends ValueBlock {
  readonly type = 'logic_compare';
  readonly category = 'Logic';
  readonly color = '#5C6BC0';
  readonly tooltip = 'Compare two values';
  readonly output: BlockOutput = { type: 'Boolean' };

  getInputs(): BlockInput[] {
    return [
      { name: 'A', type: 'value', required: true },
      { name: 'OP', type: 'field', fieldType: 'dropdown', options: [['=', 'eq'], ['≠', 'neq'], ['<', 'lt'], ['≤', 'lte'], ['>', 'gt'], ['≥', 'gte'], ['contains', 'contains']] },
      { name: 'B', type: 'value', required: true },
    ];
  }

  async execute(params: Record<string, unknown>, _context: ExecutionContext): Promise<unknown> {
    const a = params.A;
    const b = params.B;
    const op = params.OP as string;

    switch (op) {
      case 'eq':
        return JSON.stringify(a) === JSON.stringify(b);
      case 'neq':
        return JSON.stringify(a) !== JSON.stringify(b);
      case 'lt':
        return (a as number) < (b as number);
      case 'lte':
        return (a as number) <= (b as number);
      case 'gt':
        return (a as number) > (b as number);
      case 'gte':
        return (a as number) >= (b as number);
      case 'contains':
        if (typeof a === 'string') return a.includes(b as string);
        if (Array.isArray(a)) return a.includes(b);
        return false;
      default:
        return false;
    }
  }
}
