import * as fs from 'fs';
import * as path from 'path';
import { TestFile, TestResult } from '../../core';
import { Reporter } from './types';
import { getTimestamp } from './utils';

/**
 * JSON reporter - outputs results to a JSON file
 */
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
