import { ExecutionContext } from '../../types';
import { resolveVariables } from './variableUtils';

/**
 * Parse header string into an object.
 * Supports JSON format or key:value format.
 *
 * @param headersStr - The headers string (JSON or key:value pairs)
 * @param context - The execution context for variable resolution
 * @returns The parsed headers object
 */
export function parseHeaders(headersStr: string, context: ExecutionContext): Record<string, string> {
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

/**
 * Parse an HTTP response into a structured object.
 *
 * @param response - The fetch Response object
 * @returns Parsed response with status, headers, and body
 */
export async function parseResponse(response: Response): Promise<{ status: number; headers: Record<string, string>; body: unknown }> {
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

/**
 * Get a value from an object by dot-notation path.
 * Supports array indexing like "items[0]".
 *
 * @param obj - The object to traverse
 * @param path - The dot-notation path (e.g., "data.user.name" or "items[0].id")
 * @returns The value at the path, or undefined if not found
 */
export function getValueByPath(obj: unknown, path: string): unknown {
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

/**
 * Extract value from an XPath node.
 *
 * @param node - The XPath node
 * @returns The string value of the node
 */
export function getNodeValue(node: unknown): string | null {
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

/**
 * Get the last API response from context.
 *
 * @param context - The execution context
 * @returns The last response or throws if none available
 */
export function getLastResponse(context: ExecutionContext): { status: number; headers: Record<string, string>; body: unknown } {
  const response = context.variables.get('__lastResponse') as { status: number; headers: Record<string, string>; body: unknown } | undefined;
  if (!response) {
    throw new Error('No response available. Make sure to call an API request first.');
  }
  return response;
}

/**
 * Get context headers (set via api_set_header/api_set_headers blocks).
 *
 * @param context - The execution context
 * @returns The headers object
 */
export function getContextHeaders(context: ExecutionContext): Record<string, string> {
  return (context.variables.get('__requestHeaders') as Record<string, string>) || {};
}

/**
 * Set context headers.
 *
 * @param context - The execution context
 * @param headers - The headers to set
 */
export function setContextHeaders(context: ExecutionContext, headers: Record<string, string>): void {
  context.variables.set('__requestHeaders', headers);
}

/**
 * Merge headers with context headers and inline headers.
 *
 * @param context - The execution context
 * @param inlineHeadersStr - Optional inline headers string
 * @returns The merged headers
 */
export function mergeHeaders(context: ExecutionContext, inlineHeadersStr?: string): Record<string, string> {
  const contextHeaders = getContextHeaders(context);
  const inlineHeaders = inlineHeadersStr ? parseHeaders(inlineHeadersStr, context) : {};
  return { ...contextHeaders, ...inlineHeaders };
}

/**
 * Store an API response in the context.
 *
 * @param context - The execution context
 * @param response - The parsed response to store
 */
export function storeResponse(context: ExecutionContext, response: { status: number; headers: Record<string, string>; body: unknown }): void {
  context.variables.set('__lastResponse', response);
}
