import { Logger } from '../types';

export interface LoggerOptions {
  prefix?: string;
  indent?: string;
  debug?: boolean;
}

/**
 * Create a logger instance for test execution
 */
export function createLogger(options: LoggerOptions = {}): Logger {
  const { prefix = '', indent = '    ', debug = false } = options;
  const logPrefix = prefix ? `${prefix} ` : '';

  return {
    info: (message: string, data?: unknown) => {
      console.log(`${indent}[INFO] ${logPrefix}${message}`, data !== undefined ? data : '');
    },
    warn: (message: string, data?: unknown) => {
      console.warn(`${indent}[WARN] ${logPrefix}${message}`, data !== undefined ? data : '');
    },
    error: (message: string, data?: unknown) => {
      console.error(`${indent}[ERROR] ${logPrefix}${message}`, data !== undefined ? data : '');
    },
    debug: (message: string, data?: unknown) => {
      if (debug || process.env.DEBUG) {
        console.debug(`${indent}[DEBUG] ${logPrefix}${message}`, data !== undefined ? data : '');
      }
    },
  };
}

/**
 * Create a CLI-style logger with simpler output
 */
export function createCliLogger(): Logger {
  return {
    info: (message: string, data?: unknown) => {
      console.log(`    ${message}`, data !== undefined ? data : '');
    },
    warn: (message: string, data?: unknown) => {
      console.warn(`    \u26a0 ${message}`, data !== undefined ? data : '');
    },
    error: (message: string, data?: unknown) => {
      console.error(`    \u2717 ${message}`, data !== undefined ? data : '');
    },
    debug: (message: string, data?: unknown) => {
      if (process.env.DEBUG) {
        console.debug(`    [debug] ${message}`, data !== undefined ? data : '');
      }
    },
  };
}
