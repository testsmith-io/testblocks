import { Block } from '../../base';
import { BlockDefinition } from '../../../types';

export { WebClickBlock } from './WebClickBlock';
export { WebFillBlock } from './WebFillBlock';
export { WebTypeBlock } from './WebTypeBlock';
export { WebPressKeyBlock } from './WebPressKeyBlock';
export { WebSelectBlock } from './WebSelectBlock';
export { WebCheckboxBlock } from './WebCheckboxBlock';
export { WebHoverBlock } from './WebHoverBlock';
export { WebUploadFileBlock } from './WebUploadFileBlock';
export { WebFocusBlock } from './WebFocusBlock';
export { WebDragAndDropBlock } from './WebDragAndDropBlock';
export { WebScrollIntoViewBlock } from './WebScrollIntoViewBlock';

import { WebClickBlock } from './WebClickBlock';
import { WebFillBlock } from './WebFillBlock';
import { WebTypeBlock } from './WebTypeBlock';
import { WebPressKeyBlock } from './WebPressKeyBlock';
import { WebSelectBlock } from './WebSelectBlock';
import { WebCheckboxBlock } from './WebCheckboxBlock';
import { WebHoverBlock } from './WebHoverBlock';
import { WebUploadFileBlock } from './WebUploadFileBlock';
import { WebFocusBlock } from './WebFocusBlock';
import { WebDragAndDropBlock } from './WebDragAndDropBlock';
import { WebScrollIntoViewBlock } from './WebScrollIntoViewBlock';

/**
 * All interaction block class instances.
 */
export const interactionBlockClasses: Block[] = [
  new WebClickBlock(),
  new WebFillBlock(),
  new WebTypeBlock(),
  new WebPressKeyBlock(),
  new WebSelectBlock(),
  new WebCheckboxBlock(),
  new WebHoverBlock(),
  new WebUploadFileBlock(),
  new WebFocusBlock(),
  new WebDragAndDropBlock(),
  new WebScrollIntoViewBlock(),
];

/**
 * Interaction blocks as BlockDefinition array for backward compatibility.
 */
export const interactionBlocks: BlockDefinition[] = interactionBlockClasses.map(block => block.toDefinition());
