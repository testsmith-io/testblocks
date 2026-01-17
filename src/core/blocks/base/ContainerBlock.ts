import { Block } from './Block';

/**
 * Base class for container blocks with custom multi-message layouts.
 * Used for blocks like test_case, lifecycle hooks that need special Blockly layouts.
 */
export abstract class ContainerBlock extends Block {
  readonly previousStatement: boolean = false;
  readonly nextStatement: boolean = false;

  /**
   * Override toBlocklyJson for custom multi-message layout.
   * Subclasses should implement their specific layout.
   */
  abstract toBlocklyJson(): Record<string, unknown>;
}
