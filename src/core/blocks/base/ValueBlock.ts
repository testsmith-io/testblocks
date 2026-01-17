import { Block } from './Block';
import { BlockOutput } from '../../types';

/**
 * Base class for value blocks that output a value.
 * Has no statement connections, only output.
 */
export abstract class ValueBlock extends Block {
  readonly previousStatement: boolean = false;
  readonly nextStatement: boolean = false;

  /** Output type - must be defined by subclasses */
  abstract readonly output: BlockOutput;
}
