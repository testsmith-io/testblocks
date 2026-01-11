/**
 * Reporters module - modular organization
 *
 * Reporters are organized into separate files:
 * - ConsoleReporter.ts - Terminal output
 * - JSONReporter.ts - JSON file output
 * - JUnitReporter.ts - JUnit XML output
 * - HTMLReporter.ts - Styled HTML report
 * - types.ts - Shared interfaces
 * - utils.ts - Utility functions
 */

// Types
export { Reporter, ReportData } from './types';

// Utilities
export { getTimestamp, escapeXml, escapeHtml, formatStepType } from './utils';

// Reporters
export { ConsoleReporter } from './ConsoleReporter';
export { JSONReporter } from './JSONReporter';
export { JUnitReporter, generateJUnitXML } from './JUnitReporter';
export { HTMLReporter, generateHTMLReport } from './HTMLReporter';
