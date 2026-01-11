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
import { navigationBlocks } from './navigation';
import { interactionBlocks } from './interactions';
import { retrievalBlocks } from './retrieval';
import { assertionBlocks } from './assertions';

// Re-export types and utilities for external use
export * from './types';
export * from './utils';

// Re-export individual block categories
export { navigationBlocks } from './navigation';
export { interactionBlocks } from './interactions';
export { retrievalBlocks } from './retrieval';
export { assertionBlocks } from './assertions';

// Combined export of all Playwright blocks
export const playwrightBlocks: BlockDefinition[] = [
  ...navigationBlocks,
  ...interactionBlocks,
  ...retrievalBlocks,
  ...assertionBlocks,
];
