import { chromium, Browser, Page, BrowserContext, selectors } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
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
  BlockDefinition,
  TestDataSet,
  SoftAssertionError,
  getBlock,
  registerBlock,
  registerProcedure,
} from '../core';

// Parse CSV content into TestDataSet array
function parseCSV(content: string): TestDataSet[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return []; // Need header + at least one data row

  const headers = lines[0].split(',').map(h => h.trim());
  const dataSets: TestDataSet[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple CSV parsing (handles basic quoted values)
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const row: Record<string, unknown> = {};
    headers.forEach((header, idx) => {
      const val = values[idx] ?? '';
      // Try to parse as number or boolean
      if (val === 'true') {
        row[header] = true;
      } else if (val === 'false') {
        row[header] = false;
      } else if (val !== '' && !isNaN(Number(val))) {
        row[header] = Number(val);
      } else {
        row[header] = val;
      }
    });

    dataSets.push({ name: `Row ${i}`, values: row });
  }

  return dataSets;
}

export interface ExecutorOptions {
  headless?: boolean;
  timeout?: number;
  baseUrl?: string;
  variables?: Record<string, unknown>;
  plugins?: Plugin[];
  testIdAttribute?: string;
  baseDir?: string; // Base directory for resolving relative file paths (e.g., dataFile)
  procedures?: Record<string, ProcedureDefinition>; // Project-level procedures from globals
}

export class TestExecutor {
  private options: ExecutorOptions;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private plugins: Map<string, Plugin> = new Map();
  private projectProcedures: Map<string, ProcedureDefinition> = new Map();

  constructor(options: ExecutorOptions = {}) {
    this.options = {
      headless: true,
      timeout: 30000,
      ...options,
    };

    // Register plugins
    if (options.plugins) {
      options.plugins.forEach(plugin => {
        this.plugins.set(plugin.name, plugin);
      });
    }

    // Register project-level procedures from options
    if (options.procedures) {
      for (const [name, procedure] of Object.entries(options.procedures)) {
        this.projectProcedures.set(name, procedure);
      }
      this.registerCustomBlocksFromProcedures(options.procedures);
    }
  }

  async initialize(): Promise<void> {
    // Set the test ID attribute globally for Playwright selectors
    if (this.options.testIdAttribute) {
      selectors.setTestIdAttribute(this.options.testIdAttribute);
    }

    this.browser = await chromium.launch({
      headless: this.options.headless,
    });
    this.context = await this.browser.newContext();
    this.page = await this.context.newPage();

    if (this.options.timeout) {
      this.page.setDefaultTimeout(this.options.timeout);
    }
  }

  async cleanup(): Promise<void> {
    if (this.page) await this.page.close();
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
    this.page = null;
    this.context = null;
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

    // Register custom blocks from procedures
    if (testFile.procedures) {
      this.registerCustomBlocksFromProcedures(testFile.procedures);
    }

    // Only initialize browser if test file contains web steps
    if (this.requiresBrowser(testFile)) {
      await this.initialize();
    }

    // Create shared execution context for lifecycle hooks
    // Merge project-level and file-level procedures (file takes precedence)
    const mergedProcedures = new Map(this.projectProcedures);
    if (testFile.procedures) {
      for (const [name, proc] of Object.entries(testFile.procedures)) {
        mergedProcedures.set(name, proc);
      }
    }

    const sharedContext: ExecutionContext = {
      variables: new Map(Object.entries({
        ...this.resolveVariableDefaults(testFile.variables),
        ...this.resolveVariableDefaults(this.options.variables),
      })),
      results: [],
      browser: this.browser,
      page: this.page,
      logger: this.createLogger(),
      plugins: this.plugins,
      testIdAttribute: this.options.testIdAttribute,
      procedures: mergedProcedures,
    };

    let beforeAllFailed = false;

    try {
      // Run beforeAll hooks
      if (testFile.beforeAll && testFile.beforeAll.length > 0) {
        sharedContext.logger.info('Running beforeAll hooks...');
        const beforeAllResult = await this.runLifecycleSteps(
          testFile.beforeAll,
          'beforeAll',
          sharedContext
        );
        results.push(beforeAllResult);

        if (beforeAllResult.status === 'failed' || beforeAllResult.status === 'error') {
          // Don't run tests if beforeAll failed, but still run afterAll
          beforeAllFailed = true;
        }
      }

      // Only run tests if beforeAll succeeded
      if (!beforeAllFailed) {
        // Run each test with beforeEach/afterEach
        for (const test of testFile.tests) {
          // Load data from file if specified
          let testData = test.data;
          if (test.dataFile && !testData) {
            testData = this.loadDataFromFile(test.dataFile);
          }

          // Check if test has data-driven sets
          if (testData && testData.length > 0) {
            // Run test for each data set
            for (let i = 0; i < testData.length; i++) {
              const dataSet = testData[i];

              // Run suite-level beforeEach
              if (testFile.beforeEach && testFile.beforeEach.length > 0) {
                for (const step of testFile.beforeEach) {
                  await this.runStep(step, sharedContext);
                }
              }

              const result = await this.runTestWithData(test, testFile.variables, dataSet, i, sharedContext);
              results.push(result);

              // Run suite-level afterEach
              if (testFile.afterEach && testFile.afterEach.length > 0) {
                for (const step of testFile.afterEach) {
                  await this.runStep(step, sharedContext);
                }
              }
            }
          } else {
            // Run test once without data
            // Run suite-level beforeEach
            if (testFile.beforeEach && testFile.beforeEach.length > 0) {
              for (const step of testFile.beforeEach) {
                await this.runStep(step, sharedContext);
              }
            }

            const result = await this.runTest(test, testFile.variables, sharedContext);
            results.push(result);

            // Run suite-level afterEach
            if (testFile.afterEach && testFile.afterEach.length > 0) {
              for (const step of testFile.afterEach) {
                await this.runStep(step, sharedContext);
              }
            }
          }
        }
      }
    } finally {
      // Always run afterAll hooks, even if beforeAll failed
      // This ensures cleanup happens regardless of setup failures
      if (testFile.afterAll && testFile.afterAll.length > 0) {
        sharedContext.logger.info('Running afterAll hooks...');
        try {
          const afterAllResult = await this.runLifecycleSteps(
            testFile.afterAll,
            'afterAll',
            sharedContext
          );
          results.push(afterAllResult);
        } catch (afterAllError) {
          // Log but don't throw - we still want cleanup to complete
          sharedContext.logger.error('afterAll hook failed', (afterAllError as Error).message);
          results.push({
            testId: 'lifecycle-afterAll',
            testName: 'afterAll',
            status: 'error',
            duration: 0,
            steps: [],
            error: {
              message: (afterAllError as Error).message,
              stack: (afterAllError as Error).stack,
            },
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
            isLifecycle: true,
            lifecycleType: 'afterAll',
          });
        }
      }

      await this.cleanup();
    }

    return results;
  }

  private async runLifecycleSteps(
    steps: TestStep[],
    lifecycleType: 'beforeAll' | 'afterAll' | 'beforeEach' | 'afterEach',
    context: ExecutionContext
  ): Promise<TestResult> {
    const startedAt = new Date().toISOString();
    const startTime = Date.now();
    const stepResults: StepResult[] = [];

    let status: 'passed' | 'failed' | 'error' = 'passed';
    let error: { message: string; stack?: string } | undefined;

    for (const step of steps) {
      const stepResult = await this.runStep(step, context);
      stepResults.push(stepResult);

      if (stepResult.status === 'failed' || stepResult.status === 'error') {
        status = stepResult.status;
        error = stepResult.error;
        break;
      }
    }

    return {
      testId: `lifecycle-${lifecycleType}`,
      testName: lifecycleType,
      status,
      duration: Date.now() - startTime,
      steps: stepResults,
      error,
      startedAt,
      finishedAt: new Date().toISOString(),
      isLifecycle: true,
      lifecycleType,
    };
  }

  /**
   * Public method to register custom blocks from procedures
   */
  registerProcedures(procedures: Record<string, ProcedureDefinition>): void {
    this.registerCustomBlocksFromProcedures(procedures);
  }

  private registerCustomBlocksFromProcedures(procedures: Record<string, ProcedureDefinition>): void {
    Object.entries(procedures).forEach(([name, proc]) => {
      // Register in the procedure registry so getProcedure() can find it
      registerProcedure(name, proc);

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
              // Resolve variable placeholders like ${email} from context/currentData
              if (typeof value === 'string') {
                value = TestExecutor.resolveVariablePlaceholders(value, context);
              }
              context.variables.set(p.name, value);
              context.logger.debug(`Set procedure param: ${p.name} = "${value}"`);
            } else {
              context.logger.warn(`Procedure param not found in params: ${paramKey} (available: ${Object.keys(params).join(', ')})`);
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

  async runTest(
    test: TestCase,
    fileVariables?: Record<string, unknown>,
    sharedContext?: ExecutionContext
  ): Promise<TestResult> {
    const startedAt = new Date().toISOString();
    const startTime = Date.now();
    const stepResults: StepResult[] = [];

    // Create execution context, inheriting variables from shared context (e.g., from beforeAll)
    const baseVariables = sharedContext
      ? Object.fromEntries(sharedContext.variables)
      : {
          ...this.resolveVariableDefaults(fileVariables),
          ...this.resolveVariableDefaults(this.options.variables),
        };

    const context: ExecutionContext = {
      variables: new Map(Object.entries(baseVariables)),
      results: [],
      browser: this.browser,
      page: this.page,
      logger: this.createLogger(),
      plugins: this.plugins,
      testIdAttribute: this.options.testIdAttribute,
      // Inherit procedures from shared context
      procedures: sharedContext?.procedures || new Map(),
      // Enable soft assertions if configured on the test
      softAssertions: test.softAssertions || false,
      softAssertionErrors: [],
    };

    // Run beforeTest hooks
    for (const plugin of this.plugins.values()) {
      if (plugin.hooks?.beforeTest) {
        await plugin.hooks.beforeTest(context, test);
      }
    }

    let testStatus: 'passed' | 'failed' | 'error' = 'passed';
    let testError: { message: string; stack?: string } | undefined;
    let collectedSoftErrors: SoftAssertionError[] = [];

    try {
      // Execute steps from Blockly serialization format
      const steps = this.extractStepsFromBlocklyState(test.steps);

      for (const step of steps) {
        const stepResult = await this.runStep(step, context);
        stepResults.push(stepResult);

        if (stepResult.status === 'failed' || stepResult.status === 'error') {
          testStatus = stepResult.status;
          testError = stepResult.error;
          // In soft assertion mode, continue executing remaining steps
          if (!context.softAssertions) {
            break;
          }
        }
      }

      // Check for soft assertion errors at the end of the test
      collectedSoftErrors = context.softAssertionErrors || [];
      if (collectedSoftErrors.length > 0 && testStatus === 'passed') {
        testStatus = 'failed';
        const errorMessages = collectedSoftErrors.map((e, i) => `  ${i + 1}. ${e.message}`).join('\n');
        testError = {
          message: `${collectedSoftErrors.length} soft assertion(s) failed:\n${errorMessages}`,
        };
      }
    } catch (error) {
      testStatus = 'error';
      testError = {
        message: (error as Error).message,
        stack: (error as Error).stack,
      };
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
      softAssertionErrors: collectedSoftErrors.length > 0 ? collectedSoftErrors : undefined,
    };

    // Run afterTest hooks
    for (const plugin of this.plugins.values()) {
      if (plugin.hooks?.afterTest) {
        await plugin.hooks.afterTest(context, test, result);
      }
    }

    return result;
  }

  async runTestWithData(
    test: TestCase,
    fileVariables: Record<string, unknown> | undefined,
    dataSet: TestDataSet,
    dataIndex: number,
    sharedContext?: ExecutionContext
  ): Promise<TestResult> {
    const testName = dataSet.name
      ? `${test.name} [${dataSet.name}]`
      : `${test.name} [${dataIndex + 1}]`;

    console.log(`  Running: ${testName}`);

    const startedAt = new Date().toISOString();
    const startTime = Date.now();
    const stepResults: StepResult[] = [];

    // Create execution context with data values, inheriting from shared context
    const baseVariables = sharedContext
      ? Object.fromEntries(sharedContext.variables)
      : {
          ...this.resolveVariableDefaults(fileVariables),
          ...this.resolveVariableDefaults(this.options.variables),
        };

    const context: ExecutionContext = {
      variables: new Map(Object.entries(baseVariables)),
      results: [],
      browser: this.browser,
      page: this.page,
      logger: this.createLogger(),
      plugins: this.plugins,
      testIdAttribute: this.options.testIdAttribute,
      // Inherit procedures from shared context
      procedures: sharedContext?.procedures || new Map(),
      currentData: dataSet,
      dataIndex,
      // Enable soft assertions if configured on the test
      softAssertions: test.softAssertions || false,
      softAssertionErrors: [],
    };

    // Inject data values into variables
    for (const [key, value] of Object.entries(dataSet.values)) {
      context.variables.set(key, value);
    }

    // Run beforeTest hooks
    for (const plugin of this.plugins.values()) {
      if (plugin.hooks?.beforeTest) {
        await plugin.hooks.beforeTest(context, test);
      }
    }

    let testStatus: 'passed' | 'failed' | 'error' = 'passed';
    let testError: { message: string; stack?: string } | undefined;
    let collectedSoftErrors: SoftAssertionError[] = [];

    try {
      // Execute steps from Blockly serialization format
      const steps = this.extractStepsFromBlocklyState(test.steps);

      for (const step of steps) {
        const stepResult = await this.runStep(step, context);
        stepResults.push(stepResult);

        if (stepResult.status === 'failed' || stepResult.status === 'error') {
          testStatus = stepResult.status;
          testError = stepResult.error;
          // In soft assertion mode, continue executing remaining steps
          if (!context.softAssertions) {
            break;
          }
        }
      }

      // Check for soft assertion errors at the end of the test
      collectedSoftErrors = context.softAssertionErrors || [];
      if (collectedSoftErrors.length > 0 && testStatus === 'passed') {
        testStatus = 'failed';
        const errorMessages = collectedSoftErrors.map((e, i) => `  ${i + 1}. ${e.message}`).join('\n');
        testError = {
          message: `${collectedSoftErrors.length} soft assertion(s) failed:\n${errorMessages}`,
        };
      }
    } catch (error) {
      testStatus = 'error';
      testError = {
        message: (error as Error).message,
        stack: (error as Error).stack,
      };
    }

    const result: TestResult = {
      testId: `${test.id}-${dataIndex}`,
      testName,
      status: testStatus,
      duration: Date.now() - startTime,
      steps: stepResults,
      error: testError,
      startedAt,
      finishedAt: new Date().toISOString(),
      softAssertionErrors: collectedSoftErrors.length > 0 ? collectedSoftErrors : undefined,
    };

    // Run afterTest hooks
    for (const plugin of this.plugins.values()) {
      if (plugin.hooks?.afterTest) {
        await plugin.hooks.afterTest(context, test, result);
      }
    }

    return result;
  }

  private extractStepsFromBlocklyState(state: unknown): TestStep[] {
    if (!state || typeof state !== 'object') return [];

    const stateObj = state as Record<string, unknown>;

    // Handle Blockly serialization format
    if ('blocks' in stateObj && typeof stateObj.blocks === 'object') {
      const blocks = stateObj.blocks as Record<string, unknown>;
      if ('blocks' in blocks && Array.isArray(blocks.blocks)) {
        return this.blocksToSteps(blocks.blocks);
      }
    }

    // Handle direct array of steps
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

        // Handle next block in chain
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

    // Extract field values
    if (block.fields && typeof block.fields === 'object') {
      for (const [name, value] of Object.entries(block.fields as Record<string, unknown>)) {
        step.params[name] = value;
      }
    }

    // Extract inputs (connected blocks)
    if (block.inputs && typeof block.inputs === 'object') {
      for (const [name, input] of Object.entries(block.inputs as Record<string, unknown>)) {
        const inputObj = input as Record<string, unknown>;
        if (inputObj.block) {
          // Recursively convert connected block
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
      // Get block definition
      const blockDef = getBlock(step.type);

      if (!blockDef) {
        throw new Error(`Unknown block type: ${step.type}`);
      }

      // Resolve any nested step params (connected blocks) to their values
      const resolvedParams = await this.resolveParams(step.params, context);

      // Execute the block
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

      // Handle compound actions (like procedure_login)
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

      // Handle procedure calls (procedure_call block)
      if (output && typeof output === 'object' && 'procedureCall' in output) {
        const procOutput = output as {
          procedureCall: boolean;
          name: string;
          args: Record<string, unknown>;
          procedure: ProcedureDefinition;
        };

        // Set procedure arguments as variables (resolve any ${var} placeholders first)
        for (const [argName, argValue] of Object.entries(procOutput.args)) {
          let resolvedValue = argValue;
          if (typeof argValue === 'string') {
            resolvedValue = TestExecutor.resolveVariablePlaceholders(argValue, context);
          }
          context.variables.set(argName, resolvedValue);
        }

        // Run the procedure's steps
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

    // Capture screenshot on failure for web tests only
    let screenshot: string | undefined;
    const isWebStep = step.type.startsWith('web_');
    if (status === 'failed' && isWebStep && context.page) {
      try {
        const page = context.page as { screenshot: (options?: { fullPage?: boolean }) => Promise<Buffer> };
        const screenshotBuffer = await page.screenshot({ fullPage: false });
        screenshot = `data:image/png;base64,${screenshotBuffer.toString('base64')}`;
      } catch (screenshotErr) {
        console.warn('Failed to capture screenshot:', (screenshotErr as Error).message);
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

  private async resolveParams(
    params: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<Record<string, unknown>> {
    const resolved: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(params)) {
      if (value && typeof value === 'object' && 'type' in value && 'id' in value) {
        // This is a connected block (has both 'type' and 'id') - execute it to get the value
        const nestedStep = value as TestStep;
        const blockDef = getBlock(nestedStep.type);

        if (blockDef) {
          const nestedParams = await this.resolveParams(nestedStep.params || {}, context);
          const result = await blockDef.execute(nestedParams, context);
          // Value blocks return { _value: actualValue, ... } - extract the actual value
          if (result && typeof result === 'object' && '_value' in result) {
            resolved[key] = (result as { _value: unknown })._value;
          } else {
            resolved[key] = result;
          }
        }
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
  }

  private loadDataFromFile(filePath: string): TestDataSet[] {
    try {
      // Resolve path relative to baseDir if not absolute
      const resolvedPath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(this.options.baseDir || process.cwd(), filePath);

      if (!fs.existsSync(resolvedPath)) {
        console.error(`Data file not found: ${resolvedPath}`);
        return [];
      }

      const content = fs.readFileSync(resolvedPath, 'utf-8');
      const ext = path.extname(resolvedPath).toLowerCase();

      if (ext === '.csv') {
        return parseCSV(content);
      } else if (ext === '.json') {
        const data = JSON.parse(content);
        // Expect JSON to be an array of objects with 'values' or direct objects
        if (Array.isArray(data)) {
          return data.map((item, i) => ({
            name: item.name || `Row ${i + 1}`,
            values: item.values || item,
          }));
        }
        return [];
      } else {
        console.error(`Unsupported data file format: ${ext}`);
        return [];
      }
    } catch (error) {
      console.error(`Failed to load data file: ${filePath}`, error);
      return [];
    }
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

  /**
   * Resolve ${variable} placeholders in a string using context variables and currentData
   */
  private static resolveVariablePlaceholders(text: string, context: ExecutionContext): string {
    if (typeof text !== 'string') return text;

    return text.replace(/\$\{([\w.]+)\}/g, (match, path) => {
      const parts = path.split('.');
      const varName = parts[0];

      // Check currentData first (for data-driven tests)
      if (context.currentData?.values[varName] !== undefined) {
        let value: unknown = context.currentData.values[varName];
        // Handle dot notation for nested access
        if (parts.length > 1 && value !== null && typeof value === 'object') {
          for (let i = 1; i < parts.length; i++) {
            if (value === undefined || value === null) break;
            value = (value as Record<string, unknown>)[parts[i]];
          }
        }
        if (value !== undefined && value !== null) {
          return typeof value === 'object' ? JSON.stringify(value) : String(value);
        }
      }

      // Then check context variables
      let value: unknown = context.variables.get(varName);
      if (parts.length > 1 && value !== undefined && value !== null) {
        for (let i = 1; i < parts.length; i++) {
          if (value === undefined || value === null) break;
          value = (value as Record<string, unknown>)[parts[i]];
        }
      }

      if (value === undefined || value === null) return match;
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
    });
  }

  private createLogger(): Logger {
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
        console.debug(`[DEBUG] ${message}`, data !== undefined ? data : '');
      },
    };
  }
}
