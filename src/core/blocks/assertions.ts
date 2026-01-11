import { ExecutionContext, SoftAssertionError } from '../types';

/**
 * Handle an assertion result - either throw immediately or collect as soft assertion
 * @param context - The execution context
 * @param condition - Whether the assertion passed
 * @param errorMessage - The error message if assertion fails
 * @param details - Additional details about the assertion
 */
export function handleAssertion(
  context: ExecutionContext,
  condition: boolean,
  errorMessage: string,
  details?: {
    stepId?: string;
    stepType?: string;
    expected?: unknown;
    actual?: unknown;
  }
): void {
  if (condition) {
    return; // Assertion passed
  }

  // Assertion failed
  if (context.softAssertions) {
    // Soft assertion mode - collect error instead of throwing
    const softError: SoftAssertionError = {
      message: errorMessage,
      stepId: details?.stepId,
      stepType: details?.stepType,
      expected: details?.expected,
      actual: details?.actual,
      timestamp: new Date().toISOString(),
    };

    if (!context.softAssertionErrors) {
      context.softAssertionErrors = [];
    }
    context.softAssertionErrors.push(softError);

    // Log the soft assertion failure
    context.logger.warn(`Soft assertion failed: ${errorMessage}`);
  } else {
    // Hard assertion mode - throw immediately
    throw new Error(errorMessage);
  }
}

/**
 * Check if there are any soft assertion errors and throw a combined error if so
 * @param context - The execution context
 * @returns The collected errors (for reporting)
 */
export function flushSoftAssertionErrors(context: ExecutionContext): SoftAssertionError[] {
  const errors = context.softAssertionErrors || [];

  if (errors.length > 0) {
    // Clear the errors from context
    context.softAssertionErrors = [];

    // Create a combined error message
    const errorMessages = errors.map((e, i) => `  ${i + 1}. ${e.message}`).join('\n');
    const combinedMessage = `${errors.length} assertion(s) failed:\n${errorMessages}`;

    throw new Error(combinedMessage);
  }

  return errors;
}

/**
 * Get soft assertion errors without throwing
 * @param context - The execution context
 * @returns The collected errors
 */
export function getSoftAssertionErrors(context: ExecutionContext): SoftAssertionError[] {
  return context.softAssertionErrors || [];
}

/**
 * Clear soft assertion errors
 * @param context - The execution context
 */
export function clearSoftAssertionErrors(context: ExecutionContext): void {
  context.softAssertionErrors = [];
}
