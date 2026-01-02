// Types
export * from './types';

// Blocks
export * from './blocks';

// Plugins
export * from './plugins';

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
