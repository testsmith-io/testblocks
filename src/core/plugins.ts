import { Plugin, BlockDefinition, ExecutionContext } from './types';
import { registerBlocks } from './blocks';

// Plugin registry
const pluginRegistry = new Map<string, Plugin>();

// Register a plugin
export function registerPlugin(plugin: Plugin): void {
  if (pluginRegistry.has(plugin.name)) {
    console.warn(`Plugin "${plugin.name}" is already registered. Overwriting...`);
  }

  pluginRegistry.set(plugin.name, plugin);

  // Register the plugin's blocks
  if (plugin.blocks && plugin.blocks.length > 0) {
    registerBlocks(plugin.blocks);
  }

  console.log(`Plugin registered: ${plugin.name} v${plugin.version}`);
}

// Get a registered plugin
export function getPlugin(name: string): Plugin | undefined {
  return pluginRegistry.get(name);
}

// Get all registered plugins
export function getAllPlugins(): Plugin[] {
  return Array.from(pluginRegistry.values());
}

// Get all plugin blocks
export function getAllPluginBlocks(): BlockDefinition[] {
  const blocks: BlockDefinition[] = [];
  for (const plugin of pluginRegistry.values()) {
    blocks.push(...plugin.blocks);
  }
  return blocks;
}

// Unregister a plugin
export function unregisterPlugin(name: string): boolean {
  return pluginRegistry.delete(name);
}

// Create a plugin helper
export function createPlugin(config: {
  name: string;
  version: string;
  description?: string;
  blocks?: BlockDefinition[];
  hooks?: Plugin['hooks'];
}): Plugin {
  return {
    name: config.name,
    version: config.version,
    description: config.description,
    blocks: config.blocks || [],
    hooks: config.hooks,
  };
}

// Helper to create a custom block easily
export function createBlock(config: {
  type: string;
  category: string;
  color?: string;
  tooltip?: string;
  helpUrl?: string;
  inputs: BlockDefinition['inputs'];
  output?: BlockDefinition['output'];
  previousStatement?: boolean;
  nextStatement?: boolean;
  execute: BlockDefinition['execute'];
}): BlockDefinition {
  return {
    type: config.type,
    category: config.category,
    color: config.color || '#607D8B',
    tooltip: config.tooltip,
    helpUrl: config.helpUrl,
    inputs: config.inputs,
    output: config.output,
    previousStatement: config.previousStatement,
    nextStatement: config.nextStatement,
    execute: config.execute,
  };
}

/**
 * Create an action block - executes an action, can be chained with other blocks
 * Has previous/next statements, no output value
 */
export function createActionBlock(config: {
  type: string;
  category: string;
  color?: string;
  tooltip?: string;
  inputs: BlockDefinition['inputs'];
  execute: (params: Record<string, unknown>, context: ExecutionContext) => Promise<unknown>;
}): BlockDefinition {
  return createBlock({
    ...config,
    previousStatement: true,
    nextStatement: true,
  });
}

/**
 * Create a value block - returns a value that can be used as input to other blocks
 * Has output, no previous/next statements
 */
export function createValueBlock(config: {
  type: string;
  category: string;
  color?: string;
  tooltip?: string;
  inputs: BlockDefinition['inputs'];
  outputType: string | string[];
  execute: (params: Record<string, unknown>, context: ExecutionContext) => Promise<unknown>;
}): BlockDefinition {
  return createBlock({
    ...config,
    output: { type: config.outputType },
    previousStatement: false,
    nextStatement: false,
  });
}

/**
 * Create an assertion block - validates a condition
 * Throws an error if assertion fails
 */
export function createAssertionBlock(config: {
  type: string;
  category?: string;
  color?: string;
  tooltip?: string;
  inputs: BlockDefinition['inputs'];
  assert: (params: Record<string, unknown>, context: ExecutionContext) => Promise<{ pass: boolean; message?: string }>;
}): BlockDefinition {
  return createBlock({
    type: config.type,
    category: config.category || 'Assertions',
    color: config.color || '#E91E63',
    tooltip: config.tooltip,
    inputs: config.inputs,
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      const result = await config.assert(params, context);
      if (!result.pass) {
        throw new Error(result.message || `Assertion failed: ${config.type}`);
      }
      context.logger.info(`✓ ${config.tooltip || config.type}`);
      return result;
    },
  });
}

// Re-export types for plugin authors
export type { Plugin, BlockDefinition, ExecutionContext };
