#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { TestFile, TestResult } from '../core';
import { TestExecutor, ExecutorOptions } from './executor';
import { ConsoleReporter, JUnitReporter, JSONReporter, HTMLReporter, Reporter } from './reporters';
import { startServer } from '../server/startServer';

const program = new Command();

program
  .name('testblocks')
  .description('CLI runner for TestBlocks visual test automation')
  .version('1.0.0');

program
  .command('run')
  .description('Run test files')
  .argument('<patterns...>', 'Test file patterns (glob supported)')
  .option('-H, --headed', 'Run tests in headed mode (show browser)', false)
  .option('-t, --timeout <ms>', 'Test timeout in milliseconds', '30000')
  .option('-r, --reporter <type>', 'Reporter type: console, json, junit, html', 'console')
  .option('-o, --output <dir>', 'Output directory for reports', './testblocks-results')
  .option('-b, --base-url <url>', 'Base URL for relative URLs')
  .option('-v, --var <vars...>', 'Variables in key=value format')
  .option('-g, --globals <path>', 'Path to globals.json file', './globals.json')
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

      // Load globals.json if it exists
      let globalVariables: Record<string, unknown> = {};
      const globalsPath = path.resolve(options.globals);
      if (fs.existsSync(globalsPath)) {
        try {
          const globalsContent = fs.readFileSync(globalsPath, 'utf-8');
          const globals = JSON.parse(globalsContent);
          if (globals.variables && typeof globals.variables === 'object') {
            globalVariables = globals.variables;
          }
        } catch (e) {
          console.warn(`Warning: Could not load globals from ${globalsPath}: ${(e as Error).message}`);
        }
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

      // Create executor options
      const executorOptions: ExecutorOptions = {
        headless: !options.headed,
        timeout: parseInt(options.timeout, 10),
        baseUrl: options.baseUrl,
        variables,
      };

      // Create reporter
      const reporter = createReporter(options.reporter, options.output);

      // Run tests
      const allResults: { file: string; results: TestResult[] }[] = [];
      let hasFailures = false;

      for (const file of files) {
        console.log(`Running: ${path.basename(file)}`);

        const content = fs.readFileSync(file, 'utf-8');
        const testFile = JSON.parse(content) as TestFile;

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

        // Report results
        reporter.onTestFileComplete(file, testFile, results);

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

      // Generate final report
      reporter.onComplete(allResults);

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
        console.log(`Validating: ${path.basename(file)}`);

        try {
          const content = fs.readFileSync(file, 'utf-8');
          const testFile = JSON.parse(content) as TestFile;

          const errors = validateTestFile(testFile);

          if (errors.length > 0) {
            hasErrors = true;
            console.log('  ✗ Invalid');
            errors.forEach(err => console.log(`    - ${err}`));
          } else {
            console.log(`  ✓ Valid (${testFile.tests.length} tests)`);
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
        },
        devDependencies: {
            '@testsmith/testblocks': '^0.4.0',
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

    console.log('\n✓ Project initialized successfully!\n');
    console.log('Next steps:');
    console.log('  1. cd ' + (directory === '.' ? '' : directory));
    console.log('  2. npm install');
    console.log('  3. npm test\n');
    console.log('To open the visual test editor:');
    console.log('  testblocks serve\n');
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
        console.log(`\n${path.basename(file)}:`);

        const content = fs.readFileSync(file, 'utf-8');
        const testFile = JSON.parse(content) as TestFile;

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

function createReporter(type: string, outputDir: string): Reporter {
  switch (type) {
    case 'json':
      return new JSONReporter(outputDir);
    case 'junit':
      return new JUnitReporter(outputDir);
    case 'html':
      return new HTMLReporter(outputDir);
    case 'console':
    default:
      return new ConsoleReporter();
  }
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
