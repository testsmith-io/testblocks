import { BlockDefinition } from '../../types';
import { PlaywrightPage } from './types';
import { resolveSelector } from './utils';

/**
 * Data retrieval blocks for Playwright (get text, attributes, values)
 */
export const retrievalBlocks: BlockDefinition[] = [
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

  // Count Elements
  {
    type: 'web_count_elements',
    category: 'Web',
    color: '#2196F3',
    tooltip: 'Count the number of elements matching a selector',
    inputs: [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
    ],
    output: { type: 'Number' },
    execute: async (params, context) => {
      const page = context.page as PlaywrightPage;
      const selector = resolveSelector(params, context);

      const count = await page.locator(selector).count();
      context.logger.debug(`Found ${count} elements matching ${selector}`);
      return {
        _summary: `${count} elements`,
        _value: count,
        selector,
        count,
      };
    },
  },
];
