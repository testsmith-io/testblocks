import { BlockDefinition, ExecutionContext } from '../types';

// Import Playwright's expect for assertions with auto-waiting
// We use dynamic import with string concatenation to prevent Vite from
// trying to bundle the playwright package (which is Node.js-only)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let playwrightExpect: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getExpect(): Promise<any> {
  if (!playwrightExpect) {
    // Use string concatenation to hide import from Vite's static analysis
    const moduleName = '@playwright' + '/test';
    const { expect } = await import(/* @vite-ignore */ moduleName);
    playwrightExpect = expect;
  }
  return playwrightExpect;
}

// Type definitions for Playwright (we'll use dynamic import at runtime)
interface PlaywrightLocator {
  click(options?: { timeout?: number }): Promise<void>;
  fill(value: string): Promise<void>;
  type(text: string, options?: { delay?: number }): Promise<void>;
  selectOption(values: string | string[]): Promise<string[]>;
  check(): Promise<void>;
  uncheck(): Promise<void>;
  hover(): Promise<void>;
  focus(): Promise<void>;
  press(key: string): Promise<void>;
  textContent(): Promise<string | null>;
  getAttribute(name: string): Promise<string | null>;
  inputValue(): Promise<string>;
  isVisible(): Promise<boolean>;
  isEnabled(): Promise<boolean>;
  isChecked(): Promise<boolean>;
}

interface PlaywrightPage {
  goto(url: string, options?: { waitUntil?: string }): Promise<unknown>;
  click(selector: string, options?: { timeout?: number }): Promise<void>;
  fill(selector: string, value: string): Promise<void>;
  type(selector: string, text: string, options?: { delay?: number }): Promise<void>;
  selectOption(selector: string, values: string | string[]): Promise<string[]>;
  check(selector: string): Promise<void>;
  uncheck(selector: string): Promise<void>;
  waitForSelector(selector: string, options?: { state?: string; timeout?: number }): Promise<unknown>;
  waitForTimeout(timeout: number): Promise<void>;
  waitForURL(url: string | RegExp, options?: { timeout?: number }): Promise<void>;
  screenshot(options?: { path?: string; fullPage?: boolean }): Promise<Buffer>;
  textContent(selector: string): Promise<string | null>;
  getAttribute(selector: string, name: string): Promise<string | null>;
  inputValue(selector: string): Promise<string>;
  isVisible(selector: string): Promise<boolean>;
  isEnabled(selector: string): Promise<boolean>;
  isChecked(selector: string): Promise<boolean>;
  evaluate<T>(fn: () => T): Promise<T>;
  locator(selector: string): PlaywrightLocator;
  title(): Promise<string>;
  url(): string;
  press(selector: string, key: string): Promise<void>;
  hover(selector: string): Promise<void>;
  focus(selector: string): Promise<void>;
}

// Playwright Web Testing Blocks
export const playwrightBlocks: BlockDefinition[] = [
  // Navigate to URL
  {
    type: 'web_navigate',
    category: 'Web',
    color: '#E91E63',
    tooltip: 'Navigate to a URL',
    inputs: [
      { name: 'URL', type: 'field', fieldType: 'text', required: true },
      { name: 'WAIT_UNTIL', type: 'field', fieldType: 'dropdown', options: [['Load', 'load'], ['DOM Content Loaded', 'domcontentloaded'], ['Network Idle', 'networkidle']], default: 'load' },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      const page = context.page as PlaywrightPage;
      const url = resolveVariables(params.URL as string, context);
      const waitUntil = params.WAIT_UNTIL as string;

      context.logger.info(`Navigating to ${url}`);
      await page.goto(url, { waitUntil });
      return {
        _summary: url,
        url,
        waitUntil,
      };
    },
  },

  // Click Element
  {
    type: 'web_click',
    category: 'Web',
    color: '#E91E63',
    tooltip: 'Click on an element',
    inputs: [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
      { name: 'TIMEOUT', type: 'field', fieldType: 'number', default: 30000 },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      const page = context.page as PlaywrightPage;
      const selector = resolveSelector(params, context);
      const timeout = params.TIMEOUT as number;

      context.logger.info(`Clicking: ${selector}`);
      await page.click(selector, { timeout });
      return {
        _summary: params.SELECTOR as string,
        selector,
      };
    },
  },

  // Fill Input
  {
    type: 'web_fill',
    category: 'Web',
    color: '#E91E63',
    tooltip: 'Fill an input field (clears existing value)',
    inputs: [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
      { name: 'VALUE', type: 'field', fieldType: 'text', required: true },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      const page = context.page as PlaywrightPage;
      const selector = resolveSelector(params, context);
      const value = resolveVariables(params.VALUE as string, context);

      context.logger.info(`Filling ${selector} with "${value}"`);
      await page.fill(selector, value);
      const displayValue = value.length > 30 ? value.substring(0, 30) + '...' : value;
      return {
        _summary: `${params.SELECTOR} = "${displayValue}"`,
        selector,
        value,
      };
    },
  },

  // Type Text
  {
    type: 'web_type',
    category: 'Web',
    color: '#E91E63',
    tooltip: 'Type text character by character',
    inputs: [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
      { name: 'TEXT', type: 'field', fieldType: 'text', required: true },
      { name: 'DELAY', type: 'field', fieldType: 'number', default: 50 },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      const page = context.page as PlaywrightPage;
      const selector = resolveSelector(params, context);
      const text = resolveVariables(params.TEXT as string, context);
      const delay = params.DELAY as number;

      context.logger.info(`Typing "${text}" into ${selector}`);
      await page.type(selector, text, { delay });
      const displayText = text.length > 30 ? text.substring(0, 30) + '...' : text;
      return {
        _summary: `${params.SELECTOR} = "${displayText}"`,
        selector,
        text,
        delay,
      };
    },
  },

  // Press Key
  {
    type: 'web_press_key',
    category: 'Web',
    color: '#E91E63',
    tooltip: 'Press a keyboard key',
    inputs: [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
      { name: 'KEY', type: 'field', fieldType: 'dropdown', options: [['Enter', 'Enter'], ['Tab', 'Tab'], ['Escape', 'Escape'], ['Backspace', 'Backspace'], ['ArrowUp', 'ArrowUp'], ['ArrowDown', 'ArrowDown'], ['ArrowLeft', 'ArrowLeft'], ['ArrowRight', 'ArrowRight']] },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      const page = context.page as PlaywrightPage;
      const selector = resolveSelector(params, context);
      const key = params.KEY as string;

      context.logger.info(`Pressing ${key} on ${selector}`);
      await page.press(selector, key);
      return {
        _summary: `${key} on ${params.SELECTOR}`,
        selector,
        key,
      };
    },
  },

  // Select Option
  {
    type: 'web_select',
    category: 'Web',
    color: '#E91E63',
    tooltip: 'Select an option from a dropdown',
    inputs: [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
      { name: 'VALUE', type: 'field', fieldType: 'text', required: true },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      const page = context.page as PlaywrightPage;
      const selector = resolveSelector(params, context);
      const value = resolveVariables(params.VALUE as string, context);

      context.logger.info(`Selecting "${value}" in ${selector}`);
      await page.selectOption(selector, value);
      return {
        _summary: `${params.SELECTOR} = "${value}"`,
        selector,
        value,
      };
    },
  },

  // Check/Uncheck Checkbox
  {
    type: 'web_checkbox',
    category: 'Web',
    color: '#E91E63',
    tooltip: 'Check or uncheck a checkbox',
    inputs: [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
      { name: 'ACTION', type: 'field', fieldType: 'dropdown', options: [['Check', 'check'], ['Uncheck', 'uncheck']] },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      const page = context.page as PlaywrightPage;
      const selector = resolveSelector(params, context);
      const action = params.ACTION as string;

      context.logger.info(`${action === 'check' ? 'Checking' : 'Unchecking'} ${selector}`);
      if (action === 'check') {
        await page.check(selector);
      } else {
        await page.uncheck(selector);
      }
      return {
        _summary: `${action} ${params.SELECTOR}`,
        selector,
        action,
      };
    },
  },

  // Hover
  {
    type: 'web_hover',
    category: 'Web',
    color: '#E91E63',
    tooltip: 'Hover over an element',
    inputs: [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      const page = context.page as PlaywrightPage;
      const selector = resolveSelector(params, context);

      context.logger.info(`Hovering over ${selector}`);
      await page.hover(selector);
      return {
        _summary: params.SELECTOR as string,
        selector,
      };
    },
  },

  // Wait for Element
  {
    type: 'web_wait_for_element',
    category: 'Web',
    color: '#9C27B0',
    tooltip: 'Wait for an element to appear/disappear',
    inputs: [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
      { name: 'STATE', type: 'field', fieldType: 'dropdown', options: [['Visible', 'visible'], ['Hidden', 'hidden'], ['Attached', 'attached'], ['Detached', 'detached']] },
      { name: 'TIMEOUT', type: 'field', fieldType: 'number', default: 30000 },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      const page = context.page as PlaywrightPage;
      const selector = resolveSelector(params, context);
      const state = params.STATE as string;
      const timeout = params.TIMEOUT as number;

      context.logger.info(`Waiting for ${selector} to be ${state}`);
      await page.waitForSelector(selector, { state, timeout });
      return {
        _summary: `${params.SELECTOR} is ${state}`,
        selector,
        state,
      };
    },
  },

  // Wait for URL
  {
    type: 'web_wait_for_url',
    category: 'Web',
    color: '#9C27B0',
    tooltip: 'Wait for URL to match',
    inputs: [
      { name: 'URL', type: 'field', fieldType: 'text', required: true },
      { name: 'TIMEOUT', type: 'field', fieldType: 'number', default: 30000 },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      const page = context.page as PlaywrightPage;
      const url = resolveVariables(params.URL as string, context);
      const timeout = params.TIMEOUT as number;

      context.logger.info(`Waiting for URL to match: ${url}`);
      await page.waitForURL(url, { timeout });
      return {
        _summary: url,
        url,
      };
    },
  },

  // Wait (pause)
  {
    type: 'web_wait',
    category: 'Web',
    color: '#9C27B0',
    tooltip: 'Wait for a specified time',
    inputs: [
      { name: 'MILLISECONDS', type: 'field', fieldType: 'number', default: 1000 },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      const page = context.page as PlaywrightPage;
      const ms = params.MILLISECONDS as number;

      context.logger.info(`Waiting ${ms}ms`);
      await page.waitForTimeout(ms);
      return {
        _summary: `${ms}ms`,
        milliseconds: ms,
      };
    },
  },

  // Take Screenshot
  {
    type: 'web_screenshot',
    category: 'Web',
    color: '#607D8B',
    tooltip: 'Take a screenshot',
    inputs: [
      { name: 'NAME', type: 'field', fieldType: 'text', default: 'screenshot' },
      { name: 'FULL_PAGE', type: 'field', fieldType: 'checkbox', default: false },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      const page = context.page as PlaywrightPage;
      const name = params.NAME as string;
      const fullPage = params.FULL_PAGE as boolean;

      context.logger.info(`Taking screenshot: ${name}`);
      const buffer = await page.screenshot({ fullPage });
      return {
        _summary: `${name}${fullPage ? ' (full page)' : ''}`,
        name,
        fullPage,
        buffer: buffer.toString('base64'),
      };
    },
  },

  // Get Text Content
  {
    type: 'web_get_text',
    category: 'Web',
    color: '#2196F3',
    tooltip: 'Get text content of an element',
    inputs: [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
    ],
    output: { type: 'String' },
    execute: async (params, context) => {
      const page = context.page as PlaywrightPage;
      const selector = resolveSelector(params, context);

      const text = await page.textContent(selector);
      context.logger.debug(`Text content of ${selector}: "${text}"`);
      const displayText = text && text.length > 40 ? text.substring(0, 40) + '...' : text;
      return {
        _summary: `"${displayText}"`,
        _value: text,
        selector,
        text,
      };
    },
  },

  // Get Attribute
  {
    type: 'web_get_attribute',
    category: 'Web',
    color: '#2196F3',
    tooltip: 'Get attribute value of an element',
    inputs: [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
      { name: 'ATTRIBUTE', type: 'field', fieldType: 'text', required: true },
    ],
    output: { type: 'String' },
    execute: async (params, context) => {
      const page = context.page as PlaywrightPage;
      const selector = resolveSelector(params, context);
      const attribute = params.ATTRIBUTE as string;

      const value = await page.getAttribute(selector, attribute);
      context.logger.debug(`Attribute ${attribute} of ${selector}: "${value}"`);
      return {
        _summary: `${attribute} = "${value}"`,
        _value: value,
        selector,
        attribute,
        value,
      };
    },
  },

  // Get Input Value
  {
    type: 'web_get_input_value',
    category: 'Web',
    color: '#2196F3',
    tooltip: 'Get current value of an input field',
    inputs: [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
    ],
    output: { type: 'String' },
    execute: async (params, context) => {
      const page = context.page as PlaywrightPage;
      const selector = resolveSelector(params, context);

      const value = await page.inputValue(selector);
      context.logger.debug(`Input value of ${selector}: "${value}"`);
      const displayValue = value.length > 40 ? value.substring(0, 40) + '...' : value;
      return {
        _summary: `"${displayValue}"`,
        _value: value,
        selector,
        value,
      };
    },
  },

  // Get Page Title
  {
    type: 'web_get_title',
    category: 'Web',
    color: '#2196F3',
    tooltip: 'Get the page title',
    inputs: [],
    output: { type: 'String' },
    execute: async (params, context) => {
      const page = context.page as PlaywrightPage;

      const title = await page.title();
      context.logger.debug(`Page title: "${title}"`);
      return {
        _summary: `"${title}"`,
        _value: title,
        title,
      };
    },
  },

  // Get Current URL
  {
    type: 'web_get_url',
    category: 'Web',
    color: '#2196F3',
    tooltip: 'Get the current URL',
    inputs: [],
    output: { type: 'String' },
    execute: async (params, context) => {
      const page = context.page as PlaywrightPage;

      const url = page.url();
      context.logger.debug(`Current URL: "${url}"`);
      return {
        _summary: url,
        _value: url,
        url,
      };
    },
  },

  // Assert Element Visible
  {
    type: 'web_assert_visible',
    category: 'Web',
    color: '#FF9800',
    tooltip: 'Assert that an element is visible (auto-waits)',
    inputs: [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
      { name: 'TIMEOUT', type: 'field', fieldType: 'number', default: 30000 },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      const page = context.page as PlaywrightPage;
      const selector = resolveSelector(params, context);
      const displaySelector = getDisplaySelector(params, context);
      const timeout = params.TIMEOUT as number;

      const expect = await getExpect();
      const locator = page.locator(selector);

      context.logger.info(`Asserting ${displaySelector} is visible`);
      await expect(locator).toBeVisible({ timeout });
      context.logger.info(`✓ Element ${displaySelector} is visible`);
      return {
        _summary: `${displaySelector} is visible`,
        selector,
        isVisible: true,
      };
    },
  },

  // Assert Element Not Visible
  {
    type: 'web_assert_not_visible',
    category: 'Web',
    color: '#FF9800',
    tooltip: 'Assert that an element is not visible (auto-waits)',
    inputs: [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
      { name: 'TIMEOUT', type: 'field', fieldType: 'number', default: 30000 },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      const page = context.page as PlaywrightPage;
      const selector = resolveSelector(params, context);
      const displaySelector = getDisplaySelector(params, context);
      const timeout = params.TIMEOUT as number;

      const expect = await getExpect();
      const locator = page.locator(selector);

      context.logger.info(`Asserting ${displaySelector} is not visible`);
      await expect(locator).toBeHidden({ timeout });
      context.logger.info(`✓ Element ${displaySelector} is not visible`);
      return {
        _summary: `${displaySelector} is not visible`,
        selector,
        isVisible: false,
      };
    },
  },

  // Assert Text Contains
  {
    type: 'web_assert_text_contains',
    category: 'Web',
    color: '#FF9800',
    tooltip: 'Assert that element text contains expected value (auto-waits)',
    inputs: [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
      { name: 'TEXT', type: 'field', fieldType: 'text', required: true },
      { name: 'TIMEOUT', type: 'field', fieldType: 'number', default: 30000 },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      const page = context.page as PlaywrightPage;
      const selector = resolveSelector(params, context);
      const displaySelector = getDisplaySelector(params, context);
      const expectedText = resolveVariables(params.TEXT as string, context);
      const timeout = params.TIMEOUT as number;

      const expect = await getExpect();
      const locator = page.locator(selector);

      context.logger.info(`Asserting ${displaySelector} contains "${expectedText}"`);
      await expect(locator).toContainText(expectedText, { timeout });
      context.logger.info(`✓ Element ${displaySelector} contains text "${expectedText}"`);
      return {
        _summary: `"${expectedText}" found`,
        selector,
        expectedText,
      };
    },
  },

  // Assert Text Equals
  {
    type: 'web_assert_text_equals',
    category: 'Web',
    color: '#FF9800',
    tooltip: 'Assert that element text equals expected value (auto-waits)',
    inputs: [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
      { name: 'TEXT', type: 'field', fieldType: 'text', required: true },
      { name: 'TIMEOUT', type: 'field', fieldType: 'number', default: 30000 },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      const page = context.page as PlaywrightPage;
      const selector = resolveSelector(params, context);
      const displaySelector = getDisplaySelector(params, context);
      const expectedText = resolveVariables(params.TEXT as string, context);
      const timeout = params.TIMEOUT as number;

      const expect = await getExpect();
      const locator = page.locator(selector);

      context.logger.info(`Asserting ${displaySelector} text equals "${expectedText}"`);
      await expect(locator).toHaveText(expectedText, { timeout });
      context.logger.info(`✓ Element ${displaySelector} text equals "${expectedText}"`);
      return {
        _summary: `"${expectedText}" matches`,
        selector,
        expectedText,
      };
    },
  },

  // Assert URL Contains
  {
    type: 'web_assert_url_contains',
    category: 'Web',
    color: '#FF9800',
    tooltip: 'Assert that current URL contains expected value (auto-waits)',
    inputs: [
      { name: 'TEXT', type: 'field', fieldType: 'text', required: true },
      { name: 'TIMEOUT', type: 'field', fieldType: 'number', default: 30000 },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      const page = context.page as PlaywrightPage;
      const expectedText = resolveVariables(params.TEXT as string, context);
      const timeout = params.TIMEOUT as number;

      const expect = await getExpect();

      // Escape special regex characters and create a regex pattern
      const escapedText = expectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const urlPattern = new RegExp(escapedText);

      context.logger.info(`Asserting URL contains "${expectedText}"`);
      await expect(page).toHaveURL(urlPattern, { timeout });
      context.logger.info(`✓ URL contains "${expectedText}"`);
      return {
        _summary: `"${expectedText}" in URL`,
        expectedText,
        actualUrl: page.url(),
      };
    },
  },

  // Assert Title Contains
  {
    type: 'web_assert_title_contains',
    category: 'Web',
    color: '#FF9800',
    tooltip: 'Assert that page title contains expected value (auto-waits)',
    inputs: [
      { name: 'TEXT', type: 'field', fieldType: 'text', required: true },
      { name: 'TIMEOUT', type: 'field', fieldType: 'number', default: 30000 },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      const page = context.page as PlaywrightPage;
      const expectedText = resolveVariables(params.TEXT as string, context);
      const timeout = params.TIMEOUT as number;

      const expect = await getExpect();

      // Escape special regex characters and create a regex pattern
      const escapedText = expectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const titlePattern = new RegExp(escapedText);

      context.logger.info(`Asserting title contains "${expectedText}"`);
      await expect(page).toHaveTitle(titlePattern, { timeout });
      context.logger.info(`✓ Title contains "${expectedText}"`);
      return {
        _summary: `"${expectedText}" in title`,
        expectedText,
      };
    },
  },

  // Assert Element Enabled
  {
    type: 'web_assert_enabled',
    category: 'Web',
    color: '#FF9800',
    tooltip: 'Assert that an element is enabled (auto-waits)',
    inputs: [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
      { name: 'TIMEOUT', type: 'field', fieldType: 'number', default: 30000 },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      const page = context.page as PlaywrightPage;
      const selector = resolveSelector(params, context);
      const displaySelector = getDisplaySelector(params, context);
      const timeout = params.TIMEOUT as number;

      const expect = await getExpect();
      const locator = page.locator(selector);

      context.logger.info(`Asserting ${displaySelector} is enabled`);
      await expect(locator).toBeEnabled({ timeout });
      context.logger.info(`✓ Element ${displaySelector} is enabled`);
      return {
        _summary: `${displaySelector} is enabled`,
        selector,
        isEnabled: true,
      };
    },
  },

  // Assert Checkbox Checked
  {
    type: 'web_assert_checked',
    category: 'Web',
    color: '#FF9800',
    tooltip: 'Assert that a checkbox is checked (auto-waits)',
    inputs: [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
      { name: 'EXPECTED', type: 'field', fieldType: 'checkbox', default: true },
      { name: 'TIMEOUT', type: 'field', fieldType: 'number', default: 30000 },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      const page = context.page as PlaywrightPage;
      const selector = resolveSelector(params, context);
      const displaySelector = getDisplaySelector(params, context);
      const expected = params.EXPECTED as boolean;
      const timeout = params.TIMEOUT as number;

      const expect = await getExpect();
      const locator = page.locator(selector);

      context.logger.info(`Asserting ${displaySelector} is ${expected ? 'checked' : 'unchecked'}`);
      if (expected) {
        await expect(locator).toBeChecked({ timeout });
      } else {
        await expect(locator).not.toBeChecked({ timeout });
      }
      context.logger.info(`✓ Checkbox ${displaySelector} is ${expected ? 'checked' : 'unchecked'}`);
      return {
        _summary: `${displaySelector} is ${expected ? 'checked' : 'unchecked'}`,
        selector,
        expected,
      };
    },
  },
];

// Helper function - supports dot notation for object properties (e.g., ${user.email})
function resolveVariables(text: string, context: ExecutionContext): string {
  return text.replace(/\$\{([\w.]+)\}/g, (match, path) => {
    const parts = path.split('.');
    const varName = parts[0];
    let value: unknown = context.variables.get(varName);

    // Handle dot notation for nested object access
    if (parts.length > 1 && value !== undefined && value !== null) {
      for (let i = 1; i < parts.length; i++) {
        if (value === undefined || value === null) break;
        value = (value as Record<string, unknown>)[parts[i]];
      }
    }

    if (value === undefined || value === null) return match;
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  });
}

/**
 * Resolve a selector based on its type
 * - For 'testid:value' format: constructs [testIdAttribute="value"] using the global testIdAttribute
 * - For other formats: returns the selector as-is
 */
function resolveSelector(params: Record<string, unknown>, context: ExecutionContext): string {
  const rawSelector = resolveVariables(params.SELECTOR as string, context);

  // Check for testid: prefix (e.g., "testid:nav-sign-in")
  if (rawSelector.startsWith('testid:')) {
    const testIdValue = rawSelector.substring(7); // Remove 'testid:' prefix
    const testIdAttr = context.testIdAttribute || 'data-testid';
    return `[${testIdAttr}="${testIdValue}"]`;
  }

  return rawSelector;
}

/**
 * Get a display-friendly version of the selector (strips testid: prefix)
 */
function getDisplaySelector(params: Record<string, unknown>, context: ExecutionContext): string {
  const rawSelector = params.SELECTOR as string;

  // For testid: prefix, show the actual CSS selector that will be used
  if (rawSelector.startsWith('testid:')) {
    const testIdValue = rawSelector.substring(7);
    const testIdAttr = context.testIdAttribute || 'data-testid';
    return `[${testIdAttr}="${testIdValue}"]`;
  }

  return rawSelector;
}
