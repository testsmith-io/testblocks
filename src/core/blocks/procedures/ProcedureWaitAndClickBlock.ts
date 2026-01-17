import { StatementBlock } from '../base';
import { BlockInput, ExecutionContext } from '../../types';

/**
 * Wait for element to be visible then click.
 */
export class ProcedureWaitAndClickBlock extends StatementBlock {
  readonly type = 'procedure_wait_and_click';
  readonly category = 'Procedures';
  readonly color = '#AB47BC';
  readonly tooltip = 'Wait for element to be visible then click';

  getInputs(): BlockInput[] {
    return [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
      { name: 'TIMEOUT', type: 'field', fieldType: 'number', default: 30000 },
    ];
  }

  async execute(params: Record<string, unknown>, _context: ExecutionContext): Promise<unknown> {
    return {
      compoundAction: 'waitAndClick',
      steps: [
        { type: 'web_wait_for_element', params: { SELECTOR: params.SELECTOR, STATE: 'visible', TIMEOUT: params.TIMEOUT } },
        { type: 'web_click', params: { SELECTOR: params.SELECTOR } },
      ],
    };
  }
}
