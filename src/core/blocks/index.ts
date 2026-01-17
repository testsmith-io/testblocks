/**
 * Block Registry - Class-Based Architecture
 *
 * This module provides the central registry for all blocks.
 * It supports both class-based blocks (new architecture) and
 * legacy BlockDefinition arrays (for backward compatibility).
 */

import { BlockDefinition } from '../types';
import { Block } from './base';

// Export base classes
export * from './base';

// Export utility functions
export * from './utils';

// Export assertion functions
export { handleAssertion, flushSoftAssertionErrors, getSoftAssertionErrors, clearSoftAssertionErrors } from './assertions';

// Export procedure registry functions
export { registerProcedure, getProcedure, clearProcedures } from './procedures';

// Import class-based blocks
import { apiBlocks, apiBlockClasses } from './api';
import { logicBlocks, logicBlockClasses } from './logic';
import { dataDrivenBlocks, dataBlockClasses } from './data';
import { procedureBlocks, procedureBlockClasses } from './procedures';
import { lifecycleBlocks, lifecycleBlockClasses } from './lifecycle';
import { playwrightBlocks, playwrightBlockClasses } from './playwright';

// Re-export block definitions for backward compatibility
export { apiBlocks } from './api';
export { logicBlocks } from './logic';
export { dataDrivenBlocks } from './data';
export { procedureBlocks } from './procedures';
export { lifecycleBlocks } from './lifecycle';
export { playwrightBlocks } from './playwright';

// Re-export block classes for direct access
export { apiBlockClasses } from './api';
export { logicBlockClasses } from './logic';
export { dataBlockClasses } from './data';
export { procedureBlockClasses } from './procedures';
export { lifecycleBlockClasses } from './lifecycle';
export { playwrightBlockClasses } from './playwright';

/**
 * All block class instances.
 */
export const allBlockClasses: Block[] = [
  ...apiBlockClasses,
  ...logicBlockClasses,
  ...dataBlockClasses,
  ...procedureBlockClasses,
  ...lifecycleBlockClasses,
  ...playwrightBlockClasses,
];

/**
 * All built-in blocks as BlockDefinition array.
 */
export const builtInBlocks: BlockDefinition[] = [
  ...apiBlocks,
  ...playwrightBlocks,
  ...logicBlocks,
  ...lifecycleBlocks,
  ...dataDrivenBlocks,
  ...procedureBlocks,
];

/**
 * Block registry for runtime lookup.
 */
export const blockRegistry = new Map<string, BlockDefinition>();

/**
 * Block class registry for direct class access.
 */
export const blockClassRegistry = new Map<string, Block>();

// Initialize registries with built-in blocks
builtInBlocks.forEach(block => {
  blockRegistry.set(block.type, block);
});

allBlockClasses.forEach(block => {
  blockClassRegistry.set(block.type, block);
});

/**
 * Register a single block (legacy BlockDefinition).
 */
export function registerBlock(block: BlockDefinition): void {
  blockRegistry.set(block.type, block);
}

/**
 * Register multiple blocks.
 */
export function registerBlocks(blocks: BlockDefinition[]): void {
  blocks.forEach(block => registerBlock(block));
}

/**
 * Register a block class.
 */
export function registerBlockClass(block: Block): void {
  blockClassRegistry.set(block.type, block);
  blockRegistry.set(block.type, block.toDefinition());
}

/**
 * Get a block definition by type.
 */
export function getBlock(type: string): BlockDefinition | undefined {
  return blockRegistry.get(type);
}

/**
 * Get a block class by type.
 */
export function getBlockClass(type: string): Block | undefined {
  return blockClassRegistry.get(type);
}

/**
 * Get all registered blocks.
 */
export function getAllBlocks(): BlockDefinition[] {
  return Array.from(blockRegistry.values());
}

/**
 * Get all block classes.
 */
export function getAllBlockClasses(): Block[] {
  return Array.from(blockClassRegistry.values());
}

/**
 * Get blocks by category.
 */
export function getBlocksByCategory(category: string): BlockDefinition[] {
  return getAllBlocks().filter(block => block.category === category);
}

/**
 * Get all categories.
 */
export function getCategories(): string[] {
  const categories = new Set<string>();
  getAllBlocks().forEach(block => categories.add(block.category));
  return Array.from(categories);
}
