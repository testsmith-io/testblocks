/**
 * Playwright Codegen Parser
 *
 * Parses Playwright-generated JavaScript code and converts it to TestBlocks TestStep format.
 * Converts Playwright locators to CSS selectors where possible.
 */

import { TestStep } from '../core';

/**
 * Generate a unique step ID
 */
function generateStepId(): string {
  return `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Escape special characters for CSS attribute selectors
 */
function escapeCssAttributeValue(value: string): string {
  return value.replace(/"/g, '\\"');
}

/**
 * Result of extracting a selector, including type information
 */
interface SelectorResult {
  selector: string;
  selectorType?: 'testid' | 'css' | 'xpath' | 'text' | 'role' | 'label';
}

/**
 * Extract and convert Playwright selector to CSS/XPath where possible
 * For selectors that can't be converted to pure CSS, returns Playwright selector syntax
 * @param selectorCode - The Playwright selector code
 * @param testIdAttribute - The attribute used for test IDs (default: 'data-testid')
 */
function extractSelector(selectorCode: string, testIdAttribute: string = 'data-testid'): SelectorResult {
  // Handle locator('selector') - already CSS/XPath
  // Use backreference to match opening/closing quote (handles quotes inside selector)
  const locatorMatchSingle = selectorCode.match(/\.locator\('([^']*(?:''[^']*)*)'\)/);
  const locatorMatchDouble = selectorCode.match(/\.locator\("([^"]*(?:""[^"]*)*)"\)/);
  const locatorMatchBacktick = selectorCode.match(/\.locator\(`([^`]*(?:``[^`]*)*)`\)/);

  if (locatorMatchSingle) {
    return { selector: locatorMatchSingle[1], selectorType: 'css' };
  }
  if (locatorMatchDouble) {
    return { selector: locatorMatchDouble[1], selectorType: 'css' };
  }
  if (locatorMatchBacktick) {
    return { selector: locatorMatchBacktick[1], selectorType: 'css' };
  }

  // Handle getByTestId('testid') → store with testid: prefix
  const getByTestIdMatch = selectorCode.match(/\.getByTestId\(['"`]([^'"`]+)['"`]\)/);
  if (getByTestIdMatch) {
    // Use prefix convention so it survives Blockly serialization
    return { selector: `testid:${getByTestIdMatch[1]}`, selectorType: 'testid' };
  }

  // Handle getByPlaceholder('placeholder') → [placeholder="..."]
  const getByPlaceholderMatch = selectorCode.match(/\.getByPlaceholder\(['"`]([^'"`]+)['"`]\)/);
  if (getByPlaceholderMatch) {
    return { selector: `[placeholder="${escapeCssAttributeValue(getByPlaceholderMatch[1])}"]`, selectorType: 'css' };
  }

  // Handle getByAltText('alt') → [alt="..."]
  const getByAltTextMatch = selectorCode.match(/\.getByAltText\(['"`]([^'"`]+)['"`]\)/);
  if (getByAltTextMatch) {
    return { selector: `[alt="${escapeCssAttributeValue(getByAltTextMatch[1])}"]`, selectorType: 'css' };
  }

  // Handle getByTitle('title') → [title="..."]
  const getByTitleMatch = selectorCode.match(/\.getByTitle\(['"`]([^'"`]+)['"`]\)/);
  if (getByTitleMatch) {
    return { selector: `[title="${escapeCssAttributeValue(getByTitleMatch[1])}"]`, selectorType: 'css' };
  }

  // Handle getByRole('role', { name: 'text' }) - convert to CSS where possible
  const getByRoleMatch = selectorCode.match(/\.getByRole\(['"`]([^'"`]+)['"`](?:,\s*\{\s*name:\s*['"`]([^'"`]+)['"`](?:,\s*exact:\s*(true|false))?\s*\})?\)/);
  if (getByRoleMatch) {
    const role = getByRoleMatch[1];
    const name = getByRoleMatch[2];

    // Map common roles to HTML elements/selectors
    const roleToSelector: Record<string, string> = {
      'button': 'button, [role="button"], input[type="button"], input[type="submit"]',
      'link': 'a[href]',
      'textbox': 'input[type="text"], input:not([type]), textarea',
      'checkbox': 'input[type="checkbox"]',
      'radio': 'input[type="radio"]',
      'combobox': 'select',
      'listbox': 'select, [role="listbox"]',
      'heading': 'h1, h2, h3, h4, h5, h6',
      'img': 'img',
      'navigation': 'nav',
      'main': 'main',
      'banner': 'header',
      'contentinfo': 'footer',
    };

    if (roleToSelector[role] && name) {
      // For buttons/links with name, try to match by text content
      if (role === 'button') {
        return { selector: `button:has-text("${escapeCssAttributeValue(name)}"), input[type="submit"][value="${escapeCssAttributeValue(name)}"]`, selectorType: 'css' };
      } else if (role === 'link') {
        return { selector: `a:has-text("${escapeCssAttributeValue(name)}")`, selectorType: 'css' };
      }
    }

    // Fallback to Playwright's role selector (works with Playwright)
    if (name) {
      return { selector: `role=${role}[name="${escapeCssAttributeValue(name)}"]`, selectorType: 'role' };
    }
    return { selector: `role=${role}`, selectorType: 'role' };
  }

  // Handle getByText('text') - use Playwright text selector
  const getByTextMatch = selectorCode.match(/\.getByText\(['"`]([^'"`]+)['"`](?:,\s*\{\s*exact:\s*(true|false)\s*\})?\)/);
  if (getByTextMatch) {
    const text = getByTextMatch[1];
    const exact = getByTextMatch[2] === 'true';
    if (exact) {
      return { selector: `text="${escapeCssAttributeValue(text)}"`, selectorType: 'text' };
    }
    return { selector: `text=${text}`, selectorType: 'text' };
  }

  // Handle getByLabel('label') - try to convert to CSS for common patterns
  const getByLabelMatch = selectorCode.match(/\.getByLabel\(['"`]([^'"`]+)['"`]\)/);
  if (getByLabelMatch) {
    // Playwright label selector - works with Playwright
    return { selector: `label=${getByLabelMatch[1]}`, selectorType: 'label' };
  }

  // Handle chained .first(), .last(), .nth(n) - only if they exist
  const nthMatch = selectorCode.match(/\.nth\((\d+)\)/);
  const hasFirst = selectorCode.includes('.first()');
  const hasLast = selectorCode.includes('.last()');

  if (nthMatch || hasFirst || hasLast) {
    // Remove chaining methods to get base selector
    const baseCode = selectorCode
      .replace(/\.first\(\)/, '')
      .replace(/\.last\(\)/, '')
      .replace(/\.nth\(\d+\)/, '');

    // Only recurse if we actually removed something
    if (baseCode !== selectorCode) {
      const baseResult = extractSelector(baseCode, testIdAttribute);

      if (nthMatch) {
        const n = parseInt(nthMatch[1], 10);
        return { selector: `${baseResult.selector} >> nth=${n}`, selectorType: baseResult.selectorType };
      } else if (hasFirst) {
        return { selector: `${baseResult.selector} >> nth=0`, selectorType: baseResult.selectorType };
      } else if (hasLast) {
        return { selector: `${baseResult.selector} >> nth=-1`, selectorType: baseResult.selectorType };
      }
    }
  }

  // Fallback: try to extract selector from locator() if present
  // This handles cases like: locator('[data-test="value"]')
  const fallbackLocatorMatch = selectorCode.match(/locator\((['"`])([\s\S]*?)\1\)/);
  if (fallbackLocatorMatch) {
    return { selector: fallbackLocatorMatch[2], selectorType: 'css' };
  }

  // Last resort: return cleaned up code
  return {
    selector: selectorCode.replace(/^page\./, '').replace(/await\s+/, ''),
    selectorType: 'css',
  };
}

/**
 * Extract selector from expect() statement
 */
function extractExpectSelector(line: string, testIdAttribute: string = 'data-testid'): SelectorResult | null {
  // expect(page.locator(...))
  const locatorInExpect = line.match(/expect\(page\.locator\(['"`]([^'"`]+)['"`]\)\)/);
  if (locatorInExpect) {
    return { selector: locatorInExpect[1], selectorType: 'css' };
  }

  // expect(page.getBy*(...))
  const getByInExpect = line.match(/expect\((page\.[^)]+\))\)/);
  if (getByInExpect) {
    return extractSelector(getByInExpect[1], testIdAttribute);
  }

  return null;
}

/**
 * Parse a single line of Playwright code and convert to TestStep
 * @param line - The line of Playwright code
 * @param testIdAttribute - The attribute used for test IDs (default: 'data-testid')
 */
function parseLine(line: string, testIdAttribute: string = 'data-testid'): TestStep | null {
  const trimmed = line.trim();

  // Skip empty lines, comments, imports, exports, test structure
  if (!trimmed ||
      trimmed.startsWith('//') ||
      trimmed.startsWith('/*') ||
      trimmed.startsWith('*') ||
      trimmed.startsWith('import') ||
      trimmed.startsWith('export') ||
      trimmed.startsWith('const ') ||
      trimmed.startsWith('let ') ||
      trimmed.startsWith('var ') ||
      trimmed.startsWith('test(') ||
      trimmed.startsWith('test.describe') ||
      trimmed.startsWith('test.beforeEach') ||
      trimmed.startsWith('test.afterEach') ||
      trimmed === '});' ||
      trimmed === '});' ||
      trimmed === '{' ||
      trimmed === '}' ||
      trimmed === '});') {
    return null;
  }

  // ===== ASSERTIONS =====

  // expect(page.locator(...)).toBeVisible()
  if (trimmed.includes('.toBeVisible()')) {
    const result = extractExpectSelector(trimmed, testIdAttribute);
    if (result) {
      return {
        id: generateStepId(),
        type: 'web_assert_visible',
        params: {
          SELECTOR: result.selector,
          ...(result.selectorType && { SELECTOR_TYPE: result.selectorType }),
        },
      };
    }
  }

  // expect(page.locator(...)).toBeHidden() or .not.toBeVisible()
  if (trimmed.includes('.toBeHidden()') || trimmed.includes('.not.toBeVisible()')) {
    const result = extractExpectSelector(trimmed, testIdAttribute);
    if (result) {
      return {
        id: generateStepId(),
        type: 'web_assert_not_visible',
        params: {
          SELECTOR: result.selector,
          ...(result.selectorType && { SELECTOR_TYPE: result.selectorType }),
        },
      };
    }
  }

  // expect(page.locator(...)).toContainText('text')
  const containTextMatch = trimmed.match(/\.toContainText\(['"`]([^'"`]+)['"`]\)/);
  if (containTextMatch) {
    const result = extractExpectSelector(trimmed, testIdAttribute);
    if (result) {
      return {
        id: generateStepId(),
        type: 'web_assert_text_contains',
        params: {
          SELECTOR: result.selector,
          ...(result.selectorType && { SELECTOR_TYPE: result.selectorType }),
          TEXT: containTextMatch[1],
        },
      };
    }
  }

  // expect(page.locator(...)).toHaveText('text')
  const haveTextMatch = trimmed.match(/\.toHaveText\(['"`]([^'"`]+)['"`]\)/);
  if (haveTextMatch) {
    const result = extractExpectSelector(trimmed, testIdAttribute);
    if (result) {
      return {
        id: generateStepId(),
        type: 'web_assert_text_equals',
        params: {
          SELECTOR: result.selector,
          ...(result.selectorType && { SELECTOR_TYPE: result.selectorType }),
          TEXT: haveTextMatch[1],
        },
      };
    }
  }

  // expect(page).toHaveURL('url') or toHaveURL(/regex/)
  const haveURLMatch = trimmed.match(/expect\(page\)\.toHaveURL\(['"`]([^'"`]+)['"`]\)/);
  if (haveURLMatch) {
    return {
      id: generateStepId(),
      type: 'web_assert_url_contains',
      params: {
        TEXT: haveURLMatch[1],
      },
    };
  }

  // expect(page).toHaveTitle('title')
  const haveTitleMatch = trimmed.match(/expect\(page\)\.toHaveTitle\(['"`]([^'"`]+)['"`]\)/);
  if (haveTitleMatch) {
    return {
      id: generateStepId(),
      type: 'web_assert_title_contains',
      params: {
        TEXT: haveTitleMatch[1],
      },
    };
  }

  // expect(page.locator(...)).toBeEnabled()
  if (trimmed.includes('.toBeEnabled()')) {
    const result = extractExpectSelector(trimmed, testIdAttribute);
    if (result) {
      return {
        id: generateStepId(),
        type: 'web_assert_enabled',
        params: {
          SELECTOR: result.selector,
          ...(result.selectorType && { SELECTOR_TYPE: result.selectorType }),
        },
      };
    }
  }

  // expect(page.locator(...)).toBeChecked()
  if (trimmed.includes('.toBeChecked()')) {
    const result = extractExpectSelector(trimmed, testIdAttribute);
    if (result) {
      return {
        id: generateStepId(),
        type: 'web_assert_checked',
        params: {
          SELECTOR: result.selector,
          ...(result.selectorType && { SELECTOR_TYPE: result.selectorType }),
          CHECKED: true,
        },
      };
    }
  }

  // expect(page.locator(...)).not.toBeChecked()
  if (trimmed.includes('.not.toBeChecked()')) {
    const result = extractExpectSelector(trimmed, testIdAttribute);
    if (result) {
      return {
        id: generateStepId(),
        type: 'web_assert_checked',
        params: {
          SELECTOR: result.selector,
          ...(result.selectorType && { SELECTOR_TYPE: result.selectorType }),
          CHECKED: false,
        },
      };
    }
  }

  // ===== ACTIONS =====

  // page.goto('url')
  const gotoMatch = trimmed.match(/await\s+page\.goto\(['"`]([^'"`]+)['"`]/);
  if (gotoMatch) {
    return {
      id: generateStepId(),
      type: 'web_navigate',
      params: {
        URL: gotoMatch[1],
        WAIT_UNTIL: 'load',
      },
    };
  }

  // page.locator(...).click() or page.getBy*(...).click()
  if (trimmed.includes('.click(') && !trimmed.includes('expect(')) {
    const selectorPart = trimmed.replace(/await\s+/, '').replace(/\.click\([^)]*\).*$/, '');
    const result = extractSelector(selectorPart, testIdAttribute);
    return {
      id: generateStepId(),
      type: 'web_click',
      params: {
        SELECTOR: result.selector,
        ...(result.selectorType && { SELECTOR_TYPE: result.selectorType }),
        TIMEOUT: 30000,
      },
    };
  }

  // page.locator(...).dblclick()
  if (trimmed.includes('.dblclick(')) {
    const selectorPart = trimmed.replace(/await\s+/, '').replace(/\.dblclick\([^)]*\).*$/, '');
    const result = extractSelector(selectorPart, testIdAttribute);
    return {
      id: generateStepId(),
      type: 'web_click',
      params: {
        SELECTOR: result.selector,
        ...(result.selectorType && { SELECTOR_TYPE: result.selectorType }),
        TIMEOUT: 30000,
        // Note: TestBlocks may not support double-click, this is a single click fallback
      },
    };
  }

  // page.locator(...).fill('value') or page.getBy*(...).fill('value')
  const fillMatch = trimmed.match(/\.fill\(['"`]([^'"`]*)['"`]\)/);
  if (fillMatch) {
    const selectorPart = trimmed.replace(/await\s+/, '').replace(/\.fill\([^)]*\).*$/, '');
    const result = extractSelector(selectorPart, testIdAttribute);
    return {
      id: generateStepId(),
      type: 'web_fill',
      params: {
        SELECTOR: result.selector,
        ...(result.selectorType && { SELECTOR_TYPE: result.selectorType }),
        VALUE: fillMatch[1],
      },
    };
  }

  // page.locator(...).type('text') or .pressSequentially('text')
  const typeMatch = trimmed.match(/\.(type|pressSequentially)\(['"`]([^'"`]*)['"`]/);
  if (typeMatch) {
    const selectorPart = trimmed.replace(/await\s+/, '').replace(/\.(type|pressSequentially)\([^)]*\).*$/, '');
    const result = extractSelector(selectorPart, testIdAttribute);
    return {
      id: generateStepId(),
      type: 'web_type',
      params: {
        SELECTOR: result.selector,
        ...(result.selectorType && { SELECTOR_TYPE: result.selectorType }),
        TEXT: typeMatch[2],
        DELAY: 50,
      },
    };
  }

  // page.locator(...).clear()
  if (trimmed.includes('.clear()')) {
    const selectorPart = trimmed.replace(/await\s+/, '').replace(/\.clear\(\).*$/, '');
    const result = extractSelector(selectorPart, testIdAttribute);
    return {
      id: generateStepId(),
      type: 'web_fill',
      params: {
        SELECTOR: result.selector,
        ...(result.selectorType && { SELECTOR_TYPE: result.selectorType }),
        VALUE: '',
      },
    };
  }

  // page.locator(...).check()
  if (trimmed.includes('.check()') && !trimmed.includes('toBeChecked')) {
    const selectorPart = trimmed.replace(/await\s+/, '').replace(/\.check\(\).*$/, '');
    const result = extractSelector(selectorPart, testIdAttribute);
    return {
      id: generateStepId(),
      type: 'web_checkbox',
      params: {
        SELECTOR: result.selector,
        ...(result.selectorType && { SELECTOR_TYPE: result.selectorType }),
        ACTION: 'check',
      },
    };
  }

  // page.locator(...).uncheck()
  if (trimmed.includes('.uncheck()')) {
    const selectorPart = trimmed.replace(/await\s+/, '').replace(/\.uncheck\(\).*$/, '');
    const result = extractSelector(selectorPart, testIdAttribute);
    return {
      id: generateStepId(),
      type: 'web_checkbox',
      params: {
        SELECTOR: result.selector,
        ...(result.selectorType && { SELECTOR_TYPE: result.selectorType }),
        ACTION: 'uncheck',
      },
    };
  }

  // page.locator(...).hover()
  if (trimmed.includes('.hover()')) {
    const selectorPart = trimmed.replace(/await\s+/, '').replace(/\.hover\(\).*$/, '');
    const result = extractSelector(selectorPart, testIdAttribute);
    return {
      id: generateStepId(),
      type: 'web_hover',
      params: {
        SELECTOR: result.selector,
        ...(result.selectorType && { SELECTOR_TYPE: result.selectorType }),
      },
    };
  }

  // page.locator(...).selectOption('value') or selectOption(['value1', 'value2'])
  const selectMatch = trimmed.match(/\.selectOption\(['"`]([^'"`]*)['"`]\)/);
  if (selectMatch) {
    const selectorPart = trimmed.replace(/await\s+/, '').replace(/\.selectOption\([^)]*\).*$/, '');
    const result = extractSelector(selectorPart, testIdAttribute);
    return {
      id: generateStepId(),
      type: 'web_select',
      params: {
        SELECTOR: result.selector,
        ...(result.selectorType && { SELECTOR_TYPE: result.selectorType }),
        VALUE: selectMatch[1],
      },
    };
  }

  // page.locator(...).press('key') or page.keyboard.press('key')
  const pressMatch = trimmed.match(/\.press\(['"`]([^'"`]+)['"`]\)/);
  if (pressMatch) {
    if (trimmed.includes('.keyboard.')) {
      return {
        id: generateStepId(),
        type: 'web_press_key',
        params: {
          KEY: pressMatch[1],
        },
      };
    } else {
      const selectorPart = trimmed.replace(/await\s+/, '').replace(/\.press\([^)]*\).*$/, '');
      const result = extractSelector(selectorPart, testIdAttribute);
      return {
        id: generateStepId(),
        type: 'web_press_key',
        params: {
          SELECTOR: result.selector,
          ...(result.selectorType && { SELECTOR_TYPE: result.selectorType }),
          KEY: pressMatch[1],
        },
      };
    }
  }

  // page.locator(...).focus()
  if (trimmed.includes('.focus()')) {
    const selectorPart = trimmed.replace(/await\s+/, '').replace(/\.focus\(\).*$/, '');
    const result = extractSelector(selectorPart, testIdAttribute);
    // Focus isn't a direct TestBlocks action, use click instead
    return {
      id: generateStepId(),
      type: 'web_click',
      params: {
        SELECTOR: result.selector,
        ...(result.selectorType && { SELECTOR_TYPE: result.selectorType }),
        TIMEOUT: 30000,
      },
    };
  }

  // page.waitForSelector('selector') or page.locator(...).waitFor()
  if (trimmed.includes('.waitFor(') || trimmed.includes('.waitForSelector(')) {
    const waitForSelectorMatch = trimmed.match(/\.waitForSelector\(['"`]([^'"`]+)['"`]/);
    if (waitForSelectorMatch) {
      return {
        id: generateStepId(),
        type: 'web_wait_for_element',
        params: {
          SELECTOR: waitForSelectorMatch[1],
          SELECTOR_TYPE: 'css',
          STATE: 'visible',
          TIMEOUT: 30000,
        },
      };
    }
    // locator().waitFor()
    const selectorPart = trimmed.replace(/await\s+/, '').replace(/\.waitFor\([^)]*\).*$/, '');
    const result = extractSelector(selectorPart, testIdAttribute);
    if (result.selector !== selectorPart) {
      return {
        id: generateStepId(),
        type: 'web_wait_for_element',
        params: {
          SELECTOR: result.selector,
          ...(result.selectorType && { SELECTOR_TYPE: result.selectorType }),
          STATE: 'visible',
          TIMEOUT: 30000,
        },
      };
    }
  }

  // page.waitForTimeout(ms)
  const waitTimeoutMatch = trimmed.match(/\.waitForTimeout\((\d+)\)/);
  if (waitTimeoutMatch) {
    return {
      id: generateStepId(),
      type: 'web_wait',
      params: {
        DURATION: parseInt(waitTimeoutMatch[1], 10),
      },
    };
  }

  // page.waitForURL('url')
  const waitForURLMatch = trimmed.match(/\.waitForURL\(['"`]([^'"`]+)['"`]/);
  if (waitForURLMatch) {
    return {
      id: generateStepId(),
      type: 'web_wait_for_url',
      params: {
        URL: waitForURLMatch[1],
        TIMEOUT: 30000,
      },
    };
  }

  // page.screenshot()
  if (trimmed.includes('.screenshot(')) {
    const pathMatch = trimmed.match(/path:\s*['"`]([^'"`]+)['"`]/);
    return {
      id: generateStepId(),
      type: 'web_screenshot',
      params: {
        PATH: pathMatch ? pathMatch[1] : 'screenshot.png',
      },
    };
  }

  // Unrecognized line - skip it
  return null;
}

/**
 * Parse Playwright-generated code and convert to TestBlocks TestStep array
 * @param code - The Playwright-generated code
 * @param testIdAttribute - The attribute used for test IDs (default: 'data-testid')
 */
export function parsePlaywrightCode(code: string, testIdAttribute: string = 'data-testid'): TestStep[] {
  const lines = code.split('\n');
  const steps: TestStep[] = [];

  for (const line of lines) {
    const step = parseLine(line, testIdAttribute);
    if (step) {
      steps.push(step);
    }
  }

  return steps;
}

/**
 * Check if the code looks like valid Playwright test code
 */
export function isValidPlaywrightCode(code: string): boolean {
  return code.includes('page.') || code.includes('await ') || code.includes('expect(');
}
