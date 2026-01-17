import { StatementBlock } from '../base';
import { BlockInput, ExecutionContext } from '../../types';

/**
 * Fill multiple form fields from a data object.
 */
export class ProcedureFillFormBlock extends StatementBlock {
  readonly type = 'procedure_fill_form';
  readonly category = 'Procedures';
  readonly color = '#AB47BC';
  readonly tooltip = 'Fill multiple form fields from a data object';

  getInputs(): BlockInput[] {
    return [
      { name: 'FIELDS', type: 'value', check: 'Object', required: true },
    ];
  }

  async execute(params: Record<string, unknown>, _context: ExecutionContext): Promise<unknown> {
    const fields = params.FIELDS as Record<string, string>;

    const steps = Object.entries(fields).map(([selector, value]) => ({
      type: 'web_fill',
      params: { SELECTOR: selector, VALUE: value },
    }));

    return { compoundAction: 'fillForm', steps };
  }
}
