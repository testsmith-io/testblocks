import { Block } from './Block';

/**
 * Base class for statement blocks that chain together sequentially.
 * Has previousStatement and nextStatement connections enabled.
 */
export abstract class StatementBlock extends Block {
  readonly previousStatement: boolean = true;
  readonly nextStatement: boolean = true;
}
