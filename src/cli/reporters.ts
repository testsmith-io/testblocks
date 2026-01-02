import * as fs from 'fs';
import * as path from 'path';
import { TestFile, TestResult } from '../core';

export interface Reporter {
  onTestFileComplete(file: string, testFile: TestFile, results: TestResult[]): void;
  onComplete(allResults: { file: string; results: TestResult[] }[]): void;
}

// Generate timestamp string for filenames (e.g., 2024-01-15T14-30-45)
export function getTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

export class ConsoleReporter implements Reporter {
  onTestFileComplete(file: string, testFile: TestFile, results: TestResult[]): void {
    console.log('');

    for (const result of results) {
      const icon = result.status === 'passed' ? '✓' : '✗';
      const color = result.status === 'passed' ? '\x1b[32m' : '\x1b[31m';
      const reset = '\x1b[0m';

      console.log(`${color}  ${icon} ${result.testName}${reset} (${result.duration}ms)`);

      if (result.error) {
        console.log(`    ${result.error.message}`);
      }
    }

    console.log('');
  }

  onComplete(allResults: { file: string; results: TestResult[] }[]): void {
    const totalTests = allResults.reduce((sum, r) => sum + r.results.length, 0);
    const passed = allResults.reduce(
      (sum, r) => sum + r.results.filter(t => t.status === 'passed').length,
      0
    );
    const failed = allResults.reduce(
      (sum, r) => sum + r.results.filter(t => t.status !== 'passed').length,
      0
    );
    const totalDuration = allResults.reduce(
      (sum, r) => sum + r.results.reduce((s, t) => s + t.duration, 0),
      0
    );

    console.log('─'.repeat(50));
    console.log(`Tests:       ${passed} passed, ${failed} failed, ${totalTests} total`);
    console.log(`Duration:    ${(totalDuration / 1000).toFixed(2)}s`);
    console.log(`Test Files:  ${allResults.length}`);
    console.log('─'.repeat(50));

    if (failed > 0) {
      console.log('\n\x1b[31mTest run failed\x1b[0m\n');
    } else {
      console.log('\n\x1b[32mAll tests passed!\x1b[0m\n');
    }
  }
}

export class JSONReporter implements Reporter {
  private outputDir: string;
  private allResults: { file: string; testFile: TestFile; results: TestResult[] }[] = [];

  constructor(outputDir: string) {
    this.outputDir = outputDir;
  }

  onTestFileComplete(file: string, testFile: TestFile, results: TestResult[]): void {
    this.allResults.push({ file, testFile, results });

    const passed = results.filter(r => r.status === 'passed').length;
    const failed = results.filter(r => r.status !== 'passed').length;
    console.log(`  ${passed} passed, ${failed} failed\n`);
  }

  onComplete(allResults: { file: string; results: TestResult[] }[]): void {
    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    const timestamp = getTimestamp();
    const outputPath = path.join(this.outputDir, `results-${timestamp}.json`);

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalFiles: allResults.length,
        totalTests: allResults.reduce((sum, r) => sum + r.results.length, 0),
        passed: allResults.reduce(
          (sum, r) => sum + r.results.filter(t => t.status === 'passed').length,
          0
        ),
        failed: allResults.reduce(
          (sum, r) => sum + r.results.filter(t => t.status !== 'passed').length,
          0
        ),
        duration: allResults.reduce(
          (sum, r) => sum + r.results.reduce((s, t) => s + t.duration, 0),
          0
        ),
      },
      testFiles: this.allResults.map(({ file, testFile, results }) => ({
        file,
        name: testFile.name,
        results,
      })),
    };

    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`JSON report saved to: ${outputPath}`);
  }
}

export class JUnitReporter implements Reporter {
  private outputDir: string;
  private allResults: { file: string; testFile: TestFile; results: TestResult[] }[] = [];

  constructor(outputDir: string) {
    this.outputDir = outputDir;
  }

  onTestFileComplete(file: string, testFile: TestFile, results: TestResult[]): void {
    this.allResults.push({ file, testFile, results });

    const passed = results.filter(r => r.status === 'passed').length;
    const failed = results.filter(r => r.status !== 'passed').length;
    console.log(`  ${passed} passed, ${failed} failed\n`);
  }

  onComplete(allResults: { file: string; results: TestResult[] }[]): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    const timestamp = getTimestamp();
    const outputPath = path.join(this.outputDir, `junit-${timestamp}.xml`);

    const totalTests = allResults.reduce((sum, r) => sum + r.results.length, 0);
    const failures = allResults.reduce(
      (sum, r) => sum + r.results.filter(t => t.status !== 'passed').length,
      0
    );
    const totalTime = allResults.reduce(
      (sum, r) => sum + r.results.reduce((s, t) => s + t.duration, 0),
      0
    ) / 1000;

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += `<testsuites tests="${totalTests}" failures="${failures}" time="${totalTime.toFixed(3)}">\n`;

    for (const { file, testFile, results } of this.allResults) {
      const suiteTests = results.length;
      const suiteFailures = results.filter(r => r.status !== 'passed').length;
      const suiteTime = results.reduce((s, t) => s + t.duration, 0) / 1000;

      xml += `  <testsuite name="${escapeXml(testFile.name)}" tests="${suiteTests}" failures="${suiteFailures}" time="${suiteTime.toFixed(3)}" file="${escapeXml(file)}">\n`;

      for (const result of results) {
        const testTime = result.duration / 1000;
        xml += `    <testcase name="${escapeXml(result.testName)}" classname="${escapeXml(testFile.name)}" time="${testTime.toFixed(3)}">\n`;

        if (result.status !== 'passed' && result.error) {
          xml += `      <failure message="${escapeXml(result.error.message)}">\n`;
          xml += `${escapeXml(result.error.stack || result.error.message)}\n`;
          xml += `      </failure>\n`;
        }

        xml += `    </testcase>\n`;
      }

      xml += `  </testsuite>\n`;
    }

    xml += '</testsuites>\n';

    fs.writeFileSync(outputPath, xml);
    console.log(`JUnit report saved to: ${outputPath}`);
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class HTMLReporter implements Reporter {
  private outputDir: string;
  private allResults: { file: string; testFile: TestFile; results: TestResult[] }[] = [];

  constructor(outputDir: string) {
    this.outputDir = outputDir;
  }

  onTestFileComplete(file: string, testFile: TestFile, results: TestResult[]): void {
    this.allResults.push({ file, testFile, results });

    const passed = results.filter(r => r.status === 'passed').length;
    const failed = results.filter(r => r.status !== 'passed').length;
    console.log(`  ${passed} passed, ${failed} failed\n`);
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
    const failed = allResults.reduce(
      (sum, r) => sum + r.results.filter(t => t.status !== 'passed').length,
      0
    );
    const totalDuration = allResults.reduce(
      (sum, r) => sum + r.results.reduce((s, t) => s + t.duration, 0),
      0
    );

    const html = generateHTMLReport({
      timestamp: new Date().toISOString(),
      summary: { totalTests, passed, failed, duration: totalDuration },
      testFiles: this.allResults,
    });

    fs.writeFileSync(outputPath, html);
    console.log(`HTML report saved to: ${outputPath}`);
  }
}

export interface ReportData {
  timestamp: string;
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    duration: number;
  };
  testFiles: { file: string; testFile: TestFile; results: TestResult[] }[];
}

export function generateHTMLReport(data: ReportData): string {
  const { timestamp, summary, testFiles } = data;
  const passRate = summary.totalTests > 0
    ? ((summary.passed / summary.totalTests) * 100).toFixed(1)
    : '0';

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TestBlocks Report - ${timestamp}</title>
  <style>
    :root {
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
    .test-case {
      padding: 12px 16px;
      border-bottom: 1px solid var(--color-border);
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .test-case:last-child { border-bottom: none; }
    .test-case.passed { border-left: 3px solid var(--color-passed); }
    .test-case.failed { border-left: 3px solid var(--color-failed); }
    .test-case.skipped { border-left: 3px solid var(--color-skipped); }
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
    .test-name { flex: 1; }
    .test-duration { color: var(--color-text-secondary); font-size: 14px; }
    .error-details {
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 4px;
      padding: 12px;
      margin: 8px 16px 12px 44px;
      font-family: monospace;
      font-size: 13px;
      white-space: pre-wrap;
      word-break: break-word;
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
      padding: 8px 16px 12px 44px;
    }
    .steps-list.open { display: block; }
    .step {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 0;
      font-size: 13px;
    }
    .step-icon { font-size: 10px; }
    .step-icon.passed { color: var(--color-passed); }
    .step-icon.failed { color: var(--color-failed); }
    .step-type { color: var(--color-text-secondary); }
    .step-duration { color: var(--color-text-secondary); font-size: 12px; }
    .screenshot {
      max-width: 100%;
      max-height: 300px;
      border: 1px solid var(--color-border);
      border-radius: 4px;
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>TestBlocks Test Report</h1>
    <div class="timestamp">Generated: ${new Date(timestamp).toLocaleString()}</div>

    <div class="summary">
      <div class="summary-card">
        <div class="value">${summary.totalTests}</div>
        <div class="label">Total Tests</div>
      </div>
      <div class="summary-card passed">
        <div class="value">${summary.passed}</div>
        <div class="label">Passed</div>
      </div>
      <div class="summary-card failed">
        <div class="value">${summary.failed}</div>
        <div class="label">Failed</div>
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
    const filePassed = results.filter(r => r.status === 'passed').length;
    const fileFailed = results.filter(r => r.status !== 'passed').length;

    html += `
    <div class="test-file">
      <div class="test-file-header">
        <span>${escapeHtml(testFile.name)}</span>
        <span class="test-file-path">${escapeHtml(file)} • ${filePassed} passed, ${fileFailed} failed</span>
      </div>
`;

    for (const result of results) {
      const statusIcon = result.status === 'passed' ? '✓' : result.status === 'failed' ? '✗' : '○';

      html += `
      <div class="test-case ${result.status}">
        <div class="status-icon ${result.status}">${statusIcon}</div>
        <div class="test-name">${escapeHtml(result.testName)}</div>
        <div class="test-duration">${result.duration}ms</div>
        <button class="steps-toggle" onclick="this.nextElementSibling.classList.toggle('open')">
          ${result.steps.length} steps
        </button>
      </div>
      <div class="steps-list">
`;

      for (const step of result.steps) {
        const stepIcon = step.status === 'passed' ? '✓' : '✗';
        html += `
        <div class="step">
          <span class="step-icon ${step.status}">${stepIcon}</span>
          <span class="step-type">${escapeHtml(step.stepType)}</span>
          <span class="step-duration">${step.duration}ms</span>
        </div>
`;
        if (step.screenshot) {
          html += `        <img class="screenshot" src="${step.screenshot}" alt="Screenshot at failure">\n`;
        }
      }

      html += `      </div>\n`;

      if (result.error) {
        html += `      <div class="error-details">${escapeHtml(result.error.message)}${result.error.stack ? '\n\n' + escapeHtml(result.error.stack) : ''}</div>\n`;
      }
    }

    html += `    </div>\n`;
  }

  html += `
  </div>
</body>
</html>`;

  return html;
}

export function generateJUnitXML(data: ReportData): string {
  const { testFiles } = data;

  const totalTests = testFiles.reduce((sum, f) => sum + f.results.length, 0);
  const failures = testFiles.reduce(
    (sum, f) => sum + f.results.filter(t => t.status !== 'passed').length,
    0
  );
  const totalTime = testFiles.reduce(
    (sum, f) => sum + f.results.reduce((s, t) => s + t.duration, 0),
    0
  ) / 1000;

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += `<testsuites tests="${totalTests}" failures="${failures}" time="${totalTime.toFixed(3)}">\n`;

  for (const { file, testFile, results } of testFiles) {
    const suiteTests = results.length;
    const suiteFailures = results.filter(r => r.status !== 'passed').length;
    const suiteTime = results.reduce((s, t) => s + t.duration, 0) / 1000;

    xml += `  <testsuite name="${escapeXml(testFile.name)}" tests="${suiteTests}" failures="${suiteFailures}" time="${suiteTime.toFixed(3)}" file="${escapeXml(file)}">\n`;

    for (const result of results) {
      const testTime = result.duration / 1000;
      xml += `    <testcase name="${escapeXml(result.testName)}" classname="${escapeXml(testFile.name)}" time="${testTime.toFixed(3)}">\n`;

      if (result.status !== 'passed' && result.error) {
        xml += `      <failure message="${escapeXml(result.error.message)}">\n`;
        xml += `${escapeXml(result.error.stack || result.error.message)}\n`;
        xml += `      </failure>\n`;
      }

      xml += `    </testcase>\n`;
    }

    xml += `  </testsuite>\n`;
  }

  xml += '</testsuites>\n';

  return xml;
}
