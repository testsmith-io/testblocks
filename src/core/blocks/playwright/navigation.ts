import { BlockDefinition } from '../../types';
import { PlaywrightPage } from './types';
import { resolveVariables, resolveSelector, getTimeout } from './utils';

/**
 * Navigation and waiting blocks for Playwright
 */
export const navigationBlocks: BlockDefinition[] = [
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

  // Wait for Element
  {
    type: 'web_wait_for_element',
    category: 'Web',
    color: '#9C27B0',
    tooltip: 'Wait for an element to appear/disappear',
    inputs: [
      { name: 'SELECTOR', type: 'field', fieldType: 'text', required: true },
      { name: 'STATE', type: 'field', fieldType: 'dropdown', options: [['Visible', 'visible'], ['Hidden', 'hidden'], ['Attached', 'attached'], ['Detached', 'detached']] },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      const page = context.page as PlaywrightPage;
      const selector = resolveSelector(params, context);
      const state = params.STATE as string;
      const timeout = getTimeout(context);

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
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      const page = context.page as PlaywrightPage;
      const url = resolveVariables(params.URL as string, context);
      const timeout = getTimeout(context);

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
];
