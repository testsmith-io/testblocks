import { Block } from '../../base';
import { BlockDefinition } from '../../../types';

export { WebNavigateBlock } from './WebNavigateBlock';
export { WebWaitForElementBlock } from './WebWaitForElementBlock';
export { WebWaitForUrlBlock } from './WebWaitForUrlBlock';
export { WebWaitBlock } from './WebWaitBlock';
export { WebScreenshotBlock } from './WebScreenshotBlock';

import { WebNavigateBlock } from './WebNavigateBlock';
import { WebWaitForElementBlock } from './WebWaitForElementBlock';
import { WebWaitForUrlBlock } from './WebWaitForUrlBlock';
import { WebWaitBlock } from './WebWaitBlock';
import { WebScreenshotBlock } from './WebScreenshotBlock';

/**
 * All navigation block class instances.
 */
export const navigationBlockClasses: Block[] = [
  new WebNavigateBlock(),
  new WebWaitForElementBlock(),
  new WebWaitForUrlBlock(),
  new WebWaitBlock(),
  new WebScreenshotBlock(),
];

/**
 * Navigation blocks as BlockDefinition array for backward compatibility.
 */
export const navigationBlocks: BlockDefinition[] = navigationBlockClasses.map(block => block.toDefinition());
