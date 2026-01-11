// Folder-level hooks that apply to all tests in a folder
export interface FolderHooks {
  version: string;
  beforeAll?: TestStep[];
  afterAll?: TestStep[];
  beforeEach?: TestStep[];
  afterEach?: TestStep[];
}

// Test file schema - this is what gets saved to disk and stored in repos
export interface TestFile {
  version: string;
  name: string;
  description?: string;
  variables?: Record<string, VariableDefinition>;
  // Lifecycle hooks at suite level
  beforeAll?: TestStep[];
  afterAll?: TestStep[];
  beforeEach?: TestStep[];
  afterEach?: TestStep[];
  // Custom reusable procedures
  procedures?: Record<string, ProcedureDefinition>;
  // Test cases
  tests: TestCase[];
  metadata?: Record<string, unknown>;
}

export interface VariableDefinition {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  default?: unknown;
  description?: string;
}

// Custom procedure definition (reusable block)
export interface ProcedureDefinition {
  name: string;
  description?: string;
  // Input parameters
  params?: ProcedureParam[];
  // Return value type
  returnType?: string;
  // The steps to execute
  steps: TestStep[];
}

export interface ProcedureParam {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any';
  default?: unknown;
  description?: string;
}

export interface TestCase {
  id: string;
  name: string;
  description?: string;
  // Data-driven testing: run test for each item in data array
  data?: TestDataSet[];
  // Data-driven testing: path to CSV file (relative to test file or absolute)
  dataFile?: string;
  // Per-test hooks
  beforeEach?: TestStep[];
  afterEach?: TestStep[];
  steps: TestStep[];
  tags?: string[];
  // Soft assertions: collect all assertion failures instead of stopping at first
  softAssertions?: boolean;
}

// Data set for data-driven testing
export interface TestDataSet {
  name?: string;  // Optional name for the data set iteration
  values: Record<string, unknown>;
}

export interface TestStep {
  id: string;
  type: string;
  params: Record<string, unknown>;
  children?: TestStep[];
}

// Block definition system for extensibility
export interface BlockDefinition {
  type: string;
  category: string;
  color: string;
  tooltip?: string;
  helpUrl?: string;
  inputs: BlockInput[];
  output?: BlockOutput;
  previousStatement?: boolean;
  nextStatement?: boolean;
  execute: (params: Record<string, unknown>, context: ExecutionContext) => Promise<unknown>;
}

export interface BlockInput {
  name: string;
  type: 'value' | 'statement' | 'field';
  fieldType?: 'text' | 'number' | 'dropdown' | 'checkbox' | 'variable' | 'multiline';
  options?: Array<[string, string]>; // For dropdowns: [label, value]
  check?: string | string[];
  default?: unknown;
  required?: boolean;
}

export interface BlockOutput {
  type: string | string[];
}

// Soft assertion error - collected instead of thrown immediately
export interface SoftAssertionError {
  message: string;
  stepId?: string;
  stepType?: string;
  expected?: unknown;
  actual?: unknown;
  timestamp: string;
}

// Execution context passed to blocks during test runs
export interface ExecutionContext {
  variables: Map<string, unknown>;
  results: TestResult[];
  browser?: unknown; // Playwright browser instance
  page?: unknown; // Playwright page instance
  apiClient?: unknown;
  logger: Logger;
  plugins: Map<string, Plugin>;
  abortSignal?: AbortSignal;
  // Custom procedures available in this context
  procedures?: Map<string, ProcedureDefinition>;
  // Current data set for data-driven testing
  currentData?: TestDataSet;
  // Current test iteration index (for data-driven)
  dataIndex?: number;
  // Test ID attribute for building selectors (e.g., 'data-testid', 'data-test')
  testIdAttribute?: string;
  // Soft assertions mode - when enabled, assertions are collected instead of throwing
  softAssertions?: boolean;
  // Collected soft assertion errors
  softAssertionErrors?: SoftAssertionError[];
}

export interface Logger {
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
  debug(message: string, data?: unknown): void;
}

// Test results
export interface TestResult {
  testId: string;
  testName: string;
  status: 'passed' | 'failed' | 'skipped' | 'error';
  duration: number;
  steps: StepResult[];
  error?: ErrorInfo;
  startedAt: string;
  finishedAt: string;
  // For data-driven tests
  dataIteration?: {
    index: number;
    name?: string;
    data: Record<string, unknown>;
  };
  // Lifecycle indicator
  isLifecycle?: boolean;
  lifecycleType?: 'beforeAll' | 'afterAll' | 'beforeEach' | 'afterEach';
  // Soft assertion errors collected during test
  softAssertionErrors?: SoftAssertionError[];
}

export interface StepResult {
  stepId: string;
  stepType: string;
  status: 'passed' | 'failed' | 'skipped' | 'error';
  duration: number;
  output?: unknown;
  error?: ErrorInfo;
  screenshot?: string;
}

export interface ErrorInfo {
  message: string;
  stack?: string;
  code?: string;
}

// Plugin system for extensibility
export interface Plugin {
  name: string;
  version: string;
  description?: string;
  blocks: BlockDefinition[];
  hooks?: PluginHooks;
}

export interface PluginHooks {
  beforeAll?: (context: ExecutionContext) => Promise<void>;
  afterAll?: (context: ExecutionContext) => Promise<void>;
  beforeTest?: (context: ExecutionContext, test: TestCase) => Promise<void>;
  afterTest?: (context: ExecutionContext, test: TestCase, result: TestResult) => Promise<void>;
  beforeStep?: (context: ExecutionContext, step: TestStep) => Promise<void>;
  afterStep?: (context: ExecutionContext, step: TestStep, result: StepResult) => Promise<void>;
}

// CLI configuration
export interface CLIConfig {
  testFiles: string[];
  outputDir?: string;
  reporter?: 'console' | 'json' | 'junit' | 'html';
  parallel?: number;
  timeout?: number;
  headless?: boolean;
  baseUrl?: string;
  variables?: Record<string, unknown>;
  plugins?: string[];
}
