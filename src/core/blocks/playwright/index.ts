/**
 * Playwright blocks - modular organization
 *
 * Blocks are organized into categories:
 * - navigation: Navigate, wait, screenshot
 * - interactions: Click, fill, type, select, checkbox, hover
 * - retrieval: Get text, attributes, values, title, URL
 * - assertions: Visibility, text, value, URL, title assertions
 */

import { BlockDefinition } from '../../types';
import { Block } from '../base';
import { navigationBlocks, navigationBlockClasses } from './navigation';
import { interactionBlocks, interactionBlockClasses } from './interactions';
import { retrievalBlocks, retrievalBlockClasses } from './retrieval';
import { assertionBlocks, assertionBlockClasses } from './assertions';

// Re-export types and utilities for external use
export * from './types';
export * from './utils';

// Re-export individual block categories (BlockDefinition arrays)
export { navigationBlocks } from './navigation';
export { interactionBlocks } from './interactions';
export { retrievalBlocks } from './retrieval';
export { assertionBlocks } from './assertions';

// Re-export block class arrays
export { navigationBlockClasses } from './navigation';
export { interactionBlockClasses } from './interactions';
export { retrievalBlockClasses } from './retrieval';
export { assertionBlockClasses } from './assertions';

// Re-export individual block classes
export * from './navigation';
export * from './interactions';
export * from './retrieval';
export * from './assertions';

/**
 * All Playwright block class instances.
 */
export const playwrightBlockClasses: Block[] = [
  ...navigationBlockClasses,
  ...interactionBlockClasses,
  ...retrievalBlockClasses,
  ...assertionBlockClasses,
];

/**
 * Combined export of all Playwright blocks (BlockDefinition array for backward compatibility).
 */
export const playwrightBlocks: BlockDefinition[] = [
  ...navigationBlocks,
  ...interactionBlocks,
  ...retrievalBlocks,
  ...assertionBlocks,
];
