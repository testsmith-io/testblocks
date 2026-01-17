import { Block } from '../base';
import { BlockDefinition } from '../../types';

// Registry functions
export { registerProcedure, getProcedure, clearProcedures } from './procedureRegistry';

// Procedure definition and execution blocks
export { ProcedureDefineBlock } from './ProcedureDefineBlock';
export { ProcedureCallBlock } from './ProcedureCallBlock';
export { ProcedureCallWithReturnBlock } from './ProcedureCallWithReturnBlock';
export { ProcedureReturnBlock } from './ProcedureReturnBlock';
export { ProcedureGetParamBlock } from './ProcedureGetParamBlock';
export { ProcedureInlineBlock } from './ProcedureInlineBlock';
export { ProcedureMapBlock } from './ProcedureMapBlock';

// Common action blocks
export { ProcedureLoginBlock } from './ProcedureLoginBlock';
export { ProcedureWaitAndClickBlock } from './ProcedureWaitAndClickBlock';
export { ProcedureFillFormBlock } from './ProcedureFillFormBlock';

// Import all block classes
import { ProcedureDefineBlock } from './ProcedureDefineBlock';
import { ProcedureCallBlock } from './ProcedureCallBlock';
import { ProcedureCallWithReturnBlock } from './ProcedureCallWithReturnBlock';
import { ProcedureReturnBlock } from './ProcedureReturnBlock';
import { ProcedureGetParamBlock } from './ProcedureGetParamBlock';
import { ProcedureInlineBlock } from './ProcedureInlineBlock';
import { ProcedureMapBlock } from './ProcedureMapBlock';
import { ProcedureLoginBlock } from './ProcedureLoginBlock';
import { ProcedureWaitAndClickBlock } from './ProcedureWaitAndClickBlock';
import { ProcedureFillFormBlock } from './ProcedureFillFormBlock';

/**
 * All Procedure block class instances.
 */
export const procedureBlockClasses: Block[] = [
  // Core procedure blocks
  new ProcedureDefineBlock(),
  new ProcedureCallBlock(),
  new ProcedureCallWithReturnBlock(),
  new ProcedureReturnBlock(),
  new ProcedureGetParamBlock(),
  new ProcedureInlineBlock(),
  new ProcedureMapBlock(),
  // Common action blocks
  new ProcedureLoginBlock(),
  new ProcedureWaitAndClickBlock(),
  new ProcedureFillFormBlock(),
];

/**
 * Procedure blocks as BlockDefinition array for backward compatibility.
 */
export const procedureBlocks: BlockDefinition[] = procedureBlockClasses.map(block => block.toDefinition());
