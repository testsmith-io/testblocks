import { BlockDefinition } from '../../types';
import { PlaywrightPage } from './types';
import { resolveVariables, resolveSelector, getDisplaySelector, getExpect, executeWebAssertion } from './utils';

/**
 * Assertion blocks for Playwright (visibility, text, values)
 */
export const assertionBlocks: BlockDefinition[] = [
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
      await executeWebAssertion(
        context,
        async () => { await expect(locator).toBeVisible({ timeout }); },
        `Expected element ${displaySelector} to be visible`,
        { stepType: 'web_assert_visible', expected: 'visible', actual: 'not visible' }
      );
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
      await executeWebAssertion(
        context,
        async () => { await expect(locator).toBeHidden({ timeout }); },
        `Expected element ${displaySelector} to be hidden`,
        { stepType: 'web_assert_not_visible', expected: 'hidden', actual: 'visible' }
      );
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
      await executeWebAssertion(
        context,
        async () => { await expect(locator).toContainText(expectedText, { timeout }); },
        `Expected element ${displaySelector} to contain text "${expectedText}"`,
        { stepType: 'web_assert_text_contains', expected: expectedText }
      );
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
      await executeWebAssertion(
        context,
        async () => { await expect(locator).toHaveText(expectedText, { timeout }); },
        `Expected element ${displaySelector} text to equal "${expectedText}"`,
        { stepType: 'web_assert_text_equals', expected: expectedText }
      );
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
      await executeWebAssertion(
        context,
        async () => { await expect(page).toHaveURL(urlPattern, { timeout }); },
        `Expected URL to contain "${expectedText}"`,
        { stepType: 'web_assert_url_contains', expected: expectedText, actual: page.url() }
      );
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
      await executeWebAssertion(
        context,
        async () => { await expect(page).toHaveTitle(titlePattern, { timeout }); },
        `Expected title to contain "${expectedText}"`,
        { stepType: 'web_assert_title_contains', expected: expectedText }
      );
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
      await executeWebAssertion(
        context,
        async () => { await expect(locator).toBeEnabled({ timeout }); },
        `Expected element ${displaySelector} to be enabled`,
        { stepType: 'web_assert_enabled', expected: 'enabled', actual: 'disabled' }
      );
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
      await executeWebAssertion(
        context,
        async () => {
          if (expected) {
            await expect(locator).toBeChecked({ timeout });
          } else {
            await expect(locator).not.toBeChecked({ timeout });
          }
        },
        `Expected checkbox ${displaySelector} to be ${expected ? 'checked' : 'unchecked'}`,
        { stepType: 'web_assert_checked', expected: expected ? 'checked' : 'unchecked' }
      );
      context.logger.info(`✓ Checkbox ${displaySelector} is ${expected ? 'checked' : 'unchecked'}`);
      return {
        _summary: `${displaySelector} is ${expected ? 'checked' : 'unchecked'}`,
        selector,
        expected,
      };
    },
  },

  // Assert Input Value
  {
    type: 'web_assert_value',
    category: 'Web',
    color: '#FF9800',
    tooltip: 'Assert that an input field has a specific value (auto-waits)',
    inputs: [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
      { name: 'VALUE', type: 'field', fieldType: 'text', required: true },
      { name: 'TIMEOUT', type: 'field', fieldType: 'number', default: 30000 },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      const page = context.page as PlaywrightPage;
      const selector = resolveSelector(params, context);
      const displaySelector = getDisplaySelector(params, context);
      const expectedValue = resolveVariables(params.VALUE as string, context);
      const timeout = params.TIMEOUT as number;

      const expect = await getExpect();
      const locator = page.locator(selector);

      context.logger.info(`Asserting ${displaySelector} has value "${expectedValue}"`);
      await executeWebAssertion(
        context,
        async () => {
          await expect(locator).toHaveValue(expectedValue, { timeout });
        },
        `Expected input ${displaySelector} to have value "${expectedValue}"`,
        { stepType: 'web_assert_value', expected: expectedValue }
      );
      context.logger.info(`✓ Input ${displaySelector} has value "${expectedValue}"`);
      return {
        _summary: `${displaySelector} = "${expectedValue}"`,
        selector,
        expected: expectedValue,
      };
    },
  },

  // Assert Input Value Contains
  {
    type: 'web_assert_value_contains',
    category: 'Web',
    color: '#FF9800',
    tooltip: 'Assert that an input field value contains specific text (auto-waits)',
    inputs: [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
      { name: 'VALUE', type: 'field', fieldType: 'text', required: true },
      { name: 'TIMEOUT', type: 'field', fieldType: 'number', default: 30000 },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      const page = context.page as PlaywrightPage;
      const selector = resolveSelector(params, context);
      const displaySelector = getDisplaySelector(params, context);
      const expectedValue = resolveVariables(params.VALUE as string, context);
      const timeout = params.TIMEOUT as number;

      const expect = await getExpect();
      const locator = page.locator(selector);

      context.logger.info(`Asserting ${displaySelector} value contains "${expectedValue}"`);
      await executeWebAssertion(
        context,
        async () => {
          await expect(locator).toHaveValue(new RegExp(expectedValue), { timeout });
        },
        `Expected input ${displaySelector} value to contain "${expectedValue}"`,
        { stepType: 'web_assert_value_contains', expected: expectedValue }
      );
      context.logger.info(`✓ Input ${displaySelector} value contains "${expectedValue}"`);
      return {
        _summary: `${displaySelector} contains "${expectedValue}"`,
        selector,
        expected: expectedValue,
      };
    },
  },
];
