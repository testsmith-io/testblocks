import { chromium, Browser, Page, BrowserContext } from 'playwright';
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
  getBlock,
} from '../core';

export interface ExecutorOptions {
  headless?: boolean;
  timeout?: number;
  baseUrl?: string;
  variables?: Record<string, unknown>;
  plugins?: Plugin[];
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
  }

  async initialize(): Promise<void> {
    this.browser = await chromium.launch({
      headless: this.options.headless,
    });
    this.browserContext = await this.browser.newContext();
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

  async runTestFile(testFile: TestFile): Promise<TestResult[]> {
    const results: TestResult[] = [];

    await this.initialize();

    // Register procedures from the test file
    if (testFile.procedures) {
      for (const [name, procedure] of Object.entries(testFile.procedures)) {
        this.procedures.set(name, procedure);
      }
    }

    // Create base context for hooks
    const baseContext = this.createBaseContext(testFile.variables);

    try {
      // Run beforeAll hooks
      if (testFile.beforeAll) {
        const steps = this.extractStepsFromBlocklyState(testFile.beforeAll);
        await this.runSteps(steps, baseContext, 'beforeAll');
      }

      // Run each test
      for (const test of testFile.tests) {
        // Check if test has data-driven sets
        if (test.data && test.data.length > 0) {
          // Run test for each data set
          for (let i = 0; i < test.data.length; i++) {
            const dataSet = test.data[i];
            const result = await this.runTestWithData(
              test,
              testFile,
              dataSet,
              i
            );
            results.push(result);
          }
        } else {
          // Run test once without data
          const result = await this.runTest(test, testFile);
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
        ...this.options.variables,
      })),
      results: [],
      browser: this.browser,
      page: this.page,
      logger: this.createLogger(),
      plugins: this.plugins,
      procedures: this.procedures,
    };
  }

  async runTestWithData(
    test: TestCase,
    testFile: TestFile,
    dataSet: TestDataSet,
    dataIndex: number
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

  async runTest(test: TestCase, testFile: TestFile): Promise<TestResult> {
    console.log(`  Running: ${test.name}`);

    const startedAt = new Date().toISOString();
    const startTime = Date.now();
    const stepResults: StepResult[] = [];

    const context = this.createBaseContext(testFile.variables);

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

    const result: StepResult = {
      stepId: step.id,
      stepType: step.type,
      status,
      duration: Date.now() - startTime,
      output,
      error,
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

    // Set up parameter variables with prefix
    for (const [key, value] of Object.entries(args)) {
      context.variables.set(`__param_${key}`, value);
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

    // Clean up parameter variables
    for (const key of Object.keys(args)) {
      context.variables.delete(`__param_${key}`);
    }

    return returnValue;
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
