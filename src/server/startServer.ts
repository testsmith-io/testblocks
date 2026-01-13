import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { TestFile, TestResult, FolderHooks } from '../core';
import { TestExecutor } from './executor';
import { generateHTMLReport, generateJUnitXML, getTimestamp, ReportData } from '../cli/reporters';

// Read version from package.json
function getVersion(): string {
  try {
    // Method 1: Try require.resolve to find package.json (works for global/local installs)
    try {
      const pkgPath = require.resolve('@testsmith/testblocks/package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.version) return pkg.version;
    } catch {
      // Package might not be installed under this name, try relative paths
    }

    // Method 2: Try relative paths from this file
    const possiblePaths = [
      path.join(__dirname, '../../package.json'),      // dist/server -> package.json
      path.join(__dirname, '../../../package.json'),   // nested node_modules
      path.join(__dirname, '../../../../package.json'), // scoped package in node_modules
    ];
    for (const pkgPath of possiblePaths) {
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        // Verify it's our package
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

const VERSION = getVersion();
import {
  initializeServerPlugins,
  setPluginsDirectory,
  discoverPlugins,
  loadAllPlugins,
  loadTestFilePlugins,
  getServerPlugins,
  getPluginsDirectory,
} from './plugins';
import {
  initializeGlobalsAndSnippets,
  getGlobals,
  getGlobalVariables,
  getGlobalProcedures,
  getAllSnippets,
  getGlobalsDirectory,
  setGlobalsDirectory,
  getTestIdAttribute,
  setTestIdAttribute,
  getGlobalTimeout,
} from './globals';
import { codegenManager } from './codegenManager';

export interface ServerOptions {
  port?: number;
  pluginsDir?: string;
  globalsDir?: string;
  open?: boolean;
}

/**
 * Merge folder hooks into a test file.
 * Folder hooks are ordered from outermost to innermost folder.
 * - beforeAll: run parent hooks first, then child hooks, then test file hooks
 * - afterAll: run test file hooks first, then child hooks, then parent hooks
 * - beforeEach/afterEach: same pattern
 */
function mergeFolderHooksIntoTestFile(testFile: TestFile, folderHooks: FolderHooks[]): TestFile {
  if (!folderHooks || folderHooks.length === 0) {
    return testFile;
  }

  // Collect all steps from folder hooks (parent to child order is already provided)
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
  const merged: TestFile = {
    ...testFile,
    beforeAll: [
      ...beforeAllSteps,
      ...(testFile.beforeAll || []),
    ] as TestFile['beforeAll'],
    afterAll: [
      ...(testFile.afterAll || []),
      ...afterAllSteps,
    ] as TestFile['afterAll'],
    beforeEach: [
      ...beforeEachSteps,
      ...(testFile.beforeEach || []),
    ] as TestFile['beforeEach'],
    afterEach: [
      ...(testFile.afterEach || []),
      ...afterEachSteps,
    ] as TestFile['afterEach'],
  };

  return merged;
}

export async function startServer(options: ServerOptions = {}): Promise<void> {
  const port = options.port || 3000;
  const workingDir = process.cwd();

  // Set directories
  const pluginsDir = options.pluginsDir || path.join(workingDir, 'plugins');
  const globalsDir = options.globalsDir || workingDir;

  setPluginsDirectory(pluginsDir);
  setGlobalsDirectory(globalsDir);

  // Load plugins and globals
  try {
    await loadAllPlugins();
    initializeServerPlugins();
    initializeGlobalsAndSnippets();
  } catch (err) {
    console.error('Failed to load plugins:', err);
  }

  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // Serve static client files
  const clientDir = path.join(__dirname, '..', 'client');
  if (fs.existsSync(clientDir)) {
    app.use(express.static(clientDir));
  }

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', version: VERSION });
  });

  // Version endpoint
  app.get('/api/version', (_req, res) => {
    res.json({ version: VERSION });
  });

  // List available plugins (with full block definitions for client registration)
  app.get('/api/plugins', (_req, res) => {
    const available = discoverPlugins();
    const loaded = getServerPlugins().map(p => ({
      name: p.name,
      version: p.version,
      description: p.description,
      blocks: p.blocks, // Include full block definitions
    }));
    res.json({
      directory: getPluginsDirectory(),
      available,
      loaded,
    });
  });

  // Load specific plugins
  app.post('/api/plugins/load', async (req, res) => {
    try {
      const { plugins } = req.body as { plugins: string[] };
      await loadTestFilePlugins(plugins);
      res.json({ loaded: plugins });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Get globals and snippets
  app.get('/api/globals', (_req, res) => {
    const globals = getGlobals();
    const globalProcedures = getGlobalProcedures();
    const snippets = getAllSnippets().map(s => ({
      name: s.name,
      description: s.description,
      category: s.category,
      params: s.params,
      stepCount: s.steps.length,
    }));
    // Convert procedures to a format the client can use for blocks
    const procedures = Object.entries(globalProcedures).map(([, proc]) => ({
      name: proc.name,
      description: proc.description,
      category: 'Custom',
      params: proc.params,
      stepCount: proc.steps?.length || 0,
    }));
    res.json({
      directory: getGlobalsDirectory(),
      globals,
      snippets,
      procedures,
      testIdAttribute: getTestIdAttribute(),
    });
  });

  // Update test ID attribute
  app.put('/api/globals/test-id-attribute', (req, res) => {
    const { testIdAttribute } = req.body as { testIdAttribute: string };
    if (!testIdAttribute || typeof testIdAttribute !== 'string') {
      return res.status(400).json({ error: 'testIdAttribute is required and must be a string' });
    }
    setTestIdAttribute(testIdAttribute);
    res.json({ testIdAttribute: getTestIdAttribute() });
  });

  // Run tests
  app.post('/api/run', async (req, res) => {
    try {
      const { testFile, folderHooks } = req.body as { testFile: TestFile; folderHooks?: FolderHooks[] };

      if (!testFile || !testFile.tests) {
        return res.status(400).json({ error: 'Invalid test file format' });
      }

      console.log(`Running ${testFile.tests.length} tests from "${testFile.name}"...`);

      // Merge folder hooks into test file
      const mergedTestFile = mergeFolderHooksIntoTestFile(testFile, folderHooks || []);

      const globalVars = getGlobalVariables();
      const globalProcs = getGlobalProcedures();
      const testIdAttr = getTestIdAttribute();

      const executor = new TestExecutor({
        headless: req.query.headless !== 'false',
        timeout: Number(req.query.timeout) || getGlobalTimeout(),
        variables: globalVars,
        procedures: globalProcs,
        testIdAttribute: testIdAttr,
        baseDir: globalsDir,
      });

      const results = await executor.runTestFile(mergedTestFile);

      const passed = results.filter(r => r.status === 'passed').length;
      const failed = results.filter(r => r.status === 'failed').length;

      console.log(`Results: ${passed} passed, ${failed} failed`);

      res.json(results);
    } catch (error) {
      const err = error as Error;
      console.error('Test execution failed:', err.message);
      res.status(500).json({
        error: 'Test execution failed',
        message: err.message,
      });
    }
  });

  // Run a single test
  app.post('/api/run/:testId', async (req, res) => {
    try {
      const { testFile, folderHooks } = req.body as { testFile: TestFile; folderHooks?: FolderHooks[] };
      const { testId } = req.params;

      const test = testFile.tests.find(t => t.id === testId);

      if (!test) {
        return res.status(404).json({ error: `Test not found: ${testId}` });
      }

      // Return skipped result for disabled tests
      if (test.disabled) {
        return res.json({
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

      // Merge folder hooks for beforeEach/afterEach
      const mergedTestFile = mergeFolderHooksIntoTestFile(testFile, folderHooks || []);

      const globalVars = getGlobalVariables();
      const globalProcs = getGlobalProcedures();
      const testIdAttr = getTestIdAttribute();

      const executor = new TestExecutor({
        headless: req.query.headless !== 'false',
        timeout: Number(req.query.timeout) || getGlobalTimeout(),
        variables: globalVars,
        procedures: globalProcs,
        testIdAttribute: testIdAttr,
        baseDir: globalsDir,
      });

      // Register file-level procedures (overrides globals)
      if (mergedTestFile.procedures) {
        executor.registerProcedures(mergedTestFile.procedures);
      }

      await executor.initialize();
      const result = await executor.runTest(test, mergedTestFile.variables);
      await executor.cleanup();

      res.json(result);
    } catch (error) {
      console.error('Test execution failed:', error);
      res.status(500).json({
        error: 'Test execution failed',
        message: (error as Error).message,
      });
    }
  });

  // Validate test file
  app.post('/api/validate', (req, res) => {
    try {
      const testFile = req.body as TestFile;

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

      if (errors.length > 0) {
        res.status(400).json({ valid: false, errors });
      } else {
        res.json({ valid: true });
      }
    } catch (error) {
      res.status(400).json({
        valid: false,
        errors: ['Invalid JSON: ' + (error as Error).message],
      });
    }
  });

  // Recording endpoints
  app.post('/api/record/start', async (req, res) => {
    try {
      const { url, testIdAttribute } = req.body as { url: string; testIdAttribute?: string };

      if (!url) {
        return res.status(400).json({ error: 'URL is required' });
      }

      console.log(`Starting recording session for URL: ${url}`);
      const sessionId = await codegenManager.startRecording(url, {
        testIdAttribute: testIdAttribute || undefined,
      });

      res.json({
        sessionId,
        status: 'running',
      });
    } catch (error) {
      console.error('Failed to start recording:', error);
      res.status(500).json({
        error: 'Failed to start recording',
        message: (error as Error).message,
      });
    }
  });

  app.post('/api/record/stop', async (req, res) => {
    try {
      const { sessionId } = req.body as { sessionId: string };

      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }

      console.log(`Stopping recording session: ${sessionId}`);
      const steps = await codegenManager.stopRecording(sessionId);

      res.json({
        status: 'completed',
        steps,
      });

      setTimeout(() => {
        codegenManager.cleanup(sessionId);
      }, 5000);
    } catch (error) {
      console.error('Failed to stop recording:', error);
      res.status(500).json({
        error: 'Failed to stop recording',
        message: (error as Error).message,
      });
    }
  });

  app.get('/api/record/status/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const session = codegenManager.getStatus(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
      sessionId: session.id,
      status: session.status,
      url: session.url,
      error: session.error,
    });
  });

  // Report generation
  app.post('/api/reports/html', (req, res) => {
    try {
      const { testFile, results } = req.body as { testFile: TestFile; results: TestResult[] };

      if (!testFile || !results) {
        return res.status(400).json({ error: 'testFile and results are required' });
      }

      const timestamp = new Date().toISOString();
      const reportData: ReportData = {
        timestamp,
        summary: {
          totalTests: results.length,
          passed: results.filter(r => r.status === 'passed').length,
          failed: results.filter(r => r.status !== 'passed' && r.status !== 'skipped').length,
          skipped: results.filter(r => r.status === 'skipped').length,
          duration: results.reduce((sum, r) => sum + r.duration, 0),
        },
        testFiles: [{
          file: testFile.name || 'TestBlocks Test',
          testFile,
          results,
        }],
      };

      const html = generateHTMLReport(reportData);
      const filename = `report-${getTimestamp()}.html`;

      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(html);
    } catch (error) {
      console.error('Failed to generate HTML report:', error);
      res.status(500).json({
        error: 'Failed to generate report',
        message: (error as Error).message,
      });
    }
  });

  app.post('/api/reports/junit', (req, res) => {
    try {
      const { testFile, results } = req.body as { testFile: TestFile; results: TestResult[] };

      if (!testFile || !results) {
        return res.status(400).json({ error: 'testFile and results are required' });
      }

      const timestamp = new Date().toISOString();
      const reportData: ReportData = {
        timestamp,
        summary: {
          totalTests: results.length,
          passed: results.filter(r => r.status === 'passed').length,
          failed: results.filter(r => r.status !== 'passed' && r.status !== 'skipped').length,
          skipped: results.filter(r => r.status === 'skipped').length,
          duration: results.reduce((sum, r) => sum + r.duration, 0),
        },
        testFiles: [{
          file: testFile.name || 'TestBlocks Test',
          testFile,
          results,
        }],
      };

      const xml = generateJUnitXML(reportData);
      const filename = `junit-${getTimestamp()}.xml`;

      res.setHeader('Content-Type', 'application/xml');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(xml);
    } catch (error) {
      console.error('Failed to generate JUnit report:', error);
      res.status(500).json({
        error: 'Failed to generate report',
        message: (error as Error).message,
      });
    }
  });

  // Serve index.html for all non-API routes (SPA support)
  app.get('*', (_req, res) => {
    const indexPath = path.join(clientDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({ error: 'Web UI not found. Make sure testblocks is properly installed.' });
    }
  });

  // Cleanup handlers
  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, cleaning up...');
    codegenManager.cleanupAll();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('Received SIGINT, cleaning up...');
    codegenManager.cleanupAll();
    process.exit(0);
  });

  // Start server
  app.listen(port, () => {
    console.log(`\nTestBlocks Web UI running at http://localhost:${port}\n`);
    console.log('Directories:');
    console.log(`  Working directory: ${workingDir}`);
    console.log(`  Plugins: ${pluginsDir}`);
    console.log(`  Globals: ${globalsDir}`);
    console.log('\nPress Ctrl+C to stop\n');

    // Open browser if requested
    if (options.open) {
      const url = `http://localhost:${port}`;
      const command = process.platform === 'darwin' ? 'open' :
                     process.platform === 'win32' ? 'start' : 'xdg-open';
      import('child_process').then(cp => {
        cp.exec(`${command} ${url}`);
      });
    }
  });
}
