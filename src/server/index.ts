import express from 'express';
import cors from 'cors';
import path from 'path';
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

// Set plugins directory (default to examples/plugins or can be overridden via env)
const pluginsDir = process.env.PLUGINS_DIR || path.join(process.cwd(), 'examples', 'plugins');
setPluginsDirectory(pluginsDir);

// Set globals directory (default to examples or can be overridden via env)
const globalsDir = process.env.GLOBALS_DIR || path.join(process.cwd(), 'examples');
setGlobalsDirectory(globalsDir);

// Load all discovered plugins on startup
loadAllPlugins().then(() => {
  initializeServerPlugins();
  // Load globals and snippets after plugins
  initializeGlobalsAndSnippets();
}).catch(err => {
  console.error('Failed to load plugins:', err);
});

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

// List available plugins (with full block definitions for client registration)
app.get('/api/plugins', (req, res) => {
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
app.get('/api/globals', (req, res) => {
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

    // Merge global variables with test file variables
    const globalVars = getGlobalVariables();
    const testIdAttr = getTestIdAttribute();

    const executor = new TestExecutor({
      headless: req.query.headless !== 'false',
      timeout: Number(req.query.timeout) || 30000,
      variables: globalVars, // Pass global variables
      testIdAttribute: testIdAttr, // Pass test ID attribute
      baseDir: globalsDir, // Base directory for resolving relative file paths
    });

    const results = await executor.runTestFile(testFile);

    const passed = results.filter(r => r.status === 'passed').length;
    const failed = results.filter(r => r.status === 'failed').length;

    console.log(`Results: ${passed} passed, ${failed} failed`);

    res.json(results);
  } catch (error) {
    const err = error as Error;
    console.error('Test execution failed:', err.message);
    console.error('Stack:', err.stack);
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

    // Merge global variables
    const globalVars = getGlobalVariables();
    const testIdAttr = getTestIdAttribute();

    const executor = new TestExecutor({
      headless: req.query.headless !== 'false',
      timeout: Number(req.query.timeout) || 30000,
      variables: globalVars,
      testIdAttribute: testIdAttr,
      baseDir: globalsDir, // Base directory for resolving relative file paths
    });

    // Register custom blocks from procedures before running the test
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

// ===== Recording Endpoints =====

// Start a recording session
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

// Stop a recording session and get the recorded steps
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

    // Clean up the session after returning the steps
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

// Get the status of a recording session
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

// ===== Report Generation Endpoints =====

// Generate HTML report from test results
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

// Generate JUnit XML report from test results
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

// Clean up sessions on server shutdown
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

app.listen(PORT, () => {
  console.log(`TestBlocks server running on http://localhost:${PORT}`);
  console.log('API endpoints:');
  console.log('  GET  /api/health          - Health check');
  console.log('  GET  /api/plugins         - List plugins');
  console.log('  GET  /api/globals         - Get globals and snippets');
  console.log('  POST /api/run             - Run all tests');
  console.log('  POST /api/run/:id         - Run single test');
  console.log('  POST /api/validate        - Validate test file');
  console.log('  POST /api/record/start    - Start recording session');
  console.log('  POST /api/record/stop     - Stop recording and get steps');
  console.log('  GET  /api/record/status   - Get recording session status');
  console.log('  POST /api/reports/html    - Generate HTML report');
  console.log('  POST /api/reports/junit   - Generate JUnit XML report');
});

export { TestExecutor };
