import { StatementBlock } from './StatementBlock';

/**
 * Base class for control flow blocks that return branch/loop instructions.
 * Extends StatementBlock with special return types for executor handling.
 *
 * Control flow blocks include:
 * - logic_if (returns { branch: 'DO' | 'ELSE' })
 * - logic_repeat (returns { loop: true, times, statement })
 * - logic_foreach (returns { loop: true, array, varName, statement })
 * - logic_try_catch (returns { tryCatch: true })
 */
export abstract class ControlFlowBlock extends StatementBlock {
  // Control flow blocks are statement blocks that return special
  // instructions for the executor to handle branching/looping
}
