import * as fs from 'fs';
import * as path from 'path';
import { TestFile, TestResult } from '../../core';
import { Reporter, ReportData } from './types';
import {
  getTimestamp,
  escapeHtml,
  formatStepType,
  getStepSummary,
  isApiRequestStep,
  formatStepOutput,
} from './utils';

/**
 * HTML reporter - generates a styled HTML report
 */
export class HTMLReporter implements Reporter {
  private outputDir: string;
  private allResults: { file: string; testFile: TestFile; results: TestResult[] }[] = [];

  constructor(outputDir: string) {
    this.outputDir = outputDir;
  }

  onTestFileComplete(file: string, testFile: TestFile, results: TestResult[]): void {
    this.allResults.push({ file, testFile, results });

    const passed = results.filter(r => r.status === 'passed').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const failed = results.filter(r => r.status !== 'passed' && r.status !== 'skipped').length;
    console.log(`  ${passed} passed, ${failed} failed, ${skipped} skipped\n`);
  }

  onComplete(allResults: { file: string; results: TestResult[] }[]): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    const timestamp = getTimestamp();
    const outputPath = path.join(this.outputDir, `report-${timestamp}.html`);

    const totalTests = allResults.reduce((sum, r) => sum + r.results.length, 0);
    const passed = allResults.reduce(
      (sum, r) => sum + r.results.filter(t => t.status === 'passed').length,
      0
    );
    const skipped = allResults.reduce(
      (sum, r) => sum + r.results.filter(t => t.status === 'skipped').length,
      0
    );
    const failed = allResults.reduce(
      (sum, r) => sum + r.results.filter(t => t.status !== 'passed' && t.status !== 'skipped').length,
      0
    );
    const totalDuration = allResults.reduce(
      (sum, r) => sum + r.results.reduce((s, t) => s + t.duration, 0),
      0
    );

    const html = generateHTMLReport({
      timestamp: new Date().toISOString(),
      summary: { totalTests, passed, failed, skipped, duration: totalDuration },
      testFiles: this.allResults,
    });

    fs.writeFileSync(outputPath, html);
    console.log(`HTML report saved to: ${outputPath}`);
  }
}

/**
 * Generate HTML report from report data
 */
export function generateHTMLReport(data: ReportData): string {
  const { timestamp, summary, testFiles } = data;

  // Separate lifecycle hooks from actual tests for counting
  let actualTests = 0;
  let actualPassed = 0;
  let actualFailed = 0;
  let actualSkipped = 0;

  for (const { results } of testFiles) {
    for (const result of results) {
      if (!result.isLifecycle) {
        actualTests++;
        if (result.status === 'passed') actualPassed++;
        else if (result.status === 'skipped') actualSkipped++;
        else actualFailed++;
      }
    }
  }

  // Pass rate excludes skipped tests from calculation
  const runTests = actualTests - actualSkipped;
  const passRate = runTests > 0
    ? ((actualPassed / runTests) * 100).toFixed(1)
    : '0';

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TestBlocks Report - ${timestamp}</title>
  <style>
${getHTMLStyles()}
  </style>
</head>
<body>
  <div class="container">
    <h1>TestBlocks Test Report</h1>
    <div class="timestamp">Generated: ${new Date(timestamp).toLocaleString()}</div>

    <div class="summary">
      <div class="summary-card">
        <div class="value">${actualTests}</div>
        <div class="label">Total Tests</div>
      </div>
      <div class="summary-card passed">
        <div class="value">${actualPassed}</div>
        <div class="label">Passed</div>
      </div>
      <div class="summary-card failed">
        <div class="value">${actualFailed}</div>
        <div class="label">Failed</div>
      </div>
      <div class="summary-card skipped">
        <div class="value">${actualSkipped}</div>
        <div class="label">Skipped</div>
      </div>
      <div class="summary-card">
        <div class="value">${passRate}%</div>
        <div class="label">Pass Rate</div>
      </div>
      <div class="summary-card">
        <div class="value">${(summary.duration / 1000).toFixed(1)}s</div>
        <div class="label">Duration</div>
      </div>
    </div>
`;

  for (const { file, testFile, results } of testFiles) {
    html += renderTestFile(file, testFile, results);
  }

  html += `
  </div>
</body>
</html>`;

  return html;
}

/**
 * Render a single test file section
 */
function renderTestFile(file: string, testFile: TestFile, results: TestResult[]): string {
  // Separate lifecycle hooks from tests
  const lifecycleResults = results.filter(r => r.isLifecycle);
  const testResults = results.filter(r => !r.isLifecycle);

  const filePassed = testResults.filter(r => r.status === 'passed').length;
  const fileSkipped = testResults.filter(r => r.status === 'skipped').length;
  const fileFailed = testResults.filter(r => r.status !== 'passed' && r.status !== 'skipped').length;

  let html = `
    <div class="test-file">
      <div class="test-file-header">
        <span>${escapeHtml(testFile.name)}</span>
        <span class="test-file-path">${escapeHtml(file)} • ${filePassed} passed, ${fileFailed} failed, ${fileSkipped} skipped</span>
      </div>
`;

  // Render lifecycle hooks (beforeAll)
  const beforeAllHooks = lifecycleResults.filter(r => r.lifecycleType === 'beforeAll');
  if (beforeAllHooks.length > 0) {
    html += renderLifecycleSection('Before All', beforeAllHooks);
  }

  // Render actual tests
  for (const result of testResults) {
    html += renderTestCase(result, testFile);
  }

  // Render lifecycle hooks (afterAll)
  const afterAllHooks = lifecycleResults.filter(r => r.lifecycleType === 'afterAll');
  if (afterAllHooks.length > 0) {
    html += renderLifecycleSection('After All', afterAllHooks);
  }

  html += `    </div>\n`;
  return html;
}

/**
 * Render lifecycle section (beforeAll/afterAll)
 */
function renderLifecycleSection(title: string, hooks: TestResult[]): string {
  let html = `      <div class="lifecycle-section">\n`;
  html += `        <div class="lifecycle-header">${title}</div>\n`;

  for (const hook of hooks) {
    const iconClass = hook.status === 'passed' ? 'passed' : 'failed';
    html += `        <div class="lifecycle-item">
          <span class="step-dot ${iconClass}"></span>
          <span>${hook.steps.length} steps</span>
          <span style="color: var(--color-text-secondary); font-size: 12px;">${hook.duration}ms</span>
        </div>\n`;
    if (hook.error) {
      html += `        <div class="error-message" style="margin: 4px 0 0 16px;">${escapeHtml(hook.error.message)}</div>\n`;
    }
  }

  html += `      </div>\n`;
  return html;
}

/**
 * Render a single test case
 */
function renderTestCase(result: TestResult, testFile: TestFile): string {
  const statusIcon = result.status === 'passed' ? '✓' : result.status === 'failed' ? '✗' : '○';
  const testId = `test-${Math.random().toString(36).substr(2, 9)}`;

  let html = `
      <div class="test-case ${result.status}">
        <div class="test-case-header">
          <div class="status-icon ${result.status}">${statusIcon}</div>
          <div class="test-name">${escapeHtml(result.testName)}</div>
          <div class="test-duration">${result.duration}ms</div>
          <button class="steps-toggle" onclick="document.getElementById('${testId}').classList.toggle('open'); this.textContent = this.textContent.includes('▶') ? '▼ ${result.steps.length} steps' : '▶ ${result.steps.length} steps'">
            ▶ ${result.steps.length} steps
          </button>
        </div>
`;

  if (result.error) {
    html += `        <div class="error-message">${escapeHtml(result.error.message)}</div>\n`;
  }

  html += `        <div class="steps-list" id="${testId}">\n`;

  for (const step of result.steps) {
    html += renderStep(step);
  }

  html += `        </div>\n`;
  html += `      </div>\n`;

  return html;
}

/**
 * Render a single step
 */
function renderStep(step: { stepId: string; stepType: string; status: string; duration: number; output?: unknown; error?: { message: string; stack?: string }; screenshot?: string }): string {
  const summary = getStepSummary(step.stepType, step.output);
  const isApiRequest = isApiRequestStep(step.stepType);
  const response = step.output as { status?: number; headers?: Record<string, string>; body?: unknown } | undefined;

  let html = `          <div class="step">
            <div class="step-header">
              <span class="step-dot ${step.status}"></span>
              <span class="step-type">${escapeHtml(formatStepType(step.stepType))}</span>
              ${summary ? `<span class="step-summary">${escapeHtml(summary)}</span>` : ''}
              <span class="step-duration">${step.duration}ms</span>
            </div>
`;

  // Show step error
  if (step.error) {
    html += `            <div class="step-error">${escapeHtml(step.error.message)}</div>\n`;
  }

  // Show API response details
  if (isApiRequest && response) {
    html += `            <div class="step-details">\n`;

    if (response.status) {
      const statusClass = response.status >= 200 && response.status < 300 ? 'success'
        : response.status >= 400 && response.status < 500 ? 'client-error'
        : response.status >= 500 ? 'server-error' : '';
      html += `              <div class="response-status">
                <span class="response-label">Status:</span>
                <span class="status-code ${statusClass}">${response.status}</span>
              </div>\n`;
    }

    if (response.headers && Object.keys(response.headers).length > 0) {
      html += `              <details class="response-section">
                <summary>Headers</summary>
                <pre class="response-pre">${escapeHtml(JSON.stringify(response.headers, null, 2))}</pre>
              </details>\n`;
    }

    if (response.body !== undefined) {
      const bodyStr = typeof response.body === 'string'
        ? response.body
        : JSON.stringify(response.body, null, 2);
      html += `              <details class="response-section">
                <summary>Body</summary>
                <pre class="response-pre">${escapeHtml(bodyStr)}</pre>
              </details>\n`;
    }

    html += `            </div>\n`;
  } else if (step.output !== undefined && step.output !== null && !step.screenshot) {
    // Show generic output for non-API steps
    const outputStr = formatStepOutput(step.output, step.stepType);
    if (outputStr) {
      html += `            <div class="step-details">
              <pre class="response-pre">${escapeHtml(outputStr)}</pre>
            </div>\n`;
    }
  }

  // Show stack trace for errors
  if (step.error?.stack) {
    html += `            <details class="response-section">
              <summary>Stack Trace</summary>
              <pre class="response-pre stack-trace">${escapeHtml(step.error.stack)}</pre>
            </details>\n`;
  }

  // Show screenshot
  if (step.screenshot) {
    html += `            <img class="screenshot" src="${step.screenshot}" alt="Screenshot at failure" onclick="window.open(this.src, '_blank')">\n`;
  }

  html += `          </div>\n`;

  return html;
}

/**
 * Get CSS styles for HTML report
 */
function getHTMLStyles(): string {
  return `    :root {
      --color-passed: #22c55e;
      --color-failed: #ef4444;
      --color-skipped: #f59e0b;
      --color-bg: #f8fafc;
      --color-surface: #ffffff;
      --color-border: #e2e8f0;
      --color-text: #334155;
      --color-text-secondary: #64748b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--color-bg);
      color: var(--color-text);
      line-height: 1.5;
      padding: 24px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { font-size: 24px; font-weight: 600; margin-bottom: 8px; }
    .timestamp { color: var(--color-text-secondary); font-size: 14px; margin-bottom: 24px; }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }
    .summary-card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }
    .summary-card .value { font-size: 32px; font-weight: 700; }
    .summary-card .label { font-size: 14px; color: var(--color-text-secondary); }
    .summary-card.passed .value { color: var(--color-passed); }
    .summary-card.failed .value { color: var(--color-failed); }
    .summary-card.skipped .value { color: var(--color-skipped); }
    .test-file {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      margin-bottom: 16px;
      overflow: hidden;
    }
    .test-file-header {
      padding: 16px;
      border-bottom: 1px solid var(--color-border);
      font-weight: 600;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .test-file-path { font-size: 12px; color: var(--color-text-secondary); font-weight: normal; }
    .lifecycle-section {
      background: #f1f5f9;
      padding: 8px 16px;
      border-bottom: 1px solid var(--color-border);
    }
    .lifecycle-header {
      font-size: 12px;
      font-weight: 600;
      color: var(--color-text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .lifecycle-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 0;
      font-size: 13px;
    }
    .test-case {
      padding: 12px 16px;
      border-bottom: 1px solid var(--color-border);
    }
    .test-case:last-child { border-bottom: none; }
    .test-case.passed { border-left: 3px solid var(--color-passed); }
    .test-case.failed { border-left: 3px solid var(--color-failed); }
    .test-case.skipped { border-left: 3px solid var(--color-skipped); }
    .test-case-header {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .status-icon {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      color: white;
      flex-shrink: 0;
    }
    .status-icon.passed { background: var(--color-passed); }
    .status-icon.failed { background: var(--color-failed); }
    .status-icon.skipped { background: var(--color-skipped); }
    .test-name { flex: 1; font-weight: 500; }
    .test-duration { color: var(--color-text-secondary); font-size: 14px; }
    .error-message {
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 4px;
      padding: 8px 12px;
      margin: 8px 0 0 32px;
      font-size: 13px;
      color: #991b1b;
    }
    .steps-toggle {
      background: none;
      border: none;
      color: var(--color-text-secondary);
      cursor: pointer;
      font-size: 12px;
      padding: 4px 8px;
    }
    .steps-toggle:hover { text-decoration: underline; }
    .steps-list {
      display: none;
      margin: 12px 0 0 32px;
      border-left: 2px solid var(--color-border);
      padding-left: 16px;
    }
    .steps-list.open { display: block; }
    .step {
      padding: 8px 0;
      border-bottom: 1px solid #f1f5f9;
    }
    .step:last-child { border-bottom: none; }
    .step-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
    }
    .step-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .step-dot.passed { background: var(--color-passed); }
    .step-dot.failed { background: var(--color-failed); }
    .step-type { font-weight: 500; }
    .step-summary { color: var(--color-text-secondary); }
    .step-duration { color: var(--color-text-secondary); font-size: 12px; margin-left: auto; }
    .step-details {
      margin-top: 8px;
      padding: 8px;
      background: #f8fafc;
      border-radius: 4px;
      font-size: 12px;
    }
    .step-error {
      color: #991b1b;
      margin-top: 4px;
    }
    .response-status {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .response-label { font-weight: 500; }
    .status-code { font-family: monospace; padding: 2px 6px; border-radius: 4px; }
    .status-code.success { background: #dcfce7; color: #166534; }
    .status-code.client-error { background: #fef3c7; color: #92400e; }
    .status-code.server-error { background: #fef2f2; color: #991b1b; }
    .response-section {
      margin-top: 8px;
    }
    .response-section summary {
      cursor: pointer;
      font-weight: 500;
      font-size: 12px;
      color: var(--color-text-secondary);
    }
    .response-pre {
      background: #1e293b;
      color: #e2e8f0;
      padding: 12px;
      border-radius: 4px;
      overflow-x: auto;
      font-family: monospace;
      font-size: 12px;
      margin-top: 4px;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .stack-trace {
      background: #fef2f2;
      color: #991b1b;
    }
    .screenshot {
      max-width: 100%;
      max-height: 300px;
      border: 1px solid var(--color-border);
      border-radius: 4px;
      margin-top: 8px;
      cursor: pointer;
    }`;
}
