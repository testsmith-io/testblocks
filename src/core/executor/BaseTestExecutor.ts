import { chromium, Browser, Page, BrowserContext, selectors } from 'playwright';
import {
  TestFile,
  TestStep,
  StepResult,
  ExecutionContext,
  Logger,
  Plugin,
  ProcedureDefinition,
  BlockDefinition,
} from '../types';
import { getBlock, registerBlock, registerProcedure } from '../blocks';
import { BlocklyParser } from '../utils/blocklyParser';
import { VariableResolver, resolveVariableDefaults } from '../utils/variableResolver';

export interface ExecutorOptions {
  headless?: boolean;
  timeout?: number;
  baseUrl?: string;
  variables?: Record<string, unknown>;
  plugins?: Plugin[];
  testIdAttribute?: string;
  baseDir?: string;
}

/**
 * Base class for test execution providing shared functionality
 * for both server and CLI executors
 */
export abstract class BaseTestExecutor {
  protected options: ExecutorOptions;
  protected browser: Browser | null = null;
  protected browserContext: BrowserContext | null = null;
  protected page: Page | null = null;
  protected plugins: Map<string, Plugin> = new Map();
  protected procedures: Map<string, ProcedureDefinition> = new Map();

  constructor(options: ExecutorOptions = {}) {
    this.options = {
      headless: true,
      timeout: 30000,
      ...options,
    };

    if (options.plugins) {
      options.plugins.forEach(plugin => {
        this.plugins.set(plugin.name, plugin);
      });
    }
  }

  /**
   * Initialize browser for test execution
   */
  async initialize(): Promise<void> {
    if (this.options.testIdAttribute) {
      selectors.setTestIdAttribute(this.options.testIdAttribute);
    }

    this.browser = await chromium.launch({
      headless: this.options.headless,
    });
    this.browserContext = await this.browser.newContext();
    this.page = await this.browserContext.newPage();

    if (this.options.timeout) {
      this.page.setDefaultTimeout(this.options.timeout);
    }
  }

  /**
   * Cleanup browser resources
   */
  async cleanup(): Promise<void> {
    if (this.page) await this.page.close();
    if (this.browserContext) await this.browserContext.close();
    if (this.browser) await this.browser.close();
    this.page = null;
    this.browserContext = null;
    this.browser = null;
  }

  /**
   * Check if a test file requires browser initialization
   */
  protected requiresBrowser(testFile: TestFile): boolean {
    const hasWebStep = (steps: TestStep[]): boolean => {
      return steps.some(step => step.type.startsWith('web_'));
    };

    const hasWebStepInState = (state: unknown): boolean => {
      const steps = BlocklyParser.extractSteps(state);
      return hasWebStep(steps);
    };

    // Check lifecycle hooks
    if (testFile.beforeAll && hasWebStepInState(testFile.beforeAll)) return true;
    if (testFile.afterAll && hasWebStepInState(testFile.afterAll)) return true;
    if (testFile.beforeEach && hasWebStepInState(testFile.beforeEach)) return true;
    if (testFile.afterEach && hasWebStepInState(testFile.afterEach)) return true;

    // Check all tests
    for (const test of testFile.tests) {
      if (hasWebStepInState(test.steps)) return true;
      if (test.beforeEach && hasWebStepInState(test.beforeEach)) return true;
      if (test.afterEach && hasWebStepInState(test.afterEach)) return true;
    }

    return false;
  }

  /**
   * Register custom blocks from procedure definitions
   */
  protected registerCustomBlocksFromProcedures(procedures: Record<string, ProcedureDefinition>): void {
    Object.entries(procedures).forEach(([name, proc]) => {
      registerProcedure(name, proc);
      this.procedures.set(name, proc);

      if (!proc.steps || proc.steps.length === 0) return;

      const blockType = `custom_${proc.name.toLowerCase().replace(/\s+/g, '_')}`;

      if (getBlock(blockType)) return;

      const blockDef: BlockDefinition = {
        type: blockType,
        category: 'Custom',
        color: '#607D8B',
        tooltip: proc.description || `Custom block: ${proc.name}`,
        inputs: (proc.params || []).map(param => ({
          name: param.name.toUpperCase(),
          type: 'field' as const,
          fieldType: param.type === 'number' ? 'number' as const : 'text' as const,
          default: param.default,
        })),
        previousStatement: true,
        nextStatement: true,
        execute: async (params, context) => {
          context.logger.info(`Executing custom block: ${proc.name}`);

          (proc.params || []).forEach(p => {
            const paramKey = p.name.toUpperCase();
            let value = params[paramKey];
            if (value !== undefined) {
              if (typeof value === 'string') {
                value = VariableResolver.resolve(value, context);
              }
              context.variables.set(p.name, value);
              context.logger.debug(`Set procedure param: ${p.name} = "${value}"`);
            }
          });

          return {
            customBlock: true,
            name: proc.name,
            steps: proc.steps,
          };
        },
      };

      registerBlock(blockDef);
    });
  }

  /**
   * Execute a single step
   */
  protected async runStep(step: TestStep, context: ExecutionContext): Promise<StepResult> {
    const startTime = Date.now();

    // Run beforeStep hooks
    for (const plugin of this.plugins.values()) {
      if (plugin.hooks?.beforeStep) {
        await plugin.hooks.beforeStep(context, step);
      }
    }

    let status: 'passed' | 'failed' | 'error' = 'passed';
    let output: unknown;
    let error: { message: string; stack?: string } | undefined;

    try {
      const blockDef = getBlock(step.type);

      if (!blockDef) {
        throw new Error(`Unknown block type: ${step.type}`);
      }

      const resolvedParams = await this.resolveParams(step.params, context);
      output = await blockDef.execute(resolvedParams, context);

      // Handle custom blocks that return steps to execute
      if (output && typeof output === 'object' && 'customBlock' in output) {
        const customOutput = output as { customBlock: boolean; steps: TestStep[] };
        for (const childStep of customOutput.steps) {
          const childResult = await this.runStep(childStep, context);
          if (childResult.status === 'failed' || childResult.status === 'error') {
            status = childResult.status;
            error = childResult.error;
            break;
          }
        }
      }

      // Handle compound actions
      if (output && typeof output === 'object' && 'compoundAction' in output) {
        const compoundOutput = output as { compoundAction: string; steps: TestStep[] };
        for (const childStep of compoundOutput.steps) {
          const childResult = await this.runStep(childStep as TestStep, context);
          if (childResult.status === 'failed' || childResult.status === 'error') {
            status = childResult.status;
            error = childResult.error;
            break;
          }
        }
      }

      // Handle procedure calls
      if (output && typeof output === 'object' && 'procedureCall' in output) {
        const procOutput = output as {
          procedureCall: boolean;
          name: string;
          args: Record<string, unknown>;
          procedure: ProcedureDefinition;
        };

        for (const [argName, argValue] of Object.entries(procOutput.args)) {
          let resolvedValue = argValue;
          if (typeof argValue === 'string') {
            resolvedValue = VariableResolver.resolve(argValue, context);
          }
          context.variables.set(argName, resolvedValue);
        }

        if (procOutput.procedure.steps) {
          for (const childStep of procOutput.procedure.steps) {
            const childResult = await this.runStep(childStep, context);
            if (childResult.status === 'failed' || childResult.status === 'error') {
              status = childResult.status;
              error = childResult.error;
              break;
            }
          }
        }
      }
    } catch (err) {
      status = 'failed';
      error = {
        message: (err as Error).message,
        stack: (err as Error).stack,
      };
    }

    // Capture screenshot on failure for web tests
    let screenshot: string | undefined;
    if (status === 'failed' && step.type.startsWith('web_') && context.page) {
      try {
        const page = context.page as Page;
        const buffer = await page.screenshot({ fullPage: true });
        screenshot = buffer.toString('base64');
      } catch {
        // Ignore screenshot errors
      }
    }

    const result: StepResult = {
      stepId: step.id,
      stepType: step.type,
      status,
      duration: Date.now() - startTime,
      output,
      error,
      screenshot,
    };

    // Run afterStep hooks
    for (const plugin of this.plugins.values()) {
      if (plugin.hooks?.afterStep) {
        await plugin.hooks.afterStep(context, step, result);
      }
    }

    return result;
  }

  /**
   * Resolve step parameters, executing nested blocks
   */
  protected async resolveParams(
    params: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<Record<string, unknown>> {
    const resolved: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(params)) {
      if (value && typeof value === 'object' && 'type' in value && 'id' in value) {
        // This is a connected block - execute it to get the value
        const nestedStep = value as TestStep;
        const blockDef = getBlock(nestedStep.type);

        if (blockDef) {
          const nestedParams = await this.resolveParams(nestedStep.params || {}, context);
          resolved[key] = await blockDef.execute(nestedParams, context);
        }
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
  }

  /**
   * Create a logger instance
   */
  protected createLogger(): Logger {
    return {
      info: (message: string, data?: unknown) => {
        console.log(`[INFO] ${message}`, data !== undefined ? data : '');
      },
      warn: (message: string, data?: unknown) => {
        console.warn(`[WARN] ${message}`, data !== undefined ? data : '');
      },
      error: (message: string, data?: unknown) => {
        console.error(`[ERROR] ${message}`, data !== undefined ? data : '');
      },
      debug: (message: string, data?: unknown) => {
        if (process.env.DEBUG) {
          console.debug(`[DEBUG] ${message}`, data !== undefined ? data : '');
        }
      },
    };
  }

  /**
   * Resolve variable defaults from globals format
   */
  protected resolveVariableDefaults(vars?: Record<string, unknown>): Record<string, unknown> {
    return resolveVariableDefaults(vars);
  }

  /**
   * Extract steps from Blockly state
   */
  protected extractStepsFromBlocklyState(state: unknown): TestStep[] {
    return BlocklyParser.extractSteps(state);
  }
}
