/**
 * Plugin Loader for TestBlocks Client
 *
 * This module handles loading and registering plugins with their custom blocks.
 * Users can extend TestBlocks by creating TypeScript plugins that export BlockDefinitions.
 */

import { BlockDefinition, Plugin, registerPlugin } from '../../core';

// Track loaded plugins and their blocks
const loadedPlugins: Map<string, Plugin> = new Map();
const pluginBlocks: BlockDefinition[] = [];

/**
 * Register a plugin with the system
 * This adds the plugin's blocks to the available blocks list
 */
export function loadPlugin(plugin: Plugin): void {
  if (loadedPlugins.has(plugin.name)) {
    console.warn(`Plugin "${plugin.name}" is already loaded. Skipping...`);
    return;
  }

  // Register with core registry
  registerPlugin(plugin);

  // Track locally
  loadedPlugins.set(plugin.name, plugin);

  // Add blocks to our collection
  if (plugin.blocks && plugin.blocks.length > 0) {
    pluginBlocks.push(...plugin.blocks);
  }

  console.log(`Loaded plugin: ${plugin.name} v${plugin.version} with ${plugin.blocks.length} blocks`);
}

/**
 * Load multiple plugins at once
 */
export function loadPlugins(plugins: Plugin[]): void {
  plugins.forEach(loadPlugin);
}

/**
 * Get all blocks from loaded plugins
 */
export function getPluginBlocks(): BlockDefinition[] {
  return [...pluginBlocks];
}

/**
 * Get all loaded plugins
 */
export function getLoadedPlugins(): Plugin[] {
  return Array.from(loadedPlugins.values());
}

/**
 * Check if a plugin is loaded
 */
export function isPluginLoaded(name: string): boolean {
  return loadedPlugins.has(name);
}

/**
 * Unload a plugin (useful for development/hot reloading)
 */
export function unloadPlugin(name: string): boolean {
  const plugin = loadedPlugins.get(name);
  if (!plugin) {
    return false;
  }

  // Remove plugin blocks from our collection
  const blockTypes = new Set(plugin.blocks.map(b => b.type));
  for (let i = pluginBlocks.length - 1; i >= 0; i--) {
    if (blockTypes.has(pluginBlocks[i].type)) {
      pluginBlocks.splice(i, 1);
    }
  }

  loadedPlugins.delete(name);
  console.log(`Unloaded plugin: ${name}`);
  return true;
}

/**
 * Clear all loaded plugins (useful for testing)
 */
export function clearPlugins(): void {
  loadedPlugins.clear();
  pluginBlocks.length = 0;
}

// Export types for plugin authors
export type { Plugin, BlockDefinition };
