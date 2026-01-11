export { apiBlocks } from './api';
export { playwrightBlocks } from './playwright';
export { logicBlocks } from './logic';
export { lifecycleBlocks } from './lifecycle';
export { dataDrivenBlocks } from './data-driven';
export { procedureBlocks, registerProcedure, getProcedure, clearProcedures } from './procedures';
export { handleAssertion, flushSoftAssertionErrors, getSoftAssertionErrors, clearSoftAssertionErrors } from './assertions';

import { apiBlocks } from './api';
import { playwrightBlocks } from './playwright';
import { logicBlocks } from './logic';
import { lifecycleBlocks } from './lifecycle';
import { dataDrivenBlocks } from './data-driven';
import { procedureBlocks } from './procedures';
import { BlockDefinition } from '../types';

// All built-in blocks
export const builtInBlocks: BlockDefinition[] = [
  ...apiBlocks,
  ...playwrightBlocks,
  ...logicBlocks,
  ...lifecycleBlocks,
  ...dataDrivenBlocks,
  ...procedureBlocks,
];

// Block registry for runtime lookup
export const blockRegistry = new Map<string, BlockDefinition>();

// Initialize registry with built-in blocks
builtInBlocks.forEach(block => {
  blockRegistry.set(block.type, block);
});

// Function to register custom blocks (for plugins)
export function registerBlock(block: BlockDefinition): void {
  blockRegistry.set(block.type, block);
}

// Function to register multiple blocks
export function registerBlocks(blocks: BlockDefinition[]): void {
  blocks.forEach(block => registerBlock(block));
}

// Get a block definition by type
export function getBlock(type: string): BlockDefinition | undefined {
  return blockRegistry.get(type);
}

// Get all registered blocks
export function getAllBlocks(): BlockDefinition[] {
  return Array.from(blockRegistry.values());
}

// Get blocks by category
export function getBlocksByCategory(category: string): BlockDefinition[] {
  return getAllBlocks().filter(block => block.category === category);
}

// Get all categories
export function getCategories(): string[] {
  const categories = new Set<string>();
  getAllBlocks().forEach(block => categories.add(block.category));
  return Array.from(categories);
}
