/**
 * Server-side Plugin Initialization
 *
 * This module provides utilities for loading and registering plugins
 * for the test executor. Plugins can be:
 * 1. Registered manually via registerServerPlugin()
 * 2. Discovered automatically from a plugins folder via discoverPlugins()
 */

import * as fs from 'fs';
import * as path from 'path';
import { createJiti } from 'jiti';
import { registerPlugin, Plugin } from '../core';

// Create jiti instance for loading TypeScript plugins at runtime
const jiti = createJiti(__filename, {
  interopDefault: true,
});

// Track initialization
let pluginsInitialized = false;

// List of registered plugins
const registeredPlugins: Map<string, Plugin> = new Map();

// Plugins directory (can be overridden)
let pluginsDirectory = path.join(process.cwd(), 'plugins');

/**
 * Set the plugins directory path
 */
export function setPluginsDirectory(dir: string): void {
  pluginsDirectory = path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir);
  console.log(`Plugins directory set to: ${pluginsDirectory}`);
}

/**
 * Get the current plugins directory
 */
export function getPluginsDirectory(): string {
  return pluginsDirectory;
}

/**
 * Register a plugin for server-side use
 * This registers the plugin's blocks with the core block registry
 */
export function registerServerPlugin(plugin: Plugin): void {
  if (registeredPlugins.has(plugin.name)) {
    console.log(`Plugin already registered: ${plugin.name}`);
    return;
  }

  try {
    registerPlugin(plugin);
    registeredPlugins.set(plugin.name, plugin);
    console.log(`Registered plugin: ${plugin.name}`);
  } catch (error) {
    console.error(`Failed to register plugin "${plugin.name}":`, error);
    throw error;
  }
}

/**
 * Register multiple plugins at once
 */
export function registerServerPlugins(plugins: Plugin[]): void {
  for (const plugin of plugins) {
    registerServerPlugin(plugin);
  }
}

/**
 * Discover and list available plugins from the plugins directory
 * Returns plugin file names (without extension)
 */
export function discoverPlugins(): string[] {
  if (!fs.existsSync(pluginsDirectory)) {
    console.log(`Plugins directory not found: ${pluginsDirectory}`);
    return [];
  }

  const files = fs.readdirSync(pluginsDirectory);
  const plugins: string[] = [];

  for (const file of files) {
    // Look for .js or compiled .js files (not .d.ts)
    if ((file.endsWith('.js') || file.endsWith('.ts')) && !file.endsWith('.d.ts')) {
      const pluginName = file.replace(/\.(js|ts)$/, '');
      if (pluginName !== 'index') {
        plugins.push(pluginName);
      }
    }
  }

  console.log(`Discovered ${plugins.length} plugin(s): ${plugins.join(', ')}`);
  return plugins;
}

/**
 * Load a specific plugin by name from the plugins directory
 */
export async function loadPlugin(pluginName: string): Promise<Plugin | null> {
  // Check if already loaded
  if (registeredPlugins.has(pluginName)) {
    return registeredPlugins.get(pluginName)!;
  }

  const jsPath = path.join(pluginsDirectory, `${pluginName}.js`);
  const tsPath = path.join(pluginsDirectory, `${pluginName}.ts`);

  let pluginPath: string | null = null;
  let isTypeScript = false;
  if (fs.existsSync(jsPath)) {
    pluginPath = jsPath;
  } else if (fs.existsSync(tsPath)) {
    pluginPath = tsPath;
    isTypeScript = true;
  }

  if (!pluginPath) {
    console.error(`Plugin not found: ${pluginName} (looked in ${pluginsDirectory})`);
    return null;
  }

  try {
    console.log(`Loading plugin: ${pluginName} from ${pluginPath}`);

    // Use jiti for TypeScript files, dynamic import for JavaScript
    let module: Record<string, unknown>;
    if (isTypeScript) {
      module = jiti(pluginPath) as Record<string, unknown>;
    } else {
      module = await import(pluginPath);
    }

    // Look for default export or named export matching plugin name
    const plugin = module.default ||
      module[pluginName.replace(/-./g, x => x[1].toUpperCase()) + 'Plugin'] ||
      module[pluginName.replace(/-/g, '') + 'Plugin'] ||
      Object.values(module).find((exp: unknown) =>
        typeof exp === 'object' && exp !== null && 'name' in exp && 'blocks' in exp
      );

    if (!plugin) {
      console.error(`No valid plugin export found in ${pluginPath}`);
      return null;
    }

    registerServerPlugin(plugin as Plugin);
    return plugin as Plugin;
  } catch (error) {
    console.error(`Failed to load plugin ${pluginName}:`, error);
    return null;
  }
}

/**
 * Load plugins specified in a test file
 */
export async function loadTestFilePlugins(pluginNames: string[]): Promise<void> {
  for (const name of pluginNames) {
    await loadPlugin(name);
  }
}

/**
 * Load all discovered plugins from the plugins directory
 */
export async function loadAllPlugins(): Promise<void> {
  const pluginNames = discoverPlugins();
  await loadTestFilePlugins(pluginNames);
}

/**
 * Initialize server plugins (call after all plugins are registered)
 */
export function initializeServerPlugins(): void {
  if (pluginsInitialized) {
    return;
  }

  pluginsInitialized = true;
  console.log(`Server plugins initialized: ${registeredPlugins.size} plugin(s) loaded`);
}

/**
 * Get all registered server plugins
 */
export function getServerPlugins(): Plugin[] {
  return Array.from(registeredPlugins.values());
}

/**
 * Check if a plugin is registered
 */
export function isPluginLoaded(pluginName: string): boolean {
  return registeredPlugins.has(pluginName);
}
