#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { TestFile, TestResult, ProcedureDefinition, FolderHooks } from '../core';
import { TestExecutor, ExecutorOptions } from './executor';
import { ConsoleReporter, JUnitReporter, JSONReporter, HTMLReporter, Reporter } from './reporters';
import { startServer } from '../server/startServer';
import { setPluginsDirectory, loadAllPlugins, initializeServerPlugins } from '../server/plugins';
import { setGlobalsDirectory, loadAllSnippets } from '../server/globals';

/**
 * Get the package version from package.json
 */
function getVersion(): string {
  try {
    // Try to find package.json relative to the compiled CLI
    const possiblePaths = [
      path.join(__dirname, '../../package.json'),      // dist/cli -> package.json
      path.join(__dirname, '../../../package.json'),   // nested node_modules
    ];
    for (const pkgPath of possiblePaths) {
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        if (pkg.name === '@testsmith/testblocks' && pkg.version) {
          return pkg.version;
        }
      }
    }
  } catch {
    // Ignore errors
  }
  return '0.0.0';
}

/**
 * Search up the directory tree for globals.json starting from the given directory
 */
function findGlobalsFile(startDir: string): string | null {
  let currentDir = path.resolve(startDir);
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    const globalsPath = path.join(currentDir, 'globals.json');
    if (fs.existsSync(globalsPath)) {
      return globalsPath;
    }
    currentDir = path.dirname(currentDir);
  }

  return null;
}

/**
 * Search up the directory tree for a plugins directory starting from the given directory
 */
function findPluginsDir(startDir: string): string | null {
  let currentDir = path.resolve(startDir);
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    const pluginsPath = path.join(currentDir, 'plugins');
    if (fs.existsSync(pluginsPath) && fs.statSync(pluginsPath).isDirectory()) {
      return pluginsPath;
    }
    currentDir = path.dirname(currentDir);
  }

  return null;
}

/**
 * Load folder hooks from a test file's directory up to the root globals directory
 * Returns hooks in order from outermost folder to innermost
 */
function loadFolderHooks(testFilePath: string, globalsDir: string | null): FolderHooks[] {
  let currentDir = path.dirname(path.resolve(testFilePath));
  const stopDir = globalsDir ? path.resolve(globalsDir) : null;

  // Collect hooks from innermost to outermost
  const collectedHooks: FolderHooks[] = [];

  while (currentDir) {
    const hooksPath = path.join(currentDir, '_hooks.testblocks.json');
    if (fs.existsSync(hooksPath)) {
      try {
        const content = fs.readFileSync(hooksPath, 'utf-8');
        const hooksFile = JSON.parse(content) as FolderHooks;
        collectedHooks.push(hooksFile);
      } catch (e) {
        console.warn(`Warning: Could not load hooks from ${hooksPath}: ${(e as Error).message}`);
      }
    }

    // Stop at globals directory or root
    if (stopDir && currentDir === stopDir) break;
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break; // Reached root
    currentDir = parentDir;
  }

  // Reverse to get outermost-to-innermost order
  return collectedHooks.reverse();
}

/**
 * Merge folder hooks into a test file
 * - beforeAll/beforeEach: parent hooks run first
 * - afterAll/afterEach: child hooks run first (reverse order)
 */
function mergeFolderHooksIntoTestFile(testFile: TestFile, folderHooks: FolderHooks[]): TestFile {
  if (!folderHooks || folderHooks.length === 0) {
    return testFile;
  }

  const beforeAllSteps: unknown[] = [];
  const afterAllSteps: unknown[] = [];
  const beforeEachSteps: unknown[] = [];
  const afterEachSteps: unknown[] = [];

  // Parent to child order for beforeAll/beforeEach
  for (const hooks of folderHooks) {
    if (hooks.beforeAll) beforeAllSteps.push(...hooks.beforeAll);
    if (hooks.beforeEach) beforeEachSteps.push(...hooks.beforeEach);
  }

  // Child to parent order for afterAll/afterEach
  for (let i = folderHooks.length - 1; i >= 0; i--) {
    const hooks = folderHooks[i];
    if (hooks.afterAll) afterAllSteps.unshift(...hooks.afterAll);
    if (hooks.afterEach) afterEachSteps.unshift(...hooks.afterEach);
  }

  // Merge with test file hooks
  return {
    ...testFile,
    beforeAll: [...beforeAllSteps, ...(testFile.beforeAll || [])] as TestFile['beforeAll'],
    afterAll: [...(testFile.afterAll || []), ...afterAllSteps] as TestFile['afterAll'],
    beforeEach: [...beforeEachSteps, ...(testFile.beforeEach || [])] as TestFile['beforeEach'],
    afterEach: [...(testFile.afterEach || []), ...afterEachSteps] as TestFile['afterEach'],
  };
}

const program = new Command();

program
  .name('testblocks')
  .description('CLI runner for TestBlocks visual test automation')
  .version(getVersion());

program
  .command('run')
  .description('Run test files')
  .argument('<patterns...>', 'Test file patterns (glob supported)')
  .option('-H, --headed', 'Run tests in headed mode (show browser)', false)
  .option('-t, --timeout <ms>', 'Test timeout in milliseconds', '30000')
  .option('-r, --reporter <types>', 'Reporter types (comma-separated): console, json, junit, html', 'console')
  .option('-o, --output <dir>', 'Output directory for reports', './testblocks-results')
  .option('-b, --base-url <url>', 'Base URL for relative URLs')
  .option('-v, --var <vars...>', 'Variables in key=value format')
  .option('-g, --globals <path>', 'Path to globals.json file', './globals.json')
  .option('--plugins-dir <dir>', 'Plugins directory (auto-discovered if not specified)')
  .option('--fail-fast', 'Stop on first test failure', false)
  .option('-p, --parallel <count>', 'Number of parallel workers', '1')
  .option('--filter <pattern>', 'Only run tests matching pattern')
  .action(async (patterns: string[], options) => {
    try {
      // Find test files
      const files: string[] = [];
      for (const pattern of patterns) {
        const matches = await glob(pattern, { absolute: true });
        files.push(...matches);
      }

      if (files.length === 0) {
        console.error('No test files found matching patterns:', patterns);
        process.exit(1);
      }

      console.log(`Found ${files.length} test file(s)\n`);

      // Load globals.json - search up directory tree from first test file if not explicitly specified
      let globalVariables: Record<string, unknown> = {};
      let globalProcedures: Record<string, ProcedureDefinition> = {};
      let globalsPath = path.resolve(options.globals);

      // If default globals path doesn't exist, search up from first test file
      if (!fs.existsSync(globalsPath) && options.globals === './globals.json' && files.length > 0) {
        const testDir = path.dirname(files[0]);
        globalsPath = findGlobalsFile(testDir) || globalsPath;
      }

      let globalTimeout: number | undefined;
      if (fs.existsSync(globalsPath)) {
        try {
          const globalsContent = fs.readFileSync(globalsPath, 'utf-8');
          const globals = JSON.parse(globalsContent);
          if (globals.variables && typeof globals.variables === 'object') {
            globalVariables = globals.variables;
          }
          if (globals.procedures && typeof globals.procedures === 'object') {
            globalProcedures = globals.procedures as Record<string, ProcedureDefinition>;
          }
          if (typeof globals.timeout === 'number') {
            globalTimeout = globals.timeout;
          }
        } catch (e) {
          console.warn(`Warning: Could not load globals from ${globalsPath}: ${(e as Error).message}`);
        }
      }

      // Load plugins - search up directory tree from first test file if not explicitly specified
      let pluginsDir = options.pluginsDir ? path.resolve(options.pluginsDir) : null;

      // If plugins dir not specified, auto-discover from test file location or globals location
      if (!pluginsDir && files.length > 0) {
        const testDir = path.dirname(files[0]);
        pluginsDir = findPluginsDir(testDir);
      }

      // Also check next to globals.json if still not found
      if (!pluginsDir && fs.existsSync(globalsPath)) {
        const globalsDir = path.dirname(globalsPath);
        const pluginsDirNextToGlobals = path.join(globalsDir, 'plugins');
        if (fs.existsSync(pluginsDirNextToGlobals) && fs.statSync(pluginsDirNextToGlobals).isDirectory()) {
          pluginsDir = pluginsDirNextToGlobals;
        }
      }

      // Load plugins if directory found
      if (pluginsDir && fs.existsSync(pluginsDir)) {
        setPluginsDirectory(pluginsDir);
        await loadAllPlugins();
        initializeServerPlugins();
      }

      // Load snippets from the globals directory (snippets/ folder next to globals.json)
      if (fs.existsSync(globalsPath)) {
        const globalsDir = path.dirname(globalsPath);
        setGlobalsDirectory(globalsDir);
        loadAllSnippets();
      }

      // Parse CLI variables (these override globals)
      const cliVariables: Record<string, unknown> = {};
      if (options.var) {
        for (const v of options.var) {
          const [key, ...valueParts] = v.split('=');
          const value = valueParts.join('=');
          // Try to parse as JSON, otherwise use as string
          try {
            cliVariables[key] = JSON.parse(value);
          } catch {
            cliVariables[key] = value;
          }
        }
      }

      // Merge variables: globals first, then CLI overrides
      const variables: Record<string, unknown> = { ...globalVariables, ...cliVariables };

      // If baseUrl is provided via CLI, add it to variables so ${baseUrl} resolves correctly
      if (options.baseUrl) {
        variables.baseUrl = options.baseUrl;
      }

      // Determine timeout: CLI option takes precedence, then globals.json, then default
      const cliTimeout = parseInt(options.timeout, 10);
      const effectiveTimeout = options.timeout !== '30000' ? cliTimeout : (globalTimeout ?? cliTimeout);

      // Create executor options
      const executorOptions: ExecutorOptions = {
        headless: !options.headed,
        timeout: effectiveTimeout,
        baseUrl: options.baseUrl,
        variables,
        procedures: globalProcedures,
      };

      // Create reporters (supports multiple, comma-separated)
      const reporters = createReporters(options.reporter, options.output);

      // Run tests
      const allResults: { file: string; results: TestResult[] }[] = [];
      let hasFailures = false;

      try {
        for (const file of files) {
          // Skip _hooks.testblocks.json files - these are folder hooks, not test files
          const basename = path.basename(file);
          if (basename === '_hooks.testblocks.json') {
            continue;
          }

          console.log(`Running: ${basename}`);

          const content = fs.readFileSync(file, 'utf-8');
          let testFile = JSON.parse(content) as TestFile;

          // Skip files that have no tests array (e.g., hooks-only files)
          if (!testFile.tests || !Array.isArray(testFile.tests)) {
            console.log('  (no tests in file)\n');
            continue;
          }

          // Load and merge folder hooks
          const globalsDir = fs.existsSync(globalsPath) ? path.dirname(globalsPath) : null;
          const folderHooks = loadFolderHooks(file, globalsDir);
          if (folderHooks.length > 0) {
            testFile = mergeFolderHooksIntoTestFile(testFile, folderHooks);
          }

          // Apply filter if specified
          if (options.filter) {
            const filterRegex = new RegExp(options.filter, 'i');
            testFile.tests = testFile.tests.filter(t => filterRegex.test(t.name));
          }

          if (testFile.tests.length === 0) {
            console.log('  (no tests match filter)\n');
            continue;
          }

          const executor = new TestExecutor(executorOptions);
          const results = await executor.runTestFile(testFile);

          allResults.push({ file, results });

          // Report results to all reporters
          reporters.forEach(r => r.onTestFileComplete(file, testFile, results));

          // Check for failures
          const failed = results.some(r => r.status !== 'passed');
          if (failed) {
            hasFailures = true;
            if (options.failFast) {
              console.log('\nStopping due to --fail-fast\n');
              break;
            }
          }
        }
      } catch (error) {
        console.error('Error during test execution:', (error as Error).message);
        hasFailures = true;
      } finally {
        // Always generate final reports, even on errors
        reporters.forEach(r => r.onComplete(allResults));
      }

      // Exit with appropriate code
      process.exit(hasFailures ? 1 : 0);
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate test files without running them')
  .argument('<patterns...>', 'Test file patterns (glob supported)')
  .action(async (patterns: string[]) => {
    try {
      const files: string[] = [];
      for (const pattern of patterns) {
        const matches = await glob(pattern, { absolute: true });
        files.push(...matches);
      }

      if (files.length === 0) {
        console.error('No test files found matching patterns:', patterns);
        process.exit(1);
      }

      let hasErrors = false;

      for (const file of files) {
        const basename = path.basename(file);

        // Skip _hooks.testblocks.json files from validation (they're hooks, not test files)
        if (basename === '_hooks.testblocks.json') {
          console.log(`Skipping: ${basename} (folder hooks file)`);
          continue;
        }

        console.log(`Validating: ${basename}`);

        try {
          const content = fs.readFileSync(file, 'utf-8');
          const testFile = JSON.parse(content) as TestFile;

          const errors = validateTestFile(testFile);

          if (errors.length > 0) {
            hasErrors = true;
            console.log('  ✗ Invalid');
            errors.forEach(err => console.log(`    - ${err}`));
          } else {
            const testCount = testFile.tests?.length || 0;
            console.log(`  ✓ Valid (${testCount} tests)`);
          }
        } catch (error) {
          hasErrors = true;
          console.log(`  ✗ Parse error: ${(error as Error).message}`);
        }
      }

      process.exit(hasErrors ? 1 : 0);
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Initialize a new TestBlocks project')
  .argument('[directory]', 'Directory to initialize (default: current directory)', '.')
  .option('--name <name>', 'Project name', 'my-testblocks-project')
  .action((directory: string, options: { name: string }) => {
    const projectDir = path.resolve(directory);
    const projectName = options.name;

    console.log(`\nInitializing TestBlocks project in ${projectDir}...\n`);

    // Create directories
    const dirs = ['tests', 'snippets', 'plugins', 'reports'];
    dirs.forEach(dir => {
      const dirPath = path.join(projectDir, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`  Created: ${dir}/`);
      }
    });

    // Create globals.json
    const globalsPath = path.join(projectDir, 'globals.json');
    if (!fs.existsSync(globalsPath)) {
      const globals = {
        variables: {
          baseUrl: 'https://example.com',
          credentials: {
            validUser: {
              email: 'test@example.com',
              password: 'password123',
            },
          },
        },
        testIdAttribute: 'data-testid',
      };
      fs.writeFileSync(globalsPath, JSON.stringify(globals, null, 2));
      console.log('  Created: globals.json');
    }

    // Create package.json
    const packagePath = path.join(projectDir, 'package.json');
    if (!fs.existsSync(packagePath)) {
      const packageJson = {
        name: projectName,
        version: '1.0.0',
        description: 'TestBlocks test automation project',
        scripts: {
          test: 'testblocks run tests/**/*.testblocks.json',
          'test:headed': 'testblocks run tests/**/*.testblocks.json --headed',
          'test:html': 'testblocks run tests/**/*.testblocks.json -r html -o reports',
          'test:junit': 'testblocks run tests/**/*.testblocks.json -r junit -o reports',
          'test:ci': 'testblocks run tests/**/*.testblocks.json -r console,html,junit -o reports',
        },
        devDependencies: {
            '@testsmith/testblocks': '^0.9.5',
        },
      };
      fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
      console.log('  Created: package.json');
    }

    // Create example test file
    const exampleTestPath = path.join(projectDir, 'tests', 'example.testblocks.json');
    if (!fs.existsSync(exampleTestPath)) {
      const exampleTest: TestFile = {
        version: '1.0.0',
        name: 'Example Test Suite',
        description: 'Sample tests demonstrating TestBlocks features',
        variables: {},
        tests: [
          {
            id: 'test-web-1',
            name: 'Example Web Test',
            description: 'Navigate to a page and verify content',
            steps: [
              {
                id: 'step-1',
                type: 'web_navigate',
                params: { URL: '${baseUrl}' },
              },
              {
                id: 'step-2',
                type: 'web_assert_title_contains',
                params: { TEXT: 'Example Domain' },
              },
            ],
            tags: ['web', 'smoke'],
          },
        ],
      };
      fs.writeFileSync(exampleTestPath, JSON.stringify(exampleTest, null, 2));
      console.log('  Created: tests/example.testblocks.json');
    }

    // Create data-driven example
    const dataDrivenPath = path.join(projectDir, 'tests', 'login-data-driven.testblocks.json');
    if (!fs.existsSync(dataDrivenPath)) {
      const dataDrivenTest: TestFile = {
        version: '1.0.0',
        name: 'Login Tests (Data-Driven)',
        description: 'Data-driven login tests with multiple user credentials',
        variables: {},
        tests: [
          {
            id: 'test-login-dd',
            name: 'Login with credentials',
            description: 'Tests login with different user types',
            data: [
              { name: 'Valid Admin', values: { username: 'admin@example.com', password: 'admin123', shouldSucceed: true } },
              { name: 'Valid User', values: { username: 'user@example.com', password: 'user123', shouldSucceed: true } },
              { name: 'Invalid Password', values: { username: 'user@example.com', password: 'wrong', shouldSucceed: false } },
              { name: 'Invalid User', values: { username: 'nobody@example.com', password: 'test', shouldSucceed: false } },
            ],
            steps: [
              {
                id: 'step-1',
                type: 'web_navigate',
                params: { URL: '${baseUrl}/login' },
              },
              {
                id: 'step-2',
                type: 'web_fill',
                params: { SELECTOR: '#email', VALUE: '${username}' },
              },
              {
                id: 'step-3',
                type: 'web_fill',
                params: { SELECTOR: '#password', VALUE: '${password}' },
              },
              {
                id: 'step-4',
                type: 'web_click',
                params: { SELECTOR: 'button[type="submit"]' },
              },
            ],
            tags: ['web', 'login', 'data-driven'],
          },
        ],
      };
      fs.writeFileSync(dataDrivenPath, JSON.stringify(dataDrivenTest, null, 2));
      console.log('  Created: tests/login-data-driven.testblocks.json');
    }

    // Create .gitignore
    const gitignorePath = path.join(projectDir, '.gitignore');
    if (!fs.existsSync(gitignorePath)) {
      const gitignore = `# Dependencies
node_modules/

# Reports
reports/

# IDE
.idea/
.vscode/

# OS
.DS_Store
Thumbs.db
`;
      fs.writeFileSync(gitignorePath, gitignore);
      console.log('  Created: .gitignore');
    }

    // Create GitHub Actions workflow
    const workflowDir = path.join(projectDir, '.github', 'workflows');
    if (!fs.existsSync(workflowDir)) {
      fs.mkdirSync(workflowDir, { recursive: true });
      console.log('  Created: .github/workflows/');
    }

    const workflowPath = path.join(workflowDir, 'testblocks.yml');
    if (!fs.existsSync(workflowPath)) {
      const workflow = `name: TestBlocks Tests

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx testblocks install-browsers

      - name: Run tests
        run: npm run test:ci

      - name: Upload HTML report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: html-report
          path: reports/*.html
          retention-days: 30

      - name: Upload JUnit report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: junit-report
          path: reports/*.xml
          retention-days: 30

      - name: Publish Test Results
        uses: dorny/test-reporter@v1
        if: always()
        with:
          name: Test Results
          path: reports/*.xml
          reporter: java-junit
`;
      fs.writeFileSync(workflowPath, workflow);
      console.log('  Created: .github/workflows/testblocks.yml');
    }

    console.log('\n✓ Project initialized successfully!\n');
    console.log('Next steps:');
    console.log('  1. cd ' + (directory === '.' ? '' : directory));
    console.log('  2. npm install');
    console.log('  3. npx testblocks install-browsers');
    console.log('  4. npm test\n');
    console.log('To open the visual test editor:');
    console.log('  testblocks serve\n');
  });

program
  .command('install-browsers')
  .description('Install Playwright browsers for running web tests')
  .option('--browser <browser>', 'Browser to install (chromium, firefox, webkit, all)', 'chromium')
  .action(async (options) => {
    const { execSync } = await import('child_process');
    const browser = options.browser === 'all' ? '' : options.browser;

    console.log(`Installing Playwright browser${browser ? `: ${browser}` : 's'}...`);

    try {
      // Use execSync to run playwright install with inherited stdio
      const command = `npx playwright install${browser ? ` ${browser}` : ''} --with-deps`;
      execSync(command, { stdio: 'inherit' });
      console.log('\n✓ Browsers installed successfully!');
    } catch (error) {
      console.error('\nFailed to install browsers:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List tests in test files')
  .argument('<patterns...>', 'Test file patterns (glob supported)')
  .action(async (patterns: string[]) => {
    try {
      const files: string[] = [];
      for (const pattern of patterns) {
        const matches = await glob(pattern, { absolute: true });
        files.push(...matches);
      }

      if (files.length === 0) {
        console.error('No test files found matching patterns:', patterns);
        process.exit(1);
      }

      for (const file of files) {
        // Skip _hooks.testblocks.json files
        const basename = path.basename(file);
        if (basename === '_hooks.testblocks.json') {
          continue;
        }

        console.log(`\n${basename}:`);

        const content = fs.readFileSync(file, 'utf-8');
        const testFile = JSON.parse(content) as TestFile;

        if (!testFile.tests || !Array.isArray(testFile.tests)) {
          console.log('  (no tests in file)');
          continue;
        }

        testFile.tests.forEach((test, index) => {
          const tags = test.tags?.length ? ` [${test.tags.join(', ')}]` : '';
          console.log(`  ${index + 1}. ${test.name}${tags}`);
        });
      }
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('serve')
  .description('Start the TestBlocks web UI')
  .option('-p, --port <port>', 'Port to run on', '3000')
  .option('--plugins-dir <dir>', 'Plugins directory', './plugins')
  .option('--globals-dir <dir>', 'Globals directory (where globals.json is located)', '.')
  .option('-o, --open', 'Open browser automatically', false)
  .action(async (options) => {
    const port = parseInt(options.port, 10);
    const pluginsDir = path.resolve(options.pluginsDir);
    const globalsDir = path.resolve(options.globalsDir);

    await startServer({
      port,
      pluginsDir,
      globalsDir,
      open: options.open,
    });
  });

function createReporters(types: string, outputDir: string): Reporter[] {
  const reporterTypes = types.split(',').map(t => t.trim().toLowerCase());
  const reporters: Reporter[] = [];

  for (const type of reporterTypes) {
    switch (type) {
      case 'json':
        reporters.push(new JSONReporter(outputDir));
        break;
      case 'junit':
        reporters.push(new JUnitReporter(outputDir));
        break;
      case 'html':
        reporters.push(new HTMLReporter(outputDir));
        break;
      case 'console':
        reporters.push(new ConsoleReporter());
        break;
      default:
        console.warn(`Unknown reporter type: ${type}, using console`);
        if (!reporters.some(r => r instanceof ConsoleReporter)) {
          reporters.push(new ConsoleReporter());
        }
    }
  }

  // Always include console reporter if not already included
  if (!reporters.some(r => r instanceof ConsoleReporter)) {
    reporters.unshift(new ConsoleReporter());
  }

  return reporters;
}

function validateTestFile(testFile: TestFile): string[] {
  const errors: string[] = [];

  if (!testFile.version) {
    errors.push('Missing version field');
  }

  if (!testFile.name) {
    errors.push('Missing name field');
  }

  if (!testFile.tests || !Array.isArray(testFile.tests)) {
    errors.push('Missing or invalid tests array');
  } else {
    testFile.tests.forEach((test, index) => {
      if (!test.id) {
        errors.push(`Test at index ${index} is missing an id`);
      }
      if (!test.name) {
        errors.push(`Test at index ${index} is missing a name`);
      }
    });
  }

  return errors;
}

program.parse();
