import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getTimestamp,
  generateHTMLReport,
  generateJUnitXML,
  ReportData,
  ConsoleReporter,
  JSONReporter,
  JUnitReporter,
  HTMLReporter,
} from '../../../src/cli/reporters';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module for reporter tests
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

describe('Reporters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTimestamp', () => {
    it('should return a formatted timestamp string', () => {
      const timestamp = getTimestamp();
      // Format: YYYY-MM-DDTHH-MM-SS
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/);
    });

    it('should not contain colons or dots', () => {
      const timestamp = getTimestamp();
      expect(timestamp).not.toContain(':');
      expect(timestamp).not.toContain('.');
    });
  });

  describe('generateJUnitXML', () => {
    it('should generate valid XML with test suites', () => {
      const data: ReportData = {
        timestamp: '2024-01-15T12:00:00.000Z',
        summary: {
          totalTests: 2,
          passed: 1,
          failed: 1,
          duration: 1500,
        },
        testFiles: [
          {
            file: 'test1.testblocks.json',
            testFile: { name: 'Test Suite 1', testCases: [] },
            results: [
              {
                testName: 'Test 1',
                status: 'passed',
                duration: 500,
                steps: [],
              },
              {
                testName: 'Test 2',
                status: 'failed',
                duration: 1000,
                steps: [],
                error: { message: 'Expected true but got false' },
              },
            ],
          },
        ],
      };

      const xml = generateJUnitXML(data);

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<testsuites');
      expect(xml).toContain('tests="2"');
      expect(xml).toContain('failures="1"');
      expect(xml).toContain('<testsuite name="Test Suite 1"');
      expect(xml).toContain('<testcase name="Test 1"');
      expect(xml).toContain('<testcase name="Test 2"');
      expect(xml).toContain('<failure message="Expected true but got false">');
      expect(xml).toContain('</testsuites>');
    });

    it('should escape XML special characters', () => {
      const data: ReportData = {
        timestamp: '2024-01-15T12:00:00.000Z',
        summary: { totalTests: 1, passed: 0, failed: 1, duration: 100 },
        testFiles: [
          {
            file: 'test.json',
            testFile: { name: 'Test <with> special & chars', testCases: [] },
            results: [
              {
                testName: 'Test "quotes" & <tags>',
                status: 'failed',
                duration: 100,
                steps: [],
                error: { message: 'Error: value < expected & value > minimum' },
              },
            ],
          },
        ],
      };

      const xml = generateJUnitXML(data);

      expect(xml).toContain('Test &lt;with&gt; special &amp; chars');
      expect(xml).toContain('Test &quot;quotes&quot; &amp; &lt;tags&gt;');
      expect(xml).toContain('value &lt; expected &amp; value &gt; minimum');
    });

    it('should calculate time in seconds', () => {
      const data: ReportData = {
        timestamp: '2024-01-15T12:00:00.000Z',
        summary: { totalTests: 1, passed: 1, failed: 0, duration: 1500 },
        testFiles: [
          {
            file: 'test.json',
            testFile: { name: 'Suite', testCases: [] },
            results: [
              { testName: 'Test', status: 'passed', duration: 1500, steps: [] },
            ],
          },
        ],
      };

      const xml = generateJUnitXML(data);

      // Duration should be in seconds (1500ms = 1.5s)
      expect(xml).toContain('time="1.500"');
    });

    it('should handle empty test files', () => {
      const data: ReportData = {
        timestamp: '2024-01-15T12:00:00.000Z',
        summary: { totalTests: 0, passed: 0, failed: 0, duration: 0 },
        testFiles: [],
      };

      const xml = generateJUnitXML(data);

      expect(xml).toContain('tests="0"');
      expect(xml).toContain('failures="0"');
    });
  });

  describe('generateHTMLReport', () => {
    it('should generate valid HTML with doctype', () => {
      const data: ReportData = {
        timestamp: '2024-01-15T12:00:00.000Z',
        summary: { totalTests: 1, passed: 1, failed: 0, duration: 500 },
        testFiles: [
          {
            file: 'test.json',
            testFile: { name: 'Test Suite', testCases: [] },
            results: [
              { testName: 'Test 1', status: 'passed', duration: 500, steps: [] },
            ],
          },
        ],
      };

      const html = generateHTMLReport(data);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('</html>');
    });

    it('should include summary statistics', () => {
      // Note: HTML report recalculates stats from testFiles, not from summary object
      const data: ReportData = {
        timestamp: '2024-01-15T12:00:00.000Z',
        summary: { totalTests: 10, passed: 8, failed: 2, duration: 5000 },
        testFiles: [
          {
            file: 'test1.json',
            testFile: { name: 'Suite1', testCases: [] },
            results: [
              { testName: 'Test 1', status: 'passed', duration: 500, steps: [] },
              { testName: 'Test 2', status: 'passed', duration: 500, steps: [] },
              { testName: 'Test 3', status: 'passed', duration: 500, steps: [] },
              { testName: 'Test 4', status: 'passed', duration: 500, steps: [] },
              { testName: 'Test 5', status: 'passed', duration: 500, steps: [] },
              { testName: 'Test 6', status: 'passed', duration: 500, steps: [] },
              { testName: 'Test 7', status: 'passed', duration: 500, steps: [] },
              { testName: 'Test 8', status: 'passed', duration: 500, steps: [] },
              { testName: 'Test 9', status: 'failed', duration: 500, steps: [] },
              { testName: 'Test 10', status: 'failed', duration: 500, steps: [] },
            ],
          },
        ],
      };

      const html = generateHTMLReport(data);

      expect(html).toContain('>10<'); // total tests
      expect(html).toContain('>8<'); // passed
      expect(html).toContain('>2<'); // failed
      expect(html).toContain('80.0%'); // pass rate
      expect(html).toContain('5.0s'); // duration
    });

    it('should include test results with status icons', () => {
      const data: ReportData = {
        timestamp: '2024-01-15T12:00:00.000Z',
        summary: { totalTests: 2, passed: 1, failed: 1, duration: 1000 },
        testFiles: [
          {
            file: 'test.json',
            testFile: { name: 'Suite', testCases: [] },
            results: [
              { testName: 'Passing Test', status: 'passed', duration: 500, steps: [] },
              {
                testName: 'Failing Test',
                status: 'failed',
                duration: 500,
                steps: [],
                error: { message: 'Test failed' },
              },
            ],
          },
        ],
      };

      const html = generateHTMLReport(data);

      expect(html).toContain('Passing Test');
      expect(html).toContain('Failing Test');
      expect(html).toContain('class="test-case passed"');
      expect(html).toContain('class="test-case failed"');
    });

    it('should escape HTML special characters', () => {
      const data: ReportData = {
        timestamp: '2024-01-15T12:00:00.000Z',
        summary: { totalTests: 1, passed: 0, failed: 1, duration: 100 },
        testFiles: [
          {
            file: 'test.json',
            testFile: { name: 'Test <script>alert("xss")</script>', testCases: [] },
            results: [
              {
                testName: 'Test with <tags>',
                status: 'failed',
                duration: 100,
                steps: [],
                error: { message: '<script>alert("xss")</script>' },
              },
            ],
          },
        ],
      };

      const html = generateHTMLReport(data);

      // Should escape HTML entities
      expect(html).not.toContain('<script>alert');
      expect(html).toContain('&lt;script&gt;');
    });

    it('should include step details', () => {
      const data: ReportData = {
        timestamp: '2024-01-15T12:00:00.000Z',
        summary: { totalTests: 1, passed: 1, failed: 0, duration: 1000 },
        testFiles: [
          {
            file: 'test.json',
            testFile: { name: 'Suite', testCases: [] },
            results: [
              {
                testName: 'Test',
                status: 'passed',
                duration: 1000,
                steps: [
                  { stepType: 'web_navigate', status: 'passed', duration: 500 },
                  { stepType: 'web_click', status: 'passed', duration: 500 },
                ],
              },
            ],
          },
        ],
      };

      const html = generateHTMLReport(data);

      // Step types are formatted (web_navigate -> Navigate, web_click -> Click)
      expect(html).toContain('Navigate');
      expect(html).toContain('Click');
      expect(html).toContain('2 steps');
    });

    it('should handle zero tests gracefully', () => {
      const data: ReportData = {
        timestamp: '2024-01-15T12:00:00.000Z',
        summary: { totalTests: 0, passed: 0, failed: 0, duration: 0 },
        testFiles: [],
      };

      const html = generateHTMLReport(data);

      expect(html).toContain('>0<'); // total tests
      expect(html).toContain('0%'); // pass rate (should handle division by zero)
    });

    it('should include error details for failed tests', () => {
      const data: ReportData = {
        timestamp: '2024-01-15T12:00:00.000Z',
        summary: { totalTests: 1, passed: 0, failed: 1, duration: 100 },
        testFiles: [
          {
            file: 'test.json',
            testFile: { name: 'Suite', testCases: [] },
            results: [
              {
                testName: 'Failing Test',
                status: 'failed',
                duration: 100,
                steps: [],
                error: {
                  message: 'Assertion failed',
                  stack: 'Error: Assertion failed\n    at Test.run (test.js:10:5)',
                },
              },
            ],
          },
        ],
      };

      const html = generateHTMLReport(data);

      expect(html).toContain('Assertion failed');
      expect(html).toContain('class="error-message"');
    });
  });

  describe('ConsoleReporter', () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should log test results', () => {
      const reporter = new ConsoleReporter();
      reporter.onTestFileComplete('test.json', { name: 'Suite', testCases: [] }, [
        { testName: 'Test 1', status: 'passed', duration: 100, steps: [] },
      ]);

      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should show summary on complete', () => {
      const reporter = new ConsoleReporter();
      reporter.onComplete([
        {
          file: 'test.json',
          results: [
            { testName: 'Test 1', status: 'passed', duration: 100, steps: [] },
            { testName: 'Test 2', status: 'failed', duration: 200, steps: [] },
          ],
        },
      ]);

      // Check that summary was logged
      const calls = consoleSpy.mock.calls.flat().join(' ');
      expect(calls).toContain('1 passed');
      expect(calls).toContain('1 failed');
      expect(calls).toContain('2 total');
    });
  });

  describe('JSONReporter', () => {
    beforeEach(() => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
    });

    it('should create output directory if it does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const reporter = new JSONReporter('./output');
      reporter.onTestFileComplete('test.json', { name: 'Suite', testCases: [] }, []);
      reporter.onComplete([{ file: 'test.json', results: [] }]);

      expect(fs.mkdirSync).toHaveBeenCalledWith('./output', { recursive: true });
    });

    it('should write JSON report file', () => {
      const reporter = new JSONReporter('./output');
      reporter.onTestFileComplete('test.json', { name: 'Suite', testCases: [] }, [
        { testName: 'Test', status: 'passed', duration: 100, steps: [] },
      ]);
      reporter.onComplete([{ file: 'test.json', results: [] }]);

      expect(fs.writeFileSync).toHaveBeenCalled();
      const [filePath, content] = vi.mocked(fs.writeFileSync).mock.calls[0];
      expect(filePath).toContain('output');
      expect(filePath).toContain('results-');
      expect(filePath).toContain('.json');

      const parsed = JSON.parse(content as string);
      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('summary');
      expect(parsed).toHaveProperty('testFiles');
    });
  });

  describe('JUnitReporter', () => {
    beforeEach(() => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
    });

    it('should write JUnit XML report file', () => {
      const reporter = new JUnitReporter('./output');
      reporter.onTestFileComplete('test.json', { name: 'Suite', testCases: [] }, [
        { testName: 'Test', status: 'passed', duration: 100, steps: [] },
      ]);
      reporter.onComplete([{ file: 'test.json', results: [] }]);

      expect(fs.writeFileSync).toHaveBeenCalled();
      const [filePath, content] = vi.mocked(fs.writeFileSync).mock.calls[0];
      expect(filePath).toContain('junit-');
      expect(filePath).toContain('.xml');
      expect(content).toContain('<?xml version="1.0"');
    });
  });

  describe('HTMLReporter', () => {
    beforeEach(() => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
    });

    it('should write HTML report file', () => {
      const reporter = new HTMLReporter('./output');
      reporter.onTestFileComplete('test.json', { name: 'Suite', testCases: [] }, [
        { testName: 'Test', status: 'passed', duration: 100, steps: [] },
      ]);
      reporter.onComplete([{ file: 'test.json', results: [] }]);

      expect(fs.writeFileSync).toHaveBeenCalled();
      const [filePath, content] = vi.mocked(fs.writeFileSync).mock.calls[0];
      expect(filePath).toContain('report-');
      expect(filePath).toContain('.html');
      expect(content).toContain('<!DOCTYPE html>');
    });
  });
});
