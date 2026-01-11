import { BlockDefinition } from '../types';

// Lifecycle and Hook Blocks
export const lifecycleBlocks: BlockDefinition[] = [
  // Test Case - container for test steps
  {
    type: 'test_case',
    category: 'Tests',
    color: '#1E88E5',
    tooltip: 'A test case containing steps to execute',
    inputs: [
      { name: 'NAME', type: 'field', fieldType: 'multiline', default: 'Test Case' },
      { name: 'SOFT_ASSERTIONS', type: 'field', fieldType: 'checkbox', default: false },
      { name: 'STEPS', type: 'statement' },
    ],
    execute: async (params, _context) => {
      // Marker block - steps are executed by the executor
      return { testCase: true, name: params.NAME, softAssertions: params.SOFT_ASSERTIONS, statement: 'STEPS' };
    },
  },

  // Data-Driven Test Case - runs multiple times with different data
  {
    type: 'test_case_data_driven',
    category: 'Tests',
    color: '#1565C0',
    tooltip: 'A data-driven test case that runs for each row of data (CSV format: header row, then data rows)',
    inputs: [
      { name: 'NAME', type: 'field', fieldType: 'text', default: 'Data-Driven Test' },
      { name: 'SOFT_ASSERTIONS', type: 'field', fieldType: 'checkbox', default: false },
      { name: 'DATA', type: 'field', fieldType: 'multiline', default: 'username,password,expected\nuser1,pass1,true\nuser2,pass2,false' },
      { name: 'STEPS', type: 'statement' },
    ],
    execute: async (params, _context) => {
      // Marker block - actual data parsing and execution handled by executor
      const csvData = params.DATA as string;
      const rows = csvData.trim().split('\n').map(row => row.split(',').map(cell => cell.trim()));

      if (rows.length < 2) {
        return { testCase: true, name: params.NAME, softAssertions: params.SOFT_ASSERTIONS, dataDriven: true, data: [], statement: 'STEPS' };
      }

      const headers = rows[0];
      const data = rows.slice(1).map((row, index) => {
        const values: Record<string, unknown> = {};
        headers.forEach((header, i) => {
          let value: unknown = row[i] || '';
          // Try to parse as boolean or number
          if (value === 'true') value = true;
          else if (value === 'false') value = false;
          else if (!isNaN(Number(value)) && value !== '') value = Number(value);
          values[header] = value;
        });
        return { name: `Row ${index + 1}`, values };
      });

      return { testCase: true, name: params.NAME, softAssertions: params.SOFT_ASSERTIONS, dataDriven: true, data, statement: 'STEPS' };
    },
  },

  // Before All - runs once before all tests
  {
    type: 'lifecycle_before_all',
    category: 'Lifecycle',
    color: '#8E24AA',
    tooltip: 'Steps to run once before all tests in the suite',
    inputs: [
      { name: 'DO', type: 'statement' },
    ],
    execute: async (_params, _context) => {
      // Marker block - actual execution handled by executor
      return { lifecycle: 'beforeAll', statement: 'DO' };
    },
  },

  // After All - runs once after all tests
  {
    type: 'lifecycle_after_all',
    category: 'Lifecycle',
    color: '#8E24AA',
    tooltip: 'Steps to run once after all tests in the suite',
    inputs: [
      { name: 'DO', type: 'statement' },
    ],
    execute: async (_params, _context) => {
      return { lifecycle: 'afterAll', statement: 'DO' };
    },
  },

  // Before Each - runs before each test
  {
    type: 'lifecycle_before_each',
    category: 'Lifecycle',
    color: '#8E24AA',
    tooltip: 'Steps to run before each test',
    inputs: [
      { name: 'DO', type: 'statement' },
    ],
    execute: async (_params, _context) => {
      return { lifecycle: 'beforeEach', statement: 'DO' };
    },
  },

  // After Each - runs after each test
  {
    type: 'lifecycle_after_each',
    category: 'Lifecycle',
    color: '#8E24AA',
    tooltip: 'Steps to run after each test',
    inputs: [
      { name: 'DO', type: 'statement' },
    ],
    execute: async (_params, _context) => {
      return { lifecycle: 'afterEach', statement: 'DO' };
    },
  },

  // Setup - alias for beforeEach with clearer naming
  {
    type: 'lifecycle_setup',
    category: 'Lifecycle',
    color: '#8E24AA',
    tooltip: 'Setup steps to run before the test',
    inputs: [
      { name: 'DESCRIPTION', type: 'field', fieldType: 'text', default: 'Setup' },
      { name: 'DO', type: 'statement' },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      context.logger.info(`Setup: ${params.DESCRIPTION}`);
      return { lifecycle: 'setup', statement: 'DO' };
    },
  },

  // Teardown - alias for afterEach with clearer naming
  {
    type: 'lifecycle_teardown',
    category: 'Lifecycle',
    color: '#8E24AA',
    tooltip: 'Teardown steps to run after the test',
    inputs: [
      { name: 'DESCRIPTION', type: 'field', fieldType: 'text', default: 'Teardown' },
      { name: 'DO', type: 'statement' },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      context.logger.info(`Teardown: ${params.DESCRIPTION}`);
      return { lifecycle: 'teardown', statement: 'DO' };
    },
  },

  // Cleanup on failure - only runs if test fails
  {
    type: 'lifecycle_on_failure',
    category: 'Lifecycle',
    color: '#C62828',
    tooltip: 'Steps to run only if the test fails',
    inputs: [
      { name: 'DO', type: 'statement' },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (_params, _context) => {
      return { lifecycle: 'onFailure', statement: 'DO' };
    },
  },

  // Skip test conditionally
  {
    type: 'lifecycle_skip_if',
    category: 'Lifecycle',
    color: '#757575',
    tooltip: 'Skip the rest of the test if condition is true',
    inputs: [
      { name: 'CONDITION', type: 'value', check: 'Boolean', required: true },
      { name: 'REASON', type: 'field', fieldType: 'text', default: 'Condition not met' },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, _context) => {
      const condition = params.CONDITION as boolean;
      const reason = params.REASON as string;

      if (condition) {
        throw { skip: true, reason };
      }
    },
  },

  // Retry on failure
  {
    type: 'lifecycle_retry',
    category: 'Lifecycle',
    color: '#FF6F00',
    tooltip: 'Retry steps on failure',
    inputs: [
      { name: 'TIMES', type: 'field', fieldType: 'number', default: 3 },
      { name: 'DELAY', type: 'field', fieldType: 'number', default: 1000 },
      { name: 'DO', type: 'statement' },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, _context) => {
      const times = params.TIMES as number;
      const delay = params.DELAY as number;

      return { retry: true, times, delay, statement: 'DO' };
    },
  },
];
