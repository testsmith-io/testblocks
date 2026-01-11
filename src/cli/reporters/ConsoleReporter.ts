import { TestFile, TestResult } from '../../core';
import { Reporter } from './types';

/**
 * Console reporter - outputs results to the terminal
 */
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
