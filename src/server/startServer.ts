import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { TestFile, TestResult } from '../core';
import { TestExecutor } from './executor';
import { generateHTMLReport, generateJUnitXML, getTimestamp, ReportData } from '../cli/reporters';
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
  getAllSnippets,
  getGlobalsDirectory,
  setGlobalsDirectory,
  getTestIdAttribute,
  setTestIdAttribute,
} from './globals';
import { codegenManager } from './codegenManager';

export interface ServerOptions {
  port?: number;
  pluginsDir?: string;
  globalsDir?: string;
  open?: boolean;
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
    res.json({ status: 'ok', version: '1.0.0' });
  });

  // List available plugins
  app.get('/api/plugins', (_req, res) => {
    const available = discoverPlugins();
    const loaded = getServerPlugins().map(p => ({
      name: p.name,
      version: p.version,
      description: p.description,
      blockCount: p.blocks.length,
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
    const snippets = getAllSnippets().map(s => ({
      name: s.name,
      description: s.description,
      category: s.category,
      params: s.params,
      stepCount: s.steps.length,
    }));
    res.json({
      directory: getGlobalsDirectory(),
      globals,
      snippets,
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
      const testFile = req.body as TestFile;

      if (!testFile || !testFile.tests) {
        return res.status(400).json({ error: 'Invalid test file format' });
      }

      console.log(`Running ${testFile.tests.length} tests from "${testFile.name}"...`);

      const globalVars = getGlobalVariables();
      const testIdAttr = getTestIdAttribute();

      const executor = new TestExecutor({
        headless: req.query.headless !== 'false',
        timeout: Number(req.query.timeout) || 30000,
        variables: globalVars,
        testIdAttribute: testIdAttr,
        baseDir: globalsDir,
      });

      const results = await executor.runTestFile(testFile);

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
      const testFile = req.body as TestFile;
      const { testId } = req.params;

      const test = testFile.tests.find(t => t.id === testId);

      if (!test) {
        return res.status(404).json({ error: `Test not found: ${testId}` });
      }

      const globalVars = getGlobalVariables();
      const testIdAttr = getTestIdAttribute();

      const executor = new TestExecutor({
        headless: req.query.headless !== 'false',
        timeout: Number(req.query.timeout) || 30000,
        variables: globalVars,
        testIdAttribute: testIdAttr,
        baseDir: globalsDir,
      });

      if (testFile.procedures) {
        executor.registerProcedures(testFile.procedures);
      }

      await executor.initialize();
      const result = await executor.runTest(test, testFile.variables);
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
          failed: results.filter(r => r.status !== 'passed').length,
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
          failed: results.filter(r => r.status !== 'passed').length,
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
