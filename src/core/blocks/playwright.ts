/**
 * Playwright blocks - Re-export from modular structure
 *
 * This file re-exports all Playwright blocks from the playwright/ directory
 * for backwards compatibility. The blocks are now organized in:
 * - playwright/navigation.ts - Navigate, wait, screenshot
 * - playwright/interactions.ts - Click, fill, type, select, checkbox, hover
 * - playwright/retrieval.ts - Get text, attributes, values, title, URL
 * - playwright/assertions.ts - Visibility, text, value assertions
 * - playwright/utils.ts - Shared utilities (resolveVariables, resolveSelector)
 * - playwright/types.ts - TypeScript interfaces
 */

export { playwrightBlocks } from './playwright/index';
