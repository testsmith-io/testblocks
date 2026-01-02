import { TestFile, TestStep } from '../../core';
import { FileNode } from '../components/FileTree';

export interface BlockMatch {
  id: string; // Unique identifier for this match
  filePath: string;
  fileName: string;
  testCaseName: string;
  testCaseId: string;
  location: 'steps' | 'beforeAll' | 'afterAll' | 'beforeEach' | 'afterEach' | 'testBeforeEach' | 'testAfterEach';
  startIndex: number;
  endIndex: number;
  matchedSteps: TestStep[];
}

/**
 * Check if two step sequences match structurally (same types in order)
 */
export function stepsMatch(source: TestStep[], target: TestStep[]): boolean {
  if (source.length !== target.length) return false;
  if (source.length === 0) return false;

  return source.every((step, i) => step.type === target[i].type);
}

/**
 * Find all occurrences of a step sequence within a larger step array
 */
function findSequenceMatches(
  steps: TestStep[],
  targetSequence: TestStep[],
  filePath: string,
  fileName: string,
  testCaseName: string,
  testCaseId: string,
  location: BlockMatch['location']
): BlockMatch[] {
  const matches: BlockMatch[] = [];
  const targetLength = targetSequence.length;

  if (targetLength === 0 || steps.length < targetLength) {
    return matches;
  }

  // Slide through the steps looking for matches
  for (let i = 0; i <= steps.length - targetLength; i++) {
    const slice = steps.slice(i, i + targetLength);
    if (stepsMatch(slice, targetSequence)) {
      matches.push({
        id: `${filePath}:${testCaseId}:${location}:${i}`,
        filePath,
        fileName,
        testCaseName,
        testCaseId,
        location,
        startIndex: i,
        endIndex: i + targetLength - 1,
        matchedSteps: slice,
      });
      // Skip past this match to avoid overlapping matches
      i += targetLength - 1;
    }
  }

  return matches;
}

/**
 * Scan a TestFile for matching step sequences
 */
function scanTestFile(
  testFile: TestFile,
  filePath: string,
  fileName: string,
  targetSequence: TestStep[]
): BlockMatch[] {
  const matches: BlockMatch[] = [];

  // Scan suite-level lifecycle hooks
  if (testFile.beforeAll) {
    matches.push(...findSequenceMatches(
      testFile.beforeAll,
      targetSequence,
      filePath,
      fileName,
      'beforeAll',
      'beforeAll',
      'beforeAll'
    ));
  }

  if (testFile.afterAll) {
    matches.push(...findSequenceMatches(
      testFile.afterAll,
      targetSequence,
      filePath,
      fileName,
      'afterAll',
      'afterAll',
      'afterAll'
    ));
  }

  if (testFile.beforeEach) {
    matches.push(...findSequenceMatches(
      testFile.beforeEach,
      targetSequence,
      filePath,
      fileName,
      'beforeEach',
      'beforeEach',
      'beforeEach'
    ));
  }

  if (testFile.afterEach) {
    matches.push(...findSequenceMatches(
      testFile.afterEach,
      targetSequence,
      filePath,
      fileName,
      'afterEach',
      'afterEach',
      'afterEach'
    ));
  }

  // Scan each test case
  for (const testCase of testFile.tests) {
    // Main test steps
    matches.push(...findSequenceMatches(
      testCase.steps,
      targetSequence,
      filePath,
      fileName,
      testCase.name,
      testCase.id,
      'steps'
    ));

    // Test-level beforeEach
    if (testCase.beforeEach) {
      matches.push(...findSequenceMatches(
        testCase.beforeEach,
        targetSequence,
        filePath,
        fileName,
        `${testCase.name} (beforeEach)`,
        testCase.id,
        'testBeforeEach'
      ));
    }

    // Test-level afterEach
    if (testCase.afterEach) {
      matches.push(...findSequenceMatches(
        testCase.afterEach,
        targetSequence,
        filePath,
        fileName,
        `${testCase.name} (afterEach)`,
        testCase.id,
        'testAfterEach'
      ));
    }
  }

  return matches;
}

/**
 * Recursively collect all file nodes from a FileNode tree
 */
function collectFileNodes(node: FileNode): FileNode[] {
  const files: FileNode[] = [];

  if (node.type === 'file' && node.testFile) {
    files.push(node);
  }

  if (node.children) {
    for (const child of node.children) {
      files.push(...collectFileNodes(child));
    }
  }

  return files;
}

/**
 * Scan the entire project for matching step sequences
 */
export function findMatchingSequences(
  targetSteps: TestStep[],
  projectRoot: FileNode | null,
  _currentFilePath?: string // Optional: exclude matches from current file's current location
): BlockMatch[] {
  if (!projectRoot || targetSteps.length === 0) {
    console.log('[findMatchingSequences] No projectRoot or empty targetSteps');
    return [];
  }

  const allMatches: BlockMatch[] = [];
  const fileNodes = collectFileNodes(projectRoot);

  console.log('[findMatchingSequences] Target steps:', targetSteps.map(s => s.type));
  console.log('[findMatchingSequences] Scanning', fileNodes.length, 'files');

  for (const fileNode of fileNodes) {
    if (!fileNode.testFile) continue;

    console.log('[findMatchingSequences] Scanning file:', fileNode.path);
    for (const test of fileNode.testFile.tests) {
      console.log('[findMatchingSequences]   Test:', test.name, '- steps:', test.steps.map(s => s.type));
    }

    const matches = scanTestFile(
      fileNode.testFile,
      fileNode.path,
      fileNode.name,
      targetSteps
    );

    console.log('[findMatchingSequences] Found', matches.length, 'matches in', fileNode.name);
    allMatches.push(...matches);
  }

  return allMatches;
}

/**
 * Group matches by file for display purposes
 */
export function groupMatchesByFile(matches: BlockMatch[]): Map<string, BlockMatch[]> {
  const grouped = new Map<string, BlockMatch[]>();

  for (const match of matches) {
    const existing = grouped.get(match.filePath) || [];
    existing.push(match);
    grouped.set(match.filePath, existing);
  }

  return grouped;
}

/**
 * Replace matched step sequences with a custom block step
 */
export function replaceMatchInSteps(
  steps: TestStep[],
  match: BlockMatch,
  customBlockType: string,
  params: Record<string, unknown>
): TestStep[] {
  const newSteps = [...steps];

  // Create the replacement custom block step
  const replacementStep: TestStep = {
    id: `${customBlockType}-${Date.now()}`,
    type: customBlockType,
    params,
  };

  // Replace the matched sequence with the single custom block
  newSteps.splice(match.startIndex, match.endIndex - match.startIndex + 1, replacementStep);

  return newSteps;
}

/**
 * Apply a match replacement to a TestFile
 */
export function applyMatchToTestFile(
  testFile: TestFile,
  match: BlockMatch,
  customBlockType: string,
  params: Record<string, unknown>
): TestFile {
  const updatedFile = { ...testFile };

  switch (match.location) {
    case 'beforeAll':
      if (updatedFile.beforeAll) {
        updatedFile.beforeAll = replaceMatchInSteps(updatedFile.beforeAll, match, customBlockType, params);
      }
      break;
    case 'afterAll':
      if (updatedFile.afterAll) {
        updatedFile.afterAll = replaceMatchInSteps(updatedFile.afterAll, match, customBlockType, params);
      }
      break;
    case 'beforeEach':
      if (updatedFile.beforeEach) {
        updatedFile.beforeEach = replaceMatchInSteps(updatedFile.beforeEach, match, customBlockType, params);
      }
      break;
    case 'afterEach':
      if (updatedFile.afterEach) {
        updatedFile.afterEach = replaceMatchInSteps(updatedFile.afterEach, match, customBlockType, params);
      }
      break;
    case 'steps':
    case 'testBeforeEach':
    case 'testAfterEach':
      updatedFile.tests = updatedFile.tests.map(test => {
        if (test.id !== match.testCaseId) return test;

        const updatedTest = { ...test };
        if (match.location === 'steps') {
          updatedTest.steps = replaceMatchInSteps(test.steps, match, customBlockType, params);
        } else if (match.location === 'testBeforeEach' && test.beforeEach) {
          updatedTest.beforeEach = replaceMatchInSteps(test.beforeEach, match, customBlockType, params);
        } else if (match.location === 'testAfterEach' && test.afterEach) {
          updatedTest.afterEach = replaceMatchInSteps(test.afterEach, match, customBlockType, params);
        }
        return updatedTest;
      });
      break;
  }

  return updatedFile;
}
