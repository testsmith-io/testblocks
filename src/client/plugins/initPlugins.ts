/**
 * Plugin Initialization
 *
 * This file provides utilities for loading and initializing plugins.
 * Plugins are not bundled with the core package - they should be
 * registered by users via registerClientPlugin().
 *
 * Example usage:
 * ```typescript
 * import { registerClientPlugin, initializePlugins } from './plugins/initPlugins';
 * import { myPlugin } from './my-plugin';
 *
 * registerClientPlugin(myPlugin);
 * initializePlugins();
 * ```
 */

import { loadPlugins } from './pluginLoader';
import { Plugin } from '../../core';

// List of registered plugins - starts empty, plugins are registered dynamically
const registeredPlugins: Plugin[] = [];

/**
 * Register a plugin for client-side use
 */
export function registerClientPlugin(plugin: Plugin): void {
  registeredPlugins.push(plugin);
  console.log(`Registered plugin: ${plugin.name}`);
}

/**
 * Register multiple plugins at once
 */
export function registerClientPlugins(plugins: Plugin[]): void {
  for (const plugin of plugins) {
    registerClientPlugin(plugin);
  }
}

/**
 * Initialize all registered plugins
 * Call this function on application startup after registering plugins
 */
export function initializePlugins(): void {
  console.log('Initializing plugins...');
  loadPlugins(registeredPlugins);
  console.log(`Loaded ${registeredPlugins.length} plugin(s)`);
}

/**
 * Get the list of registered plugins
 */
export function getAvailablePlugins(): Plugin[] {
  return [...registeredPlugins];
}
