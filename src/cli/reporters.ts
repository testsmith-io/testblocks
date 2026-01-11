/**
 * Reporters - Re-export from modular structure
 *
 * This file re-exports all reporters from the reporters/ directory
 * for backwards compatibility. The reporters are now organized in:
 * - reporters/ConsoleReporter.ts - Terminal output
 * - reporters/JSONReporter.ts - JSON file output
 * - reporters/JUnitReporter.ts - JUnit XML output
 * - reporters/HTMLReporter.ts - Styled HTML report
 * - reporters/types.ts - Shared interfaces
 * - reporters/utils.ts - Utility functions
 */

export * from './reporters/index';
