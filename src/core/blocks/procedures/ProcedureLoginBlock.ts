import { StatementBlock } from '../base';
import { BlockInput, ExecutionContext } from '../../types';

/**
 * Common login action with username and password.
 */
export class ProcedureLoginBlock extends StatementBlock {
  readonly type = 'procedure_login';
  readonly category = 'Procedures';
  readonly color = '#AB47BC';
  readonly tooltip = 'Common login action with username and password';

  getInputs(): BlockInput[] {
    return [
      { name: 'USERNAME_SELECTOR', type: 'field', fieldType: 'text', default: '#username' },
      { name: 'PASSWORD_SELECTOR', type: 'field', fieldType: 'text', default: '#password' },
      { name: 'SUBMIT_SELECTOR', type: 'field', fieldType: 'text', default: 'button[type="submit"]' },
      { name: 'USERNAME', type: 'value', check: 'String', required: true },
      { name: 'PASSWORD', type: 'value', check: 'String', required: true },
    ];
  }

  async execute(params: Record<string, unknown>, _context: ExecutionContext): Promise<unknown> {
    // This is a compound action that expands to multiple steps
    return {
      compoundAction: 'login',
      steps: [
        { type: 'web_fill', params: { SELECTOR: params.USERNAME_SELECTOR, VALUE: params.USERNAME } },
        { type: 'web_fill', params: { SELECTOR: params.PASSWORD_SELECTOR, VALUE: params.PASSWORD } },
        { type: 'web_click', params: { SELECTOR: params.SUBMIT_SELECTOR } },
      ],
    };
  }
}
