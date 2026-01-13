import { BlockDefinition } from '../../types';
import { PlaywrightPage } from './types';
import { resolveVariables, resolveSelector } from './utils';

/**
 * User interaction blocks for Playwright (click, type, fill, etc.)
 */
export const interactionBlocks: BlockDefinition[] = [
  // Click Element
  {
    type: 'web_click',
    category: 'Web',
    color: '#E91E63',
    tooltip: 'Click on an element (auto-waits for element)',
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
      const locator = page.locator(selector);
      await locator.click({ timeout });
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
    tooltip: 'Fill an input field (clears existing value, auto-waits)',
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
      const rawValue = params.VALUE as string;
      const value = resolveVariables(rawValue, context);
      const timeout = params.TIMEOUT as number;

      context.logger.info(`Filling ${selector} with "${value}"`);
      const locator = page.locator(selector);
      await locator.fill(value, { timeout });
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
    tooltip: 'Type text character by character (auto-waits)',
    inputs: [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
      { name: 'TEXT', type: 'field', fieldType: 'text', required: true },
      { name: 'DELAY', type: 'field', fieldType: 'number', default: 50 },
      { name: 'TIMEOUT', type: 'field', fieldType: 'number', default: 30000 },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      const page = context.page as PlaywrightPage;
      const selector = resolveSelector(params, context);
      const text = resolveVariables(params.TEXT as string, context);
      const delay = params.DELAY as number;
      const timeout = params.TIMEOUT as number;

      context.logger.info(`Typing "${text}" into ${selector}`);
      const locator = page.locator(selector);
      await locator.pressSequentially(text, { delay, timeout });
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
    tooltip: 'Press a keyboard key (auto-waits)',
    inputs: [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
      { name: 'KEY', type: 'field', fieldType: 'dropdown', options: [['Enter', 'Enter'], ['Tab', 'Tab'], ['Escape', 'Escape'], ['Backspace', 'Backspace'], ['ArrowUp', 'ArrowUp'], ['ArrowDown', 'ArrowDown'], ['ArrowLeft', 'ArrowLeft'], ['ArrowRight', 'ArrowRight']] },
      { name: 'TIMEOUT', type: 'field', fieldType: 'number', default: 30000 },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      const page = context.page as PlaywrightPage;
      const selector = resolveSelector(params, context);
      const key = params.KEY as string;
      const timeout = params.TIMEOUT as number;

      context.logger.info(`Pressing ${key} on ${selector}`);
      const locator = page.locator(selector);
      await locator.press(key, { timeout });
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
    tooltip: 'Select an option from a dropdown (auto-waits)',
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
      const value = resolveVariables(params.VALUE as string, context);
      const timeout = params.TIMEOUT as number;

      context.logger.info(`Selecting "${value}" in ${selector}`);
      const locator = page.locator(selector);
      await locator.selectOption(value, { timeout });
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
    tooltip: 'Check or uncheck a checkbox (auto-waits)',
    inputs: [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
      { name: 'ACTION', type: 'field', fieldType: 'dropdown', options: [['Check', 'check'], ['Uncheck', 'uncheck']] },
      { name: 'TIMEOUT', type: 'field', fieldType: 'number', default: 30000 },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      const page = context.page as PlaywrightPage;
      const selector = resolveSelector(params, context);
      const action = params.ACTION as string;
      const timeout = params.TIMEOUT as number;

      context.logger.info(`${action === 'check' ? 'Checking' : 'Unchecking'} ${selector}`);
      const locator = page.locator(selector);
      if (action === 'check') {
        await locator.check({ timeout });
      } else {
        await locator.uncheck({ timeout });
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
    tooltip: 'Hover over an element (auto-waits)',
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

      context.logger.info(`Hovering over ${selector}`);
      const locator = page.locator(selector);
      await locator.hover({ timeout });
      return {
        _summary: params.SELECTOR as string,
        selector,
      };
    },
  },
];
