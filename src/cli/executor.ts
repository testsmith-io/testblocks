import { chromium, Browser, Page, BrowserContext, selectors } from 'playwright';
import {
  TestFile,
  TestCase,
  TestStep,
  TestResult,
  StepResult,
  ExecutionContext,
  Logger,
  Plugin,
  ProcedureDefinition,
  TestDataSet,
  BlockDefinition,
  getBlock,
  registerBlock,
} from '../core';

export interface ExecutorOptions {
  headless?: boolean;
  timeout?: number;
  baseUrl?: string;
  variables?: Record<string, unknown>;
  plugins?: Plugin[];
  procedures?: Record<string, ProcedureDefinition>;
  testIdAttribute?: string;
  locale?: string;
  timezoneId?: string;
  geolocation?: { latitude: number; longitude: number };
  viewport?: { width: number; height: number };
  localStorage?: { name: string; value: string }[];
}

export class TestExecutor {
  private options: ExecutorOptions;
  private browser: Browser | null = null;
  private browserContext: BrowserContext | null = null;
  private page: Page | null = null;
  private plugins: Map<string, Plugin> = new Map();
  private procedures: Map<string, ProcedureDefinition> = new Map();

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

    // Register project-level procedures from options
    if (options.procedures) {
      for (const [name, procedure] of Object.entries(options.procedures)) {
        this.procedures.set(name, procedure);
      }
      this.registerCustomBlocksFromProcedures(options.procedures);
    }
  }

  async initialize(): Promise<void> {
    if (this.options.testIdAttribute) {
      selectors.setTestIdAttribute(this.options.testIdAttribute);
    }

    this.browser = await chromium.launch({
      headless: this.options.headless,
    });

    const contextOptions: Record<string, unknown> = {
      viewport: this.options.viewport || { width: 1920, height: 1080 },
    };

    if (this.options.locale) {
      contextOptions.locale = this.options.locale;
    }
    if (this.options.timezoneId) {
      contextOptions.timezoneId = this.options.timezoneId;
    }
    if (this.options.geolocation) {
      contextOptions.geolocation = this.options.geolocation;
      contextOptions.permissions = ['geolocation'];
    }

    this.browserContext = await this.browser.newContext(contextOptions);

    if (this.options.localStorage && this.options.localStorage.length > 0) {
      const items = this.options.localStorage;
      await this.browserContext.addInitScript((storageItems: { name: string; value: string }[]) => {
        for (const item of storageItems) {
          localStorage.setItem(item.name, item.value);
        }
      }, items);
    }

    this.page = await this.browserContext.newPage();

    if (this.options.timeout) {
      this.page.setDefaultTimeout(this.options.timeout);
    }
  }

  async cleanup(): Promise<void> {
    if (this.page) await this.page.close();
    if (this.browserContext) await this.browserContext.close();
    if (this.browser) await this.browser.close();
    this.page = null;
    this.browserContext = null;
    this.browser = null;
  }

  private requiresBrowser(testFile: TestFile): boolean {
    const hasWebStep = (steps: TestStep[]): boolean => {
      return steps.some(step => step.type.startsWith('web_'));
    };

    const hasWebStepInState = (state: unknown): boolean => {
      const steps = this.extractStepsFromBlocklyState(state);
      return hasWebStep(steps);
    };

    // Check beforeAll/afterAll hooks
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

  async runTestFile(testFile: TestFile): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // Only initialize browser if test file contains web steps
    if (this.requiresBrowser(testFile)) {
      await this.initialize();
    }

    // Register procedures from the test file
    if (testFile.procedures) {
      for (const [name, procedure] of Object.entries(testFile.procedures)) {
        this.procedures.set(name, procedure);
      }
      // Also register them as custom blocks so custom_xxx blocks work
      this.registerCustomBlocksFromProcedures(testFile.procedures);
    }

    // Create base context for hooks
    const baseContext = this.createBaseContext(testFile.variables);

    // Check if there are any enabled tests
    const enabledTests = testFile.tests.filter(t => !t.disabled);
    const hasEnabledTests = enabledTests.length > 0;

    // Add skipped results for disabled tests first
    for (const test of testFile.tests) {
      if (test.disabled) {
        console.log(`  Skipping (disabled): ${test.name}`);
        results.push({
          testId: test.id,
          testName: test.name,
          status: 'skipped',
          duration: 0,
          steps: [],
          error: { message: 'Test is disabled' },
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
        });
      }
    }

    // Only run hooks and tests if there are enabled tests
    if (!hasEnabledTests) {
      console.log('  All tests disabled, skipping hooks');
      await this.cleanup();
      return results;
    }

    try {
      // Run beforeAll hooks
      if (testFile.beforeAll) {
        const steps = this.extractStepsFromBlocklyState(testFile.beforeAll);
        await this.runSteps(steps, baseContext, 'beforeAll');
      }

      // Run each enabled test - pass baseContext variables so beforeAll state persists
      for (const test of enabledTests) {
        // Check if test has data-driven sets
        if (test.data && test.data.length > 0) {
          // Run test for each data set
          for (let i = 0; i < test.data.length; i++) {
            const dataSet = test.data[i];
            const result = await this.runTestWithData(
              test,
              testFile,
              dataSet,
              i,
              baseContext.variables
            );
            results.push(result);
          }
        } else {
          // Run test once without data
          const result = await this.runTest(test, testFile, baseContext.variables);
          results.push(result);
        }
      }

      // Run afterAll hooks
      if (testFile.afterAll) {
        const steps = this.extractStepsFromBlocklyState(testFile.afterAll);
        await this.runSteps(steps, baseContext, 'afterAll');
      }
    } finally {
      await this.cleanup();
    }

    return results;
  }

  private createBaseContext(fileVariables?: Record<string, unknown>): ExecutionContext {
    return {
      variables: new Map(Object.entries({
        ...this.resolveVariableDefaults(fileVariables),
        ...this.resolveVariableDefaults(this.options.variables),
      })),
      results: [],
      browser: this.browser,
      page: this.page,
      logger: this.createLogger(),
      plugins: this.plugins,
      procedures: this.procedures,
      webTimeout: this.options.timeout,
    };
  }

  async runTestWithData(
    test: TestCase,
    testFile: TestFile,
    dataSet: TestDataSet,
    dataIndex: number,
    sharedVariables?: Map<string, unknown>
  ): Promise<TestResult> {
    const testName = dataSet.name
      ? `${test.name} [${dataSet.name}]`
      : `${test.name} [${dataIndex + 1}]`;

    console.log(`  Running: ${testName}`);

    const startedAt = new Date().toISOString();
    const startTime = Date.now();
    const stepResults: StepResult[] = [];

    // Create context with data
    const context: ExecutionContext = {
      ...this.createBaseContext(testFile.variables),
      currentData: dataSet,
      dataIndex,
    };

    // Merge shared variables from beforeAll (if any)
    if (sharedVariables) {
      for (const [key, value] of sharedVariables) {
        if (!context.variables.has(key) || context.variables.get(key) === '' || context.variables.get(key) === undefined) {
          context.variables.set(key, value);
        } else if (key.startsWith('__')) {
          context.variables.set(key, value);
        }
      }
    }

    // Inject data values into variables
    for (const [key, value] of Object.entries(dataSet.values)) {
      context.variables.set(key, value);
    }

    let testStatus: 'passed' | 'failed' | 'skipped' | 'error' = 'passed';
    let testError: { message: string; stack?: string } | undefined;

    try {
      // Run suite-level beforeEach
      if (testFile.beforeEach) {
        const steps = this.extractStepsFromBlocklyState(testFile.beforeEach);
        const hookResults = await this.runSteps(steps, context, 'beforeEach');
        stepResults.push(...hookResults);
      }

      // Run test-level beforeEach
      if (test.beforeEach) {
        const steps = this.extractStepsFromBlocklyState(test.beforeEach);
        const hookResults = await this.runSteps(steps, context, 'test.beforeEach');
        stepResults.push(...hookResults);
      }

      // Run test steps
      const steps = this.extractStepsFromBlocklyState(test.steps);
      for (const step of steps) {
        const stepResult = await this.runStep(step, context);
        stepResults.push(stepResult);

        if (stepResult.status === 'failed' || stepResult.status === 'error') {
          testStatus = stepResult.status;
          testError = stepResult.error;
          break;
        }
      }
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'skip' in error) {
        testStatus = 'skipped';
        testError = { message: (error as { reason?: string }).reason || 'Skipped' };
      } else {
        testStatus = 'error';
        testError = {
          message: (error as Error).message,
          stack: (error as Error).stack,
        };
      }
    } finally {
      // Run test-level afterEach
      if (test.afterEach) {
        try {
          const steps = this.extractStepsFromBlocklyState(test.afterEach);
          const hookResults = await this.runSteps(steps, context, 'test.afterEach');
          stepResults.push(...hookResults);
        } catch (e) {
          console.error('Error in test.afterEach:', e);
        }
      }

      // Run suite-level afterEach
      if (testFile.afterEach) {
        try {
          const steps = this.extractStepsFromBlocklyState(testFile.afterEach);
          const hookResults = await this.runSteps(steps, context, 'afterEach');
          stepResults.push(...hookResults);
        } catch (e) {
          console.error('Error in afterEach:', e);
        }
      }
    }

    return {
      testId: test.id,
      testName,
      status: testStatus,
      duration: Date.now() - startTime,
      steps: stepResults,
      error: testError,
      startedAt,
      finishedAt: new Date().toISOString(),
      dataIteration: {
        index: dataIndex,
        name: dataSet.name,
        data: dataSet.values,
      },
    };
  }

  async runTest(test: TestCase, testFile: TestFile, sharedVariables?: Map<string, unknown>): Promise<TestResult> {
    console.log(`  Running: ${test.name}`);

    const startedAt = new Date().toISOString();
    const startTime = Date.now();
    const stepResults: StepResult[] = [];

    const context = this.createBaseContext(testFile.variables);

    // Merge shared variables from beforeAll (if any)
    if (sharedVariables) {
      for (const [key, value] of sharedVariables) {
        // Only copy if not already set (don't override file-level defaults)
        if (!context.variables.has(key) || context.variables.get(key) === '' || context.variables.get(key) === undefined) {
          context.variables.set(key, value);
        } else if (key.startsWith('__')) {
          // Always copy internal state variables like __requestHeaders
          context.variables.set(key, value);
        }
      }
    }

    for (const plugin of this.plugins.values()) {
      if (plugin.hooks?.beforeTest) {
        await plugin.hooks.beforeTest(context, test);
      }
    }

    let testStatus: 'passed' | 'failed' | 'skipped' | 'error' = 'passed';
    let testError: { message: string; stack?: string } | undefined;

    try {
      // Run suite-level beforeEach
      if (testFile.beforeEach) {
        const steps = this.extractStepsFromBlocklyState(testFile.beforeEach);
        const hookResults = await this.runSteps(steps, context, 'beforeEach');
        stepResults.push(...hookResults);
      }

      // Run test-level beforeEach
      if (test.beforeEach) {
        const steps = this.extractStepsFromBlocklyState(test.beforeEach);
        const hookResults = await this.runSteps(steps, context, 'test.beforeEach');
        stepResults.push(...hookResults);
      }

      // Run test steps
      const steps = this.extractStepsFromBlocklyState(test.steps);
      for (const step of steps) {
        const stepResult = await this.runStep(step, context);
        stepResults.push(stepResult);

        if (stepResult.status === 'failed' || stepResult.status === 'error') {
          testStatus = stepResult.status;
          testError = stepResult.error;
          break;
        }
      }
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'skip' in error) {
        testStatus = 'skipped';
        testError = { message: (error as { reason?: string }).reason || 'Skipped' };
      } else {
        testStatus = 'error';
        testError = {
          message: (error as Error).message,
          stack: (error as Error).stack,
        };
      }
    } finally {
      // Run test-level afterEach
      if (test.afterEach) {
        try {
          const steps = this.extractStepsFromBlocklyState(test.afterEach);
          const hookResults = await this.runSteps(steps, context, 'test.afterEach');
          stepResults.push(...hookResults);
        } catch (e) {
          console.error('Error in test.afterEach:', e);
        }
      }

      // Run suite-level afterEach
      if (testFile.afterEach) {
        try {
          const steps = this.extractStepsFromBlocklyState(testFile.afterEach);
          const hookResults = await this.runSteps(steps, context, 'afterEach');
          stepResults.push(...hookResults);
        } catch (e) {
          console.error('Error in afterEach:', e);
        }
      }
    }

    const result: TestResult = {
      testId: test.id,
      testName: test.name,
      status: testStatus,
      duration: Date.now() - startTime,
      steps: stepResults,
      error: testError,
      startedAt,
      finishedAt: new Date().toISOString(),
    };

    for (const plugin of this.plugins.values()) {
      if (plugin.hooks?.afterTest) {
        await plugin.hooks.afterTest(context, test, result);
      }
    }

    return result;
  }

  private async runSteps(
    steps: TestStep[],
    context: ExecutionContext,
    phase: string
  ): Promise<StepResult[]> {
    const results: StepResult[] = [];

    for (const step of steps) {
      const result = await this.runStep(step, context);
      results.push(result);

      if (result.status === 'failed' || result.status === 'error') {
        throw new Error(`${phase} failed: ${result.error?.message}`);
      }
    }

    return results;
  }

  private resolveVariableDefaults(vars?: Record<string, unknown>): Record<string, unknown> {
    if (!vars) return {};

    const resolved: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(vars)) {
      if (value && typeof value === 'object' && 'default' in value) {
        resolved[key] = (value as { default: unknown }).default;
      } else {
        resolved[key] = value;
      }
    }
    return resolved;
  }

  private registerCustomBlocksFromProcedures(procedures: Record<string, ProcedureDefinition>): void {
    Object.entries(procedures).forEach(([_name, proc]) => {
      if (!proc.steps || proc.steps.length === 0) return;

      const blockType = `custom_${proc.name.toLowerCase().replace(/\s+/g, '_')}`;

      // Check if already registered
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

          // Set procedure parameters in context.variables so ${paramName} references work
          // Resolve any ${variable} placeholders in the parameter values first
          (proc.params || []).forEach(p => {
            const paramKey = p.name.toUpperCase();
            let value = params[paramKey];
            if (value !== undefined) {
              // Resolve variable placeholders like ${email} from context
              if (typeof value === 'string') {
                value = this.resolveVariablePlaceholders(value, context);
              }
              context.variables.set(p.name, value);
            }
          });

          // Execute the procedure's steps directly
          const steps = this.extractStepsFromBlocklyState(proc.steps);
          for (const step of steps) {
            const result = await this.runStep(step, context);
            if (result.status !== 'passed') {
              throw new Error(`Procedure ${proc.name} failed: ${result.error?.message}`);
            }
          }

          return { customBlock: true, name: proc.name };
        },
      };

      registerBlock(blockDef);
    });
  }

  private extractStepsFromBlocklyState(state: unknown): TestStep[] {
    if (!state || typeof state !== 'object') return [];

    const stateObj = state as Record<string, unknown>;

    if ('blocks' in stateObj && typeof stateObj.blocks === 'object') {
      const blocks = stateObj.blocks as Record<string, unknown>;
      if ('blocks' in blocks && Array.isArray(blocks.blocks)) {
        return this.blocksToSteps(blocks.blocks);
      }
    }

    if (Array.isArray(state)) {
      return state as TestStep[];
    }

    return [];
  }

  private blocksToSteps(blocks: unknown[]): TestStep[] {
    const steps: TestStep[] = [];

    for (const block of blocks) {
      const step = this.blockToStep(block as Record<string, unknown>);
      if (step) {
        steps.push(step);

        let currentBlock = block as Record<string, unknown>;
        while (currentBlock.next) {
          const nextBlock = (currentBlock.next as Record<string, unknown>).block as Record<string, unknown>;
          const nextStep = this.blockToStep(nextBlock);
          if (nextStep) {
            steps.push(nextStep);
          }
          currentBlock = nextBlock;
        }
      }
    }

    return steps;
  }

  private blockToStep(block: Record<string, unknown>): TestStep | null {
    if (!block || !block.type) return null;

    const step: TestStep = {
      id: block.id as string || `step-${Date.now()}`,
      type: block.type as string,
      params: {},
    };

    if (block.fields && typeof block.fields === 'object') {
      for (const [name, value] of Object.entries(block.fields as Record<string, unknown>)) {
        step.params[name] = value;
      }
    }

    if (block.inputs && typeof block.inputs === 'object') {
      for (const [name, input] of Object.entries(block.inputs as Record<string, unknown>)) {
        const inputObj = input as Record<string, unknown>;
        if (inputObj.block) {
          const connectedStep = this.blockToStep(inputObj.block as Record<string, unknown>);
          if (connectedStep) {
            step.params[name] = connectedStep;
          }
        }
      }
    }

    return step;
  }

  private async runStep(step: TestStep, context: ExecutionContext): Promise<StepResult> {
    const startTime = Date.now();

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

      // Handle special return values for control flow
      if (output && typeof output === 'object') {
        const outputObj = output as Record<string, unknown>;

        // Handle procedure calls
        if (outputObj.procedureCall) {
          output = await this.executeProcedure(
            outputObj.name as string,
            outputObj.args as Record<string, unknown>,
            context
          );
        }

        // Handle compound actions
        if (outputObj.compoundAction && outputObj.steps) {
          for (const subStep of outputObj.steps as TestStep[]) {
            const subResult = await this.runStep(subStep, context);
            if (subResult.status !== 'passed') {
              throw new Error(subResult.error?.message || 'Compound action step failed');
            }
          }
        }

        // Handle retry logic
        // TODO: Implement proper retry with nested statement execution
        if (outputObj.retry && outputObj.statement) {
          const _times = outputObj.times as number;
          const _delay = outputObj.delay as number;
          // Retry logic placeholder - full implementation would execute nested statements
          console.log(`Retry block: ${_times} attempts with ${_delay}ms delay`);
        }
      }
    } catch (err: unknown) {
      // Handle skip
      if (typeof err === 'object' && err !== null && 'skip' in err) {
        throw err; // Re-throw skip to be handled by runTest
      }

      status = 'failed';
      error = {
        message: (err as Error).message,
        stack: (err as Error).stack,
      };
    }

    // Capture screenshot on failure if page is available
    let screenshot: string | undefined;
    if (status === 'failed' && this.page) {
      try {
        const buffer = await this.page.screenshot({ type: 'png', fullPage: true });
        screenshot = `data:image/png;base64,${buffer.toString('base64')}`;
      } catch (screenshotError) {
        // Silently ignore screenshot errors
        console.debug('Failed to capture screenshot:', screenshotError);
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

    for (const plugin of this.plugins.values()) {
      if (plugin.hooks?.afterStep) {
        await plugin.hooks.afterStep(context, step, result);
      }
    }

    return result;
  }

  private async executeProcedure(
    name: string,
    args: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<unknown> {
    const procedure = this.procedures.get(name);

    if (!procedure) {
      throw new Error(`Procedure not found: ${name}`);
    }

    context.logger.info(`  Executing procedure: ${name}`);

    // Save original variable values to restore after procedure execution
    const savedValues = new Map<string, unknown>();

    // Set up parameter variables (procedure steps reference them directly as ${paramName})
    for (const [key, value] of Object.entries(args)) {
      // Resolve any ${variable} placeholders in the argument value
      let resolvedValue = value;
      if (typeof value === 'string' && value.includes('${')) {
        resolvedValue = this.resolveVariablePlaceholders(value, context);
      }

      // Save original value if it exists
      if (context.variables.has(key)) {
        savedValues.set(key, context.variables.get(key));
      }

      context.variables.set(key, resolvedValue);
    }

    // Execute procedure steps
    const steps = this.extractStepsFromBlocklyState(procedure.steps);
    let returnValue: unknown;

    for (const step of steps) {
      const result = await this.runStep(step, context);

      if (result.status !== 'passed') {
        throw new Error(`Procedure ${name} failed: ${result.error?.message}`);
      }

      // Check for return value
      if (result.output && typeof result.output === 'object') {
        const outputObj = result.output as Record<string, unknown>;
        if (outputObj.procedureReturn) {
          returnValue = outputObj.value;
          break;
        }
      }
    }

    // Restore original variable values
    for (const [key, originalValue] of savedValues) {
      context.variables.set(key, originalValue);
    }
    // Remove variables that didn't exist before
    for (const key of Object.keys(args)) {
      if (!savedValues.has(key)) {
        context.variables.delete(key);
      }
    }

    return returnValue;
  }

  private resolveVariablePlaceholders(text: string, context: ExecutionContext): string {
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

  private async resolveParams(
    params: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<Record<string, unknown>> {
    const resolved: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(params)) {
      if (value && typeof value === 'object' && 'type' in value) {
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

  private createLogger(): Logger {
    return {
      info: (message: string, data?: unknown) => {
        console.log(`    ${message}`, data !== undefined ? data : '');
      },
      warn: (message: string, data?: unknown) => {
        console.warn(`    ⚠ ${message}`, data !== undefined ? data : '');
      },
      error: (message: string, data?: unknown) => {
        console.error(`    ✗ ${message}`, data !== undefined ? data : '');
      },
      debug: (message: string, data?: unknown) => {
        if (process.env.DEBUG) {
          console.debug(`    [debug] ${message}`, data !== undefined ? data : '');
        }
      },
    };
  }
}
