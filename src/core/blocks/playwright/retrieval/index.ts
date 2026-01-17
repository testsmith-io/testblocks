import { Block } from '../../base';
import { BlockDefinition } from '../../../types';

export { WebGetTextBlock } from './WebGetTextBlock';
export { WebGetAttributeBlock } from './WebGetAttributeBlock';
export { WebGetInputValueBlock } from './WebGetInputValueBlock';
export { WebGetTitleBlock } from './WebGetTitleBlock';
export { WebGetUrlBlock } from './WebGetUrlBlock';
export { WebCountElementsBlock } from './WebCountElementsBlock';

import { WebGetTextBlock } from './WebGetTextBlock';
import { WebGetAttributeBlock } from './WebGetAttributeBlock';
import { WebGetInputValueBlock } from './WebGetInputValueBlock';
import { WebGetTitleBlock } from './WebGetTitleBlock';
import { WebGetUrlBlock } from './WebGetUrlBlock';
import { WebCountElementsBlock } from './WebCountElementsBlock';

/**
 * All retrieval block class instances.
 */
export const retrievalBlockClasses: Block[] = [
  new WebGetTextBlock(),
  new WebGetAttributeBlock(),
  new WebGetInputValueBlock(),
  new WebGetTitleBlock(),
  new WebGetUrlBlock(),
  new WebCountElementsBlock(),
];

/**
 * Retrieval blocks as BlockDefinition array for backward compatibility.
 */
export const retrievalBlocks: BlockDefinition[] = retrievalBlockClasses.map(block => block.toDefinition());
