import { Block } from '../base';
import { BlockDefinition } from '../../types';

// Variable blocks
export { LogicSetVariableBlock } from './LogicSetVariableBlock';
export { LogicGetVariableBlock } from './LogicGetVariableBlock';

// Control flow blocks
export { LogicIfBlock } from './LogicIfBlock';
export { LogicRepeatBlock } from './LogicRepeatBlock';
export { LogicForeachBlock } from './LogicForeachBlock';
export { LogicTryCatchBlock } from './LogicTryCatchBlock';

// Comparison and boolean blocks
export { LogicCompareBlock } from './LogicCompareBlock';
export { LogicBooleanOpBlock } from './LogicBooleanOpBlock';
export { LogicNotBlock } from './LogicNotBlock';

// Value blocks
export { LogicTextBlock } from './LogicTextBlock';
export { LogicNumberBlock } from './LogicNumberBlock';
export { LogicBooleanBlock } from './LogicBooleanBlock';
export { LogicObjectBlock } from './LogicObjectBlock';
export { LogicArrayBlock } from './LogicArrayBlock';

// Utility blocks
export { LogicLogBlock } from './LogicLogBlock';
export { LogicCommentBlock } from './LogicCommentBlock';
export { LogicFailBlock } from './LogicFailBlock';
export { LogicAssertBlock } from './LogicAssertBlock';

// Import all block classes
import { LogicSetVariableBlock } from './LogicSetVariableBlock';
import { LogicGetVariableBlock } from './LogicGetVariableBlock';
import { LogicIfBlock } from './LogicIfBlock';
import { LogicRepeatBlock } from './LogicRepeatBlock';
import { LogicForeachBlock } from './LogicForeachBlock';
import { LogicTryCatchBlock } from './LogicTryCatchBlock';
import { LogicCompareBlock } from './LogicCompareBlock';
import { LogicBooleanOpBlock } from './LogicBooleanOpBlock';
import { LogicNotBlock } from './LogicNotBlock';
import { LogicTextBlock } from './LogicTextBlock';
import { LogicNumberBlock } from './LogicNumberBlock';
import { LogicBooleanBlock } from './LogicBooleanBlock';
import { LogicObjectBlock } from './LogicObjectBlock';
import { LogicArrayBlock } from './LogicArrayBlock';
import { LogicLogBlock } from './LogicLogBlock';
import { LogicCommentBlock } from './LogicCommentBlock';
import { LogicFailBlock } from './LogicFailBlock';
import { LogicAssertBlock } from './LogicAssertBlock';

/**
 * All Logic block class instances.
 */
export const logicBlockClasses: Block[] = [
  // Variable blocks
  new LogicSetVariableBlock(),
  new LogicGetVariableBlock(),
  // Control flow
  new LogicIfBlock(),
  new LogicCompareBlock(),
  new LogicBooleanOpBlock(),
  new LogicNotBlock(),
  new LogicRepeatBlock(),
  new LogicForeachBlock(),
  new LogicTryCatchBlock(),
  // Utility
  new LogicLogBlock(),
  new LogicCommentBlock(),
  // Value blocks
  new LogicTextBlock(),
  new LogicNumberBlock(),
  new LogicBooleanBlock(),
  new LogicObjectBlock(),
  new LogicArrayBlock(),
  // Assertion/fail
  new LogicFailBlock(),
  new LogicAssertBlock(),
];

/**
 * Logic blocks as BlockDefinition array for backward compatibility.
 */
export const logicBlocks: BlockDefinition[] = logicBlockClasses.map(block => block.toDefinition());
