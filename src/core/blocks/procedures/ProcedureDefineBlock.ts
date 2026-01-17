import { Block } from '../base';
import { BlockInput, ExecutionContext, ProcedureDefinition } from '../../types';
import { registerProcedure } from './procedureRegistry';

/**
 * Define a reusable procedure with parameters.
 */
export class ProcedureDefineBlock extends Block {
  readonly type = 'procedure_define';
  readonly category = 'Procedures';
  readonly color = '#9C27B0';
  readonly tooltip = 'Define a reusable procedure with parameters';
  readonly previousStatement = false;
  readonly nextStatement = false;

  getInputs(): BlockInput[] {
    return [
      { name: 'NAME', type: 'field', fieldType: 'text', required: true },
      { name: 'DESCRIPTION', type: 'field', fieldType: 'text', default: '' },
      { name: 'PARAMS', type: 'field', fieldType: 'text', default: '' }, // comma-separated: "username, password, timeout"
      { name: 'DO', type: 'statement' },
    ];
  }

  async execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown> {
    const name = params.NAME as string;
    const description = params.DESCRIPTION as string;
    const paramsStr = params.PARAMS as string;

    // Parse parameters
    const procedureParams = paramsStr
      .split(',')
      .map(p => p.trim())
      .filter(p => p)
      .map(p => {
        // Support type annotations: "username:string", "count:number"
        const [paramName, paramType] = p.split(':').map(s => s.trim());
        return {
          name: paramName,
          type: (paramType as 'string' | 'number' | 'boolean' | 'any') || 'any',
        };
      });

    // Register the procedure
    const procedure: ProcedureDefinition = {
      name,
      description,
      params: procedureParams,
      steps: [], // Steps will be extracted by the executor
    };

    registerProcedure(name, procedure);

    if (context.procedures) {
      context.procedures.set(name, procedure);
    }

    context.logger.debug(`Defined procedure: ${name}(${procedureParams.map(p => p.name).join(', ')})`);

    return { procedureDefine: true, name, procedure };
  }
}
