import { Block } from '../base';
import { BlockDefinition } from '../../types';

// Test case blocks
export { TestCaseBlock } from './TestCaseBlock';
export { TestCaseDataDrivenBlock } from './TestCaseDataDrivenBlock';

// Lifecycle hooks
export { LifecycleBeforeAllBlock } from './LifecycleBeforeAllBlock';
export { LifecycleAfterAllBlock } from './LifecycleAfterAllBlock';
export { LifecycleBeforeEachBlock } from './LifecycleBeforeEachBlock';
export { LifecycleAfterEachBlock } from './LifecycleAfterEachBlock';

// In-test lifecycle blocks
export { LifecycleSetupBlock } from './LifecycleSetupBlock';
export { LifecycleTeardownBlock } from './LifecycleTeardownBlock';
export { LifecycleOnFailureBlock } from './LifecycleOnFailureBlock';
export { LifecycleSkipIfBlock } from './LifecycleSkipIfBlock';
export { LifecycleRetryBlock } from './LifecycleRetryBlock';

// Import all block classes
import { TestCaseBlock } from './TestCaseBlock';
import { TestCaseDataDrivenBlock } from './TestCaseDataDrivenBlock';
import { LifecycleBeforeAllBlock } from './LifecycleBeforeAllBlock';
import { LifecycleAfterAllBlock } from './LifecycleAfterAllBlock';
import { LifecycleBeforeEachBlock } from './LifecycleBeforeEachBlock';
import { LifecycleAfterEachBlock } from './LifecycleAfterEachBlock';
import { LifecycleSetupBlock } from './LifecycleSetupBlock';
import { LifecycleTeardownBlock } from './LifecycleTeardownBlock';
import { LifecycleOnFailureBlock } from './LifecycleOnFailureBlock';
import { LifecycleSkipIfBlock } from './LifecycleSkipIfBlock';
import { LifecycleRetryBlock } from './LifecycleRetryBlock';

/**
 * All Lifecycle block class instances.
 */
export const lifecycleBlockClasses: Block[] = [
  // Test case blocks
  new TestCaseBlock(),
  new TestCaseDataDrivenBlock(),
  // Suite-level lifecycle hooks
  new LifecycleBeforeAllBlock(),
  new LifecycleAfterAllBlock(),
  new LifecycleBeforeEachBlock(),
  new LifecycleAfterEachBlock(),
  // In-test lifecycle blocks
  new LifecycleSetupBlock(),
  new LifecycleTeardownBlock(),
  new LifecycleOnFailureBlock(),
  new LifecycleSkipIfBlock(),
  new LifecycleRetryBlock(),
];

/**
 * Lifecycle blocks as BlockDefinition array for backward compatibility.
 */
export const lifecycleBlocks: BlockDefinition[] = lifecycleBlockClasses.map(block => block.toDefinition());
