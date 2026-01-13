import * as fs from 'fs';
import * as path from 'path';
import { TestFile, TestResult } from '../../core';
import { Reporter, ReportData } from './types';
import { getTimestamp, escapeXml } from './utils';

/**
 * JUnit XML reporter - outputs results in JUnit XML format
 */
export class JUnitReporter implements Reporter {
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
    const outputPath = path.join(this.outputDir, `junit-${timestamp}.xml`);

    const xml = generateJUnitXML({
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: allResults.reduce((sum, r) => sum + r.results.length, 0),
        passed: allResults.reduce(
          (sum, r) => sum + r.results.filter(t => t.status === 'passed').length,
          0
        ),
        failed: allResults.reduce(
          (sum, r) => sum + r.results.filter(t => t.status !== 'passed' && t.status !== 'skipped').length,
          0
        ),
        skipped: allResults.reduce(
          (sum, r) => sum + r.results.filter(t => t.status === 'skipped').length,
          0
        ),
        duration: allResults.reduce(
          (sum, r) => sum + r.results.reduce((s, t) => s + t.duration, 0),
          0
        ),
      },
      testFiles: this.allResults,
    });

    fs.writeFileSync(outputPath, xml);
    console.log(`JUnit report saved to: ${outputPath}`);
  }
}

/**
 * Generate JUnit XML from report data
 */
export function generateJUnitXML(data: ReportData): string {
  const { testFiles } = data;

  const totalTests = testFiles.reduce((sum, f) => sum + f.results.length, 0);
  const failures = testFiles.reduce(
    (sum, f) => sum + f.results.filter(t => t.status !== 'passed' && t.status !== 'skipped').length,
    0
  );
  const skipped = testFiles.reduce(
    (sum, f) => sum + f.results.filter(t => t.status === 'skipped').length,
    0
  );
  const totalTime = testFiles.reduce(
    (sum, f) => sum + f.results.reduce((s, t) => s + t.duration, 0),
    0
  ) / 1000;

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += `<testsuites tests="${totalTests}" failures="${failures}" skipped="${skipped}" time="${totalTime.toFixed(3)}">\n`;

  for (const { file, testFile, results } of testFiles) {
    const suiteTests = results.length;
    const suiteFailures = results.filter(r => r.status !== 'passed' && r.status !== 'skipped').length;
    const suiteSkipped = results.filter(r => r.status === 'skipped').length;
    const suiteTime = results.reduce((s, t) => s + t.duration, 0) / 1000;

    xml += `  <testsuite name="${escapeXml(testFile.name)}" tests="${suiteTests}" failures="${suiteFailures}" skipped="${suiteSkipped}" time="${suiteTime.toFixed(3)}" file="${escapeXml(file)}">\n`;

    for (const result of results) {
      const testTime = result.duration / 1000;
      xml += `    <testcase name="${escapeXml(result.testName)}" classname="${escapeXml(testFile.name)}" time="${testTime.toFixed(3)}">\n`;

      if (result.status === 'skipped') {
        const message = result.error?.message || 'Test skipped';
        xml += `      <skipped message="${escapeXml(message)}"/>\n`;
      } else if (result.status !== 'passed' && result.error) {
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
