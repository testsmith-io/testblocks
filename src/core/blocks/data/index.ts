import { Block } from '../base';
import { BlockDefinition } from '../../types';

// Data definition blocks
export { DataDefineBlock } from './DataDefineBlock';
export { DataFromVariableBlock } from './DataFromVariableBlock';
export { DataRowBlock } from './DataRowBlock';
export { DataTableBlock } from './DataTableBlock';
export { DataCsvBlock } from './DataCsvBlock';
export { DataRangeBlock } from './DataRangeBlock';

// Data access blocks
export { DataGetCurrentBlock } from './DataGetCurrentBlock';
export { DataGetIndexBlock } from './DataGetIndexBlock';
export { DataGetNameBlock } from './DataGetNameBlock';

// Control flow
export { DataForeachBlock } from './DataForeachBlock';

// Import all block classes
import { DataDefineBlock } from './DataDefineBlock';
import { DataFromVariableBlock } from './DataFromVariableBlock';
import { DataRowBlock } from './DataRowBlock';
import { DataTableBlock } from './DataTableBlock';
import { DataCsvBlock } from './DataCsvBlock';
import { DataRangeBlock } from './DataRangeBlock';
import { DataGetCurrentBlock } from './DataGetCurrentBlock';
import { DataGetIndexBlock } from './DataGetIndexBlock';
import { DataGetNameBlock } from './DataGetNameBlock';
import { DataForeachBlock } from './DataForeachBlock';

/**
 * All Data block class instances.
 */
export const dataBlockClasses: Block[] = [
  // Data definition
  new DataDefineBlock(),
  new DataFromVariableBlock(),
  new DataGetCurrentBlock(),
  new DataGetIndexBlock(),
  new DataGetNameBlock(),
  new DataForeachBlock(),
  new DataRowBlock(),
  new DataTableBlock(),
  new DataCsvBlock(),
  new DataRangeBlock(),
];

/**
 * Data-driven blocks as BlockDefinition array for backward compatibility.
 */
export const dataDrivenBlocks: BlockDefinition[] = dataBlockClasses.map(block => block.toDefinition());
