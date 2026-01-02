import { BlockDefinition, ExecutionContext } from '../types';
import { JSONPath } from 'jsonpath-plus';
import xpath from 'xpath';
import { DOMParser } from 'xmldom';

// API Testing Blocks
export const apiBlocks: BlockDefinition[] = [
  // ============================================
  // HEADER MANAGEMENT BLOCKS
  // ============================================

  // Set a single header
  {
    type: 'api_set_header',
    category: 'API',
    color: '#7B1FA2',
    tooltip: 'Set a request header (applies to subsequent requests)',
    inputs: [
      { name: 'NAME', type: 'field', fieldType: 'text', required: true, default: 'Authorization' },
      { name: 'VALUE', type: 'field', fieldType: 'text', required: true, default: 'Bearer token' },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      const name = params.NAME as string;
      const value = resolveVariables(params.VALUE as string, context);

      // Get or create headers map
      let headers = context.variables.get('__requestHeaders') as Record<string, string> | undefined;
      if (!headers) {
        headers = {};
      }
      headers[name] = value;
      context.variables.set('__requestHeaders', headers);

      context.logger.info(`Set header: ${name}: ${value.substring(0, 30)}${value.length > 30 ? '...' : ''}`);
      return {
        _summary: `${name}: ${value.substring(0, 30)}${value.length > 30 ? '...' : ''}`,
        name,
        value,
      };
    },
  },

  // Set multiple headers at once
  {
    type: 'api_set_headers',
    category: 'API',
    color: '#7B1FA2',
    tooltip: 'Set multiple request headers from JSON object',
    inputs: [
      { name: 'HEADERS', type: 'field', fieldType: 'text', required: true, default: '{"Content-Type": "application/json"}' },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      const headersStr = resolveVariables(params.HEADERS as string, context);

      try {
        const newHeaders = JSON.parse(headersStr) as Record<string, string>;

        // Get or create headers map
        let headers = context.variables.get('__requestHeaders') as Record<string, string> | undefined;
        if (!headers) {
          headers = {};
        }

        // Merge new headers
        Object.assign(headers, newHeaders);
        context.variables.set('__requestHeaders', headers);

        const headerNames = Object.keys(newHeaders).join(', ');
        context.logger.info(`Set headers: ${headerNames}`);
        return {
          _summary: `Set ${Object.keys(newHeaders).length} headers`,
          headers: newHeaders,
        };
      } catch {
        throw new Error(`Invalid JSON for headers: ${headersStr}`);
      }
    },
  },

  // Clear all headers
  {
    type: 'api_clear_headers',
    category: 'API',
    color: '#7B1FA2',
    tooltip: 'Clear all request headers',
    inputs: [],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      context.variables.delete('__requestHeaders');
      context.logger.info('Cleared all request headers');
      return { _summary: 'Headers cleared' };
    },
  },

  // ============================================
  // STATEMENT BLOCKS - Chain together visually
  // ============================================

  // HTTP GET Request (Statement - stores response)
  {
    type: 'api_get',
    category: 'API',
    color: '#4CAF50',
    tooltip: 'Perform HTTP GET request and store response',
    inputs: [
      { name: 'URL', type: 'field', fieldType: 'text', required: true },
      { name: 'HEADERS', type: 'field', fieldType: 'text', default: '' },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      const url = resolveVariables(params.URL as string, context);
      const contextHeaders = (context.variables.get('__requestHeaders') as Record<string, string>) || {};
      const inlineHeaders = parseHeaders(params.HEADERS as string, context);
      const headers = { ...contextHeaders, ...inlineHeaders };

      context.logger.info(`GET ${url}`);
      const response = await fetch(url, {
        headers,
        signal: context.abortSignal,
      });
      const parsed = await parseResponse(response);
      context.variables.set('__lastResponse', parsed);
      return parsed;
    },
  },

  // HTTP POST Request (Statement)
  {
    type: 'api_post',
    category: 'API',
    color: '#4CAF50',
    tooltip: 'Perform HTTP POST request and store response',
    inputs: [
      { name: 'URL', type: 'field', fieldType: 'text', required: true },
      { name: 'BODY', type: 'field', fieldType: 'text', default: '{}' },
      { name: 'HEADERS', type: 'field', fieldType: 'text', default: '' },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      const url = resolveVariables(params.URL as string, context);
      const bodyStr = resolveVariables(params.BODY as string || '{}', context);
      const contextHeaders = (context.variables.get('__requestHeaders') as Record<string, string>) || {};
      const inlineHeaders = parseHeaders(params.HEADERS as string, context);
      let body: unknown;
      try {
        body = JSON.parse(bodyStr);
      } catch {
        body = bodyStr;
      }

      context.logger.info(`POST ${url}`);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...contextHeaders, ...inlineHeaders },
        body: typeof body === 'string' ? body : JSON.stringify(body),
        signal: context.abortSignal,
      });
      const parsed = await parseResponse(response);
      context.variables.set('__lastResponse', parsed);
      return parsed;
    },
  },

  // HTTP PUT Request (Statement)
  {
    type: 'api_put',
    category: 'API',
    color: '#4CAF50',
    tooltip: 'Perform HTTP PUT request and store response',
    inputs: [
      { name: 'URL', type: 'field', fieldType: 'text', required: true },
      { name: 'BODY', type: 'field', fieldType: 'text', default: '{}' },
      { name: 'HEADERS', type: 'field', fieldType: 'text', default: '' },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      const url = resolveVariables(params.URL as string, context);
      const bodyStr = resolveVariables(params.BODY as string || '{}', context);
      const contextHeaders = (context.variables.get('__requestHeaders') as Record<string, string>) || {};
      const inlineHeaders = parseHeaders(params.HEADERS as string, context);
      let body: unknown;
      try {
        body = JSON.parse(bodyStr);
      } catch {
        body = bodyStr;
      }

      context.logger.info(`PUT ${url}`);
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...contextHeaders, ...inlineHeaders },
        body: typeof body === 'string' ? body : JSON.stringify(body),
        signal: context.abortSignal,
      });
      const parsed = await parseResponse(response);
      context.variables.set('__lastResponse', parsed);
      return parsed;
    },
  },

  // HTTP PATCH Request (Statement)
  {
    type: 'api_patch',
    category: 'API',
    color: '#4CAF50',
    tooltip: 'Perform HTTP PATCH request and store response',
    inputs: [
      { name: 'URL', type: 'field', fieldType: 'text', required: true },
      { name: 'BODY', type: 'field', fieldType: 'text', default: '{}' },
      { name: 'HEADERS', type: 'field', fieldType: 'text', default: '' },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      const url = resolveVariables(params.URL as string, context);
      const bodyStr = resolveVariables(params.BODY as string || '{}', context);
      const contextHeaders = (context.variables.get('__requestHeaders') as Record<string, string>) || {};
      const inlineHeaders = parseHeaders(params.HEADERS as string, context);
      let body: unknown;
      try {
        body = JSON.parse(bodyStr);
      } catch {
        body = bodyStr;
      }

      context.logger.info(`PATCH ${url}`);
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...contextHeaders, ...inlineHeaders },
        body: typeof body === 'string' ? body : JSON.stringify(body),
        signal: context.abortSignal,
      });
      const parsed = await parseResponse(response);
      context.variables.set('__lastResponse', parsed);
      return parsed;
    },
  },

  // HTTP DELETE Request (Statement)
  {
    type: 'api_delete',
    category: 'API',
    color: '#4CAF50',
    tooltip: 'Perform HTTP DELETE request and store response',
    inputs: [
      { name: 'URL', type: 'field', fieldType: 'text', required: true },
      { name: 'HEADERS', type: 'field', fieldType: 'text', default: '' },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      const url = resolveVariables(params.URL as string, context);
      const contextHeaders = (context.variables.get('__requestHeaders') as Record<string, string>) || {};
      const inlineHeaders = parseHeaders(params.HEADERS as string, context);
      const headers = { ...contextHeaders, ...inlineHeaders };

      context.logger.info(`DELETE ${url}`);
      const response = await fetch(url, {
        method: 'DELETE',
        headers,
        signal: context.abortSignal,
      });
      const parsed = await parseResponse(response);
      context.variables.set('__lastResponse', parsed);
      return parsed;
    },
  },

  // Assert Status Code (uses last response if not provided)
  {
    type: 'api_assert_status',
    category: 'API',
    color: '#FF9800',
    tooltip: 'Assert that response has expected status code',
    inputs: [
      { name: 'STATUS', type: 'field', fieldType: 'number', default: 200, required: true },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      const response = context.variables.get('__lastResponse') as { status: number } | undefined;
      if (!response) {
        throw new Error('No response available. Make sure to call an API request first.');
      }
      const expectedStatus = params.STATUS as number;

      if (response.status !== expectedStatus) {
        throw new Error(`Expected status ${expectedStatus} but got ${response.status}`);
      }
      context.logger.info(`✓ Status is ${expectedStatus}`);
      return {
        _summary: `✓ Status ${response.status} === ${expectedStatus}`,
        expected: expectedStatus,
        actual: response.status,
      };
    },
  },

  // Assert Response Body Contains
  {
    type: 'api_assert_body_contains',
    category: 'API',
    color: '#FF9800',
    tooltip: 'Assert that response body contains expected value',
    inputs: [
      { name: 'PATH', type: 'field', fieldType: 'text', default: '' },
      { name: 'VALUE', type: 'field', fieldType: 'text', required: true },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      const response = context.variables.get('__lastResponse') as { body: unknown } | undefined;
      if (!response) {
        throw new Error('No response available. Make sure to call an API request first.');
      }
      const path = params.PATH as string;
      const expectedValue = resolveVariables(params.VALUE as string, context);

      const actualValue = path ? getValueByPath(response.body, path) : response.body;
      const actualStr = typeof actualValue === 'string' ? actualValue : JSON.stringify(actualValue);

      if (!actualStr.includes(expectedValue)) {
        throw new Error(
          `Expected ${path || 'body'} to contain "${expectedValue}" but got "${actualStr}"`
        );
      }
      context.logger.info(`✓ ${path || 'body'} contains "${expectedValue}"`);
      return {
        _summary: `✓ ${path || 'body'} contains "${expectedValue}"`,
        path: path || 'body',
        expected: expectedValue,
        actual: actualStr.substring(0, 100) + (actualStr.length > 100 ? '...' : ''),
      };
    },
  },

  // Extract Value using JSONPath
  {
    type: 'api_extract_jsonpath',
    category: 'API',
    color: '#2196F3',
    tooltip: 'Extract a value from JSON response using JSONPath expression',
    inputs: [
      { name: 'JSONPATH', type: 'field', fieldType: 'text', required: true, default: '$.data.id' },
      { name: 'VARIABLE', type: 'field', fieldType: 'text', required: true },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      const response = context.variables.get('__lastResponse') as { body: unknown } | undefined;
      if (!response) {
        throw new Error('No response available. Make sure to call an API request first.');
      }
      const jsonPath = params.JSONPATH as string;
      const varName = params.VARIABLE as string;

      try {
        const results = JSONPath({ path: jsonPath, json: response.body as object }) as unknown[];
        // If single result, unwrap from array
        const value = results.length === 1 ? results[0] : results;
        context.variables.set(varName, value);
        const valueStr = JSON.stringify(value);
        context.logger.info(`Extracted (JSONPath) ${jsonPath} → ${varName} = ${valueStr}`);
        return {
          _summary: `${varName} = ${valueStr.substring(0, 50)}${valueStr.length > 50 ? '...' : ''}`,
          variable: varName,
          jsonPath,
          value,
        };
      } catch (e) {
        throw new Error(`Invalid JSONPath expression: ${jsonPath}. Error: ${(e as Error).message}`);
      }
    },
  },

  // Extract Value using XPath (for XML/HTML responses)
  {
    type: 'api_extract_xpath',
    category: 'API',
    color: '#2196F3',
    tooltip: 'Extract a value from XML/HTML response using XPath expression',
    inputs: [
      { name: 'XPATH', type: 'field', fieldType: 'text', required: true, default: '//title/text()' },
      { name: 'VARIABLE', type: 'field', fieldType: 'text', required: true },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      const response = context.variables.get('__lastResponse') as { body: unknown } | undefined;
      if (!response) {
        throw new Error('No response available. Make sure to call an API request first.');
      }
      const xpathExpr = params.XPATH as string;
      const varName = params.VARIABLE as string;

      try {
        // Ensure body is a string for XML parsing
        const xmlString = typeof response.body === 'string'
          ? response.body
          : JSON.stringify(response.body);

        const doc = new DOMParser().parseFromString(xmlString, 'text/xml');
        const nodes = xpath.select(xpathExpr, doc);

        // Convert nodes to values
        let value: unknown;
        if (Array.isArray(nodes)) {
          if (nodes.length === 0) {
            value = null;
          } else if (nodes.length === 1) {
            value = getNodeValue(nodes[0]);
          } else {
            value = nodes.map(getNodeValue);
          }
        } else {
          value = nodes;
        }

        context.variables.set(varName, value);
        const valueStr = JSON.stringify(value);
        context.logger.info(`Extracted (XPath) ${xpathExpr} → ${varName} = ${valueStr}`);
        return {
          _summary: `${varName} = ${valueStr.substring(0, 50)}${valueStr.length > 50 ? '...' : ''}`,
          variable: varName,
          xpath: xpathExpr,
          value,
        };
      } catch (e) {
        throw new Error(`XPath extraction failed: ${xpathExpr}. Error: ${(e as Error).message}`);
      }
    },
  },

  // Legacy extract (simple dot notation) - kept for backwards compatibility
  {
    type: 'api_extract',
    category: 'API',
    color: '#2196F3',
    tooltip: 'Extract a value from response using dot notation (e.g., data.user.name)',
    inputs: [
      { name: 'PATH', type: 'field', fieldType: 'text', required: true },
      { name: 'VARIABLE', type: 'field', fieldType: 'text', required: true },
    ],
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      const response = context.variables.get('__lastResponse') as { body: unknown } | undefined;
      if (!response) {
        throw new Error('No response available. Make sure to call an API request first.');
      }
      const path = params.PATH as string;
      const varName = params.VARIABLE as string;

      const value = getValueByPath(response.body, path);
      context.variables.set(varName, value);
      const valueStr = JSON.stringify(value);
      context.logger.info(`Extracted ${path} → ${varName} = ${valueStr}`);
      return {
        _summary: `${varName} = ${valueStr.substring(0, 50)}${valueStr.length > 50 ? '...' : ''}`,
        variable: varName,
        path,
        value,
      };
    },
  },

  // ============================================
  // VALUE BLOCKS - For advanced compositions
  // ============================================

  // Create Headers Object
  {
    type: 'api_headers',
    category: 'API',
    color: '#9C27B0',
    tooltip: 'Create a headers object',
    inputs: [
      { name: 'AUTH_TYPE', type: 'field', fieldType: 'dropdown', options: [['None', 'none'], ['Bearer Token', 'bearer'], ['Basic Auth', 'basic'], ['API Key', 'apikey']] },
      { name: 'AUTH_VALUE', type: 'field', fieldType: 'text' },
      { name: 'CUSTOM', type: 'value', check: 'Object' },
    ],
    output: { type: 'Object' },
    execute: async (params, context) => {
      const authType = params.AUTH_TYPE as string;
      const authValue = resolveVariables(params.AUTH_VALUE as string || '', context);
      const custom = (params.CUSTOM as Record<string, string>) || {};

      const headers: Record<string, string> = { ...custom };

      switch (authType) {
        case 'bearer':
          headers['Authorization'] = `Bearer ${authValue}`;
          break;
        case 'basic':
          headers['Authorization'] = `Basic ${Buffer.from(authValue).toString('base64')}`;
          break;
        case 'apikey':
          headers['X-API-Key'] = authValue;
          break;
      }

      return headers;
    },
  },

  // Create JSON Body
  {
    type: 'api_json_body',
    category: 'API',
    color: '#9C27B0',
    tooltip: 'Create a JSON body from key-value pairs or raw JSON',
    inputs: [
      { name: 'JSON', type: 'field', fieldType: 'text', default: '{}' },
    ],
    output: { type: 'Object' },
    execute: async (params, context) => {
      const json = resolveVariables(params.JSON as string, context);
      return JSON.parse(json);
    },
  },
];

// Helper functions
function resolveVariables(text: string, context: ExecutionContext): string {
  // Match ${varName} or ${varName.property.path}
  return text.replace(/\$\{([\w.]+)\}/g, (match, path) => {
    const parts = path.split('.');
    const varName = parts[0];
    let value: unknown = context.variables.get(varName);

    // Navigate through object properties if path has dots
    if (parts.length > 1 && value !== undefined && value !== null) {
      for (let i = 1; i < parts.length; i++) {
        if (value === undefined || value === null) break;
        value = (value as Record<string, unknown>)[parts[i]];
      }
    }

    if (value === undefined || value === null) {
      return match; // Keep original if not found
    }

    // Return stringified value
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  });
}

function parseHeaders(headersStr: string, context: ExecutionContext): Record<string, string> {
  if (!headersStr || !headersStr.trim()) return {};

  const resolved = resolveVariables(headersStr, context);

  // Try JSON format first: {"Authorization": "Bearer token"}
  try {
    const parsed = JSON.parse(resolved);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as Record<string, string>;
    }
  } catch {
    // Not JSON, try key:value format
  }

  // Try key:value format (one per line or semicolon-separated)
  // Example: "Authorization: Bearer token; Content-Type: application/json"
  const headers: Record<string, string> = {};
  const pairs = resolved.split(/[;\n]/).map(s => s.trim()).filter(s => s);

  for (const pair of pairs) {
    const colonIndex = pair.indexOf(':');
    if (colonIndex > 0) {
      const key = pair.slice(0, colonIndex).trim();
      const value = pair.slice(colonIndex + 1).trim();
      headers[key] = value;
    }
  }

  return headers;
}

async function parseResponse(response: Response): Promise<{ status: number; headers: Record<string, string>; body: unknown }> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  let body: unknown;
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    body = await response.json();
  } else {
    body = await response.text();
  }

  return { status: response.status, headers, body };
}

function getValueByPath(obj: unknown, path: string): unknown {
  if (!path) return obj;

  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;

    // Handle array indexing like "items[0]"
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, key, index] = arrayMatch;
      current = (current as Record<string, unknown>)[key];
      if (Array.isArray(current)) {
        current = current[parseInt(index, 10)];
      }
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }

  return current;
}

// Helper to extract value from XPath node
function getNodeValue(node: unknown): string | null {
  if (!node) return null;

  const n = node as { nodeValue?: string; textContent?: string; toString?: () => string };

  // Text node or attribute
  if (n.nodeValue !== undefined) {
    return n.nodeValue;
  }

  // Element node - get text content
  if (n.textContent !== undefined) {
    return n.textContent;
  }

  // Fallback to string representation
  if (n.toString) {
    return n.toString();
  }

  return null;
}
