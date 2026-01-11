// Variable resolution utilities (browser-safe)
export { VariableResolver, resolveVariableDefaults } from './variableResolver';

// Blockly parsing utilities (browser-safe)
export { BlocklyParser } from './blocklyParser';

// Note: dataLoader and logger use Node.js modules and should be imported directly
// by server/CLI code, not through this index (to avoid browser bundling issues)
