// Types
export * from './types';

// Blocks
export * from './blocks';

// Plugins
export * from './plugins';

// Utilities (browser-safe only)
export * from './utils';

// Note: BaseTestExecutor is in ./executor but uses Playwright (Node.js only)
// Import it directly from '@/core/executor' in server/CLI code

// Re-export specific items for convenience
export {
  builtInBlocks,
  blockRegistry,
  registerBlock,
  registerBlocks,
  getBlock,
  getAllBlocks,
  getBlocksByCategory,
  getCategories,
} from './blocks';

export {
  registerPlugin,
  getPlugin,
  getAllPlugins,
  getAllPluginBlocks,
  unregisterPlugin,
  createPlugin,
  createBlock,
  createActionBlock,
  createValueBlock,
  createAssertionBlock,
} from './plugins';
