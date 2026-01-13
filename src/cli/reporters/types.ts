import { TestFile, TestResult } from '../../core';

/**
 * Reporter interface - all reporters must implement this
 */
export interface Reporter {
  onTestFileComplete(file: string, testFile: TestFile, results: TestResult[]): void;
  onComplete(allResults: { file: string; results: TestResult[] }[]): void;
}

/**
 * Report data structure for HTML/JSON reports
 */
export interface ReportData {
  timestamp: string;
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
  };
  testFiles: { file: string; testFile: TestFile; results: TestResult[] }[];
}
