import { ExecutionContext, SoftAssertionError } from '../../types';

const DEFAULT_WEB_TIMEOUT = 30000;

/**
 * Get the global web timeout from context
 */
export function getTimeout(context: ExecutionContext): number {
  return context.webTimeout ?? DEFAULT_WEB_TIMEOUT;
}

// Import Playwright's expect for assertions with auto-waiting
// We use dynamic import with string concatenation to prevent Vite from
// trying to bundle the playwright package (which is Node.js-only)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let playwrightExpect: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getExpect(): Promise<any> {
  if (!playwrightExpect) {
    // Use string concatenation to hide import from Vite's static analysis
    const moduleName = '@playwright' + '/test';
    const { expect } = await import(/* @vite-ignore */ moduleName);
    playwrightExpect = expect;
  }
  return playwrightExpect;
}

/**
 * Execute a web assertion with soft assertion support
 * Wraps Playwright's expect() to handle soft assertion mode
 */
export async function executeWebAssertion(
  context: ExecutionContext,
  assertionFn: () => Promise<void>,
  errorMessage: string,
  details?: { stepType?: string; expected?: unknown; actual?: unknown }
): Promise<void> {
  try {
    await assertionFn();
  } catch (err) {
    if (context.softAssertions) {
      // Soft assertion mode - collect error
      const softError: SoftAssertionError = {
        message: (err as Error).message || errorMessage,
        stepType: details?.stepType,
        expected: details?.expected,
        actual: details?.actual,
        timestamp: new Date().toISOString(),
      };

      if (!context.softAssertionErrors) {
        context.softAssertionErrors = [];
      }
      context.softAssertionErrors.push(softError);

      context.logger.warn(`Soft assertion failed: ${softError.message}`);
    } else {
      // Hard assertion mode - re-throw
      throw err;
    }
  }
}

/**
 * Resolve ${variable} placeholders in text
 * Supports dot notation for object properties (e.g., ${user.email})
 */
export function resolveVariables(text: string, context: ExecutionContext): string {
  return text.replace(/\$\{([\w.]+)\}/g, (match, path) => {
    const parts = path.split('.');
    const varName = parts[0];
    let value: unknown = context.variables.get(varName);

    // Handle dot notation for nested object access
    if (parts.length > 1 && value !== undefined && value !== null) {
      for (let i = 1; i < parts.length; i++) {
        if (value === undefined || value === null) break;
        value = (value as Record<string, unknown>)[parts[i]];
      }
    }

    if (value === undefined || value === null) return match;
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  });
}

/**
 * Resolve a selector based on its type
 * - For 'testid:value' format: constructs [testIdAttribute="value"] using the global testIdAttribute
 * - For other formats: returns the selector as-is
 */
export function resolveSelector(params: Record<string, unknown>, context: ExecutionContext): string {
  const rawSelector = resolveVariables(params.SELECTOR as string, context);

  // Check for testid: prefix (e.g., "testid:nav-sign-in")
  if (rawSelector.startsWith('testid:')) {
    const testIdValue = rawSelector.substring(7); // Remove 'testid:' prefix
    const testIdAttr = context.testIdAttribute || 'data-testid';
    return `[${testIdAttr}="${testIdValue}"]`;
  }

  return rawSelector;
}

/**
 * Get a display-friendly version of the selector (strips testid: prefix)
 */
export function getDisplaySelector(params: Record<string, unknown>, context: ExecutionContext): string {
  const rawSelector = params.SELECTOR as string;

  // For testid: prefix, show the actual CSS selector that will be used
  if (rawSelector.startsWith('testid:')) {
    const testIdValue = rawSelector.substring(7);
    const testIdAttr = context.testIdAttribute || 'data-testid';
    return `[${testIdAttr}="${testIdValue}"]`;
  }

  return rawSelector;
}
