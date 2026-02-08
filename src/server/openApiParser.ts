import SwaggerParser from '@apidevtools/swagger-parser';
import type { OpenAPI, OpenAPIV3, OpenAPIV2 } from 'openapi-types';
import { TestFile, TestCase, TestStep, VariableDefinition } from '../core';

export interface ParsedParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required: boolean;
  description?: string;
  schema?: {
    type: string;
    format?: string;
    default?: unknown;
    example?: unknown;
  };
}

export interface ParsedRequestBody {
  required: boolean;
  contentType: string;
  schema?: Record<string, unknown>;
  example?: unknown;
}

export interface ParsedResponse {
  statusCode: string;
  description?: string;
  schema?: Record<string, unknown>;
  example?: unknown;
}

export interface ParsedEndpoint {
  operationId: string;
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  summary?: string;
  description?: string;
  tags: string[];
  parameters: ParsedParameter[];
  requestBody?: ParsedRequestBody;
  responses: ParsedResponse[];
  security?: Record<string, string[]>[];
  deprecated?: boolean;
}

export interface ParsedSecurityScheme {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
  name?: string;
  in?: 'header' | 'query' | 'cookie';
  scheme?: string;
  bearerFormat?: string;
  description?: string;
}

export interface ParsedSpec {
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers: { url: string; description?: string }[];
  endpoints: ParsedEndpoint[];
  securitySchemes: Record<string, ParsedSecurityScheme>;
  tags: { name: string; description?: string }[];
}

export interface ImportOptions {
  baseUrl: string;
  fileStrategy: 'single' | 'per-tag' | 'per-path';
  includeExamples: boolean;
  generateAssertions: boolean;
  authVariablePrefix: string;
}

export interface GeneratedTestFile {
  fileName: string;
  testFile: TestFile;
}

/**
 * Parse an OpenAPI/Swagger spec from a URL or content string
 */
export async function parseOpenApiSpec(source: string, isUrl: boolean = true): Promise<ParsedSpec> {
  let api: OpenAPI.Document;

  if (isUrl) {
    api = await SwaggerParser.dereference(source);
  } else {
    // Parse from content string (JSON or YAML)
    const content = source.trim();
    let parsed: unknown;

    if (content.startsWith('{')) {
      parsed = JSON.parse(content);
    } else {
      // Import yaml dynamically
      const yaml = await import('yaml');
      parsed = yaml.parse(content);
    }

    api = await SwaggerParser.dereference(parsed as OpenAPI.Document);
  }

  return extractSpecInfo(api);
}

/**
 * Extract structured information from a parsed OpenAPI spec
 */
function extractSpecInfo(api: OpenAPI.Document): ParsedSpec {
  const isV3 = 'openapi' in api;

  // Extract info
  const info = {
    title: api.info.title,
    version: api.info.version,
    description: api.info.description,
  };

  // Extract servers
  const servers: { url: string; description?: string }[] = [];
  if (isV3) {
    const v3Api = api as OpenAPIV3.Document;
    if (v3Api.servers) {
      servers.push(...v3Api.servers.map(s => ({ url: s.url, description: s.description })));
    }
  } else {
    const v2Api = api as OpenAPIV2.Document;
    const scheme = v2Api.schemes?.[0] || 'https';
    const host = v2Api.host || 'localhost';
    const basePath = v2Api.basePath || '';
    servers.push({ url: `${scheme}://${host}${basePath}` });
  }

  // Extract security schemes
  const securitySchemes: Record<string, ParsedSecurityScheme> = {};
  if (isV3) {
    const v3Api = api as OpenAPIV3.Document;
    const schemes = v3Api.components?.securitySchemes || {};
    for (const [name, scheme] of Object.entries(schemes)) {
      if ('type' in scheme) {
        securitySchemes[name] = extractSecurityScheme(scheme as OpenAPIV3.SecuritySchemeObject);
      }
    }
  } else {
    const v2Api = api as OpenAPIV2.Document;
    const schemes = v2Api.securityDefinitions || {};
    for (const [name, scheme] of Object.entries(schemes)) {
      securitySchemes[name] = extractSecuritySchemeV2(scheme);
    }
  }

  // Extract tags
  const tags = (api.tags || []).map(t => ({
    name: t.name,
    description: t.description,
  }));

  // Extract endpoints
  const endpoints: ParsedEndpoint[] = [];
  const paths = api.paths || {};

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem) continue;

    const methods: ('get' | 'post' | 'put' | 'patch' | 'delete')[] = ['get', 'post', 'put', 'patch', 'delete'];

    for (const method of methods) {
      const operation = (pathItem as Record<string, unknown>)[method] as OpenAPIV3.OperationObject | OpenAPIV2.OperationObject | undefined;
      if (!operation) continue;

      const endpoint = extractEndpoint(path, method, operation, pathItem, isV3);
      endpoints.push(endpoint);
    }
  }

  return { info, servers, endpoints, securitySchemes, tags };
}

/**
 * Extract a single endpoint from an operation
 */
function extractEndpoint(
  path: string,
  method: 'get' | 'post' | 'put' | 'patch' | 'delete',
  operation: OpenAPIV3.OperationObject | OpenAPIV2.OperationObject,
  pathItem: OpenAPIV3.PathItemObject | OpenAPIV2.PathItemObject,
  isV3: boolean
): ParsedEndpoint {
  // Combine path-level and operation-level parameters
  const pathParams = (pathItem.parameters || []) as (OpenAPIV3.ParameterObject | OpenAPIV2.ParameterObject)[];
  const opParams = (operation.parameters || []) as (OpenAPIV3.ParameterObject | OpenAPIV2.ParameterObject)[];
  const allParams = [...pathParams, ...opParams];

  // Extract parameters
  const parameters: ParsedParameter[] = allParams.map(param => ({
    name: param.name,
    in: param.in as 'path' | 'query' | 'header' | 'cookie',
    required: param.required || false,
    description: param.description,
    schema: isV3
      ? extractSchema((param as OpenAPIV3.ParameterObject).schema as OpenAPIV3.SchemaObject)
      : extractSchemaV2(param as OpenAPIV2.ParameterObject),
  }));

  // Extract request body
  let requestBody: ParsedRequestBody | undefined;
  if (isV3) {
    const v3Op = operation as OpenAPIV3.OperationObject;
    if (v3Op.requestBody && 'content' in v3Op.requestBody) {
      const rb = v3Op.requestBody as OpenAPIV3.RequestBodyObject;
      const contentType = Object.keys(rb.content)[0] || 'application/json';
      const mediaType = rb.content[contentType];
      requestBody = {
        required: rb.required || false,
        contentType,
        schema: mediaType?.schema as Record<string, unknown>,
        example: mediaType?.example || (mediaType?.schema as OpenAPIV3.SchemaObject)?.example,
      };
    }
  } else {
    const v2Op = operation as OpenAPIV2.OperationObject;
    const bodyParam = allParams.find(p => p.in === 'body') as OpenAPIV2.InBodyParameterObject | undefined;
    if (bodyParam) {
      requestBody = {
        required: bodyParam.required || false,
        contentType: 'application/json',
        schema: bodyParam.schema as Record<string, unknown>,
        example: (bodyParam.schema as Record<string, unknown>)?.example,
      };
    }
  }

  // Extract responses
  const responses: ParsedResponse[] = [];
  for (const [statusCode, response] of Object.entries(operation.responses || {})) {
    if (!response || '$ref' in response) continue;

    const resp = response as OpenAPIV3.ResponseObject | OpenAPIV2.ResponseObject;
    let example: unknown;
    let schema: Record<string, unknown> | undefined;

    if (isV3) {
      const v3Resp = resp as OpenAPIV3.ResponseObject;
      const content = v3Resp.content?.['application/json'];
      schema = content?.schema as Record<string, unknown>;
      example = content?.example || (content?.schema as OpenAPIV3.SchemaObject)?.example;
    } else {
      const v2Resp = resp as OpenAPIV2.ResponseObject;
      schema = v2Resp.schema as Record<string, unknown>;
      example = (v2Resp.schema as Record<string, unknown>)?.example;
    }

    responses.push({
      statusCode,
      description: resp.description,
      schema,
      example,
    });
  }

  // Generate operation ID if not present
  const operationId = operation.operationId || `${method}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`;

  return {
    operationId,
    method,
    path,
    summary: operation.summary,
    description: operation.description,
    tags: operation.tags || [],
    parameters,
    requestBody,
    responses,
    security: operation.security as Record<string, string[]>[],
    deprecated: operation.deprecated,
  };
}

function extractSchema(schema: OpenAPIV3.SchemaObject | undefined): ParsedParameter['schema'] | undefined {
  if (!schema) return undefined;
  return {
    type: schema.type as string || 'string',
    format: schema.format,
    default: schema.default,
    example: schema.example,
  };
}

function extractSchemaV2(param: OpenAPIV2.ParameterObject): ParsedParameter['schema'] | undefined {
  if (!('type' in param)) return undefined;
  const p = param as OpenAPIV2.GeneralParameterObject;
  return {
    type: p.type || 'string',
    format: p.format,
    default: p.default,
    example: undefined, // V2 doesn't have example on parameters
  };
}

function extractSecurityScheme(scheme: OpenAPIV3.SecuritySchemeObject): ParsedSecurityScheme {
  return {
    type: scheme.type as ParsedSecurityScheme['type'],
    name: 'name' in scheme ? (scheme as OpenAPIV3.ApiKeySecurityScheme).name : undefined,
    in: 'in' in scheme ? (scheme as OpenAPIV3.ApiKeySecurityScheme).in as 'header' | 'query' | 'cookie' : undefined,
    scheme: 'scheme' in scheme ? (scheme as OpenAPIV3.HttpSecurityScheme).scheme : undefined,
    bearerFormat: 'bearerFormat' in scheme ? (scheme as OpenAPIV3.HttpSecurityScheme).bearerFormat : undefined,
    description: scheme.description,
  };
}

function extractSecuritySchemeV2(scheme: OpenAPIV2.SecuritySchemeObject): ParsedSecurityScheme {
  return {
    type: scheme.type === 'basic' ? 'http' : scheme.type as ParsedSecurityScheme['type'],
    name: 'name' in scheme ? (scheme as OpenAPIV2.SecuritySchemeApiKey).name : undefined,
    in: 'in' in scheme ? (scheme as OpenAPIV2.SecuritySchemeApiKey).in as 'header' | 'query' : undefined,
    scheme: scheme.type === 'basic' ? 'basic' : undefined,
    description: scheme.description,
  };
}

/**
 * Generate test files from selected endpoints
 */
export function generateTestFiles(
  spec: ParsedSpec,
  selectedEndpoints: string[],
  options: ImportOptions
): GeneratedTestFile[] {
  const endpoints = spec.endpoints.filter(e => selectedEndpoints.includes(e.operationId));

  if (endpoints.length === 0) {
    return [];
  }

  switch (options.fileStrategy) {
    case 'single':
      return [generateSingleFile(spec, endpoints, options)];
    case 'per-tag':
      return generatePerTagFiles(spec, endpoints, options);
    case 'per-path':
      return generatePerPathFiles(spec, endpoints, options);
    default:
      return [generateSingleFile(spec, endpoints, options)];
  }
}

function generateSingleFile(
  spec: ParsedSpec,
  endpoints: ParsedEndpoint[],
  options: ImportOptions
): GeneratedTestFile {
  const variables = extractVariables(endpoints, options);
  const tests = endpoints.map(endpoint => generateTestCase(endpoint, options));

  const testFile: TestFile = {
    version: '1.0.0',
    name: spec.info.title,
    description: spec.info.description || `API tests generated from ${spec.info.title} v${spec.info.version}`,
    variables,
    tests,
  };

  const fileName = sanitizeFileName(spec.info.title) + '.testblocks.json';

  return { fileName, testFile };
}

function generatePerTagFiles(
  spec: ParsedSpec,
  endpoints: ParsedEndpoint[],
  options: ImportOptions
): GeneratedTestFile[] {
  // Group endpoints by tag
  const byTag = new Map<string, ParsedEndpoint[]>();

  for (const endpoint of endpoints) {
    const tag = endpoint.tags[0] || 'default';
    if (!byTag.has(tag)) {
      byTag.set(tag, []);
    }
    byTag.get(tag)!.push(endpoint);
  }

  const files: GeneratedTestFile[] = [];

  for (const [tag, tagEndpoints] of byTag) {
    const variables = extractVariables(tagEndpoints, options);
    const tests = tagEndpoints.map(endpoint => generateTestCase(endpoint, options));

    const tagInfo = spec.tags.find(t => t.name === tag);

    const testFile: TestFile = {
      version: '1.0.0',
      name: `${spec.info.title} - ${tag}`,
      description: tagInfo?.description || `API tests for ${tag}`,
      variables,
      tests,
    };

    const fileName = sanitizeFileName(`${spec.info.title}-${tag}`) + '.testblocks.json';
    files.push({ fileName, testFile });
  }

  return files;
}

function generatePerPathFiles(
  spec: ParsedSpec,
  endpoints: ParsedEndpoint[],
  options: ImportOptions
): GeneratedTestFile[] {
  // Group endpoints by base path (first segment)
  const byPath = new Map<string, ParsedEndpoint[]>();

  for (const endpoint of endpoints) {
    const segments = endpoint.path.split('/').filter(Boolean);
    const basePath = segments[0] || 'root';
    if (!byPath.has(basePath)) {
      byPath.set(basePath, []);
    }
    byPath.get(basePath)!.push(endpoint);
  }

  const files: GeneratedTestFile[] = [];

  for (const [basePath, pathEndpoints] of byPath) {
    const variables = extractVariables(pathEndpoints, options);
    const tests = pathEndpoints.map(endpoint => generateTestCase(endpoint, options));

    const testFile: TestFile = {
      version: '1.0.0',
      name: `${spec.info.title} - /${basePath}`,
      description: `API tests for /${basePath} endpoints`,
      variables,
      tests,
    };

    const fileName = sanitizeFileName(`${spec.info.title}-${basePath}`) + '.testblocks.json';
    files.push({ fileName, testFile });
  }

  return files;
}

function extractVariables(
  endpoints: ParsedEndpoint[],
  options: ImportOptions
): Record<string, VariableDefinition> {
  const variables: Record<string, VariableDefinition> = {
    baseUrl: {
      type: 'string',
      default: options.baseUrl || '',
      description: 'API base URL',
    },
  };

  // Extract unique path parameters
  const pathParams = new Set<string>();
  for (const endpoint of endpoints) {
    for (const param of endpoint.parameters) {
      if (param.in === 'path') {
        pathParams.add(param.name);
      }
    }
  }

  for (const paramName of pathParams) {
    const param = endpoints
      .flatMap(e => e.parameters)
      .find(p => p.name === paramName && p.in === 'path');

    variables[paramName] = {
      type: (param?.schema?.type || 'string') as VariableDefinition['type'],
      default: param?.schema?.example || param?.schema?.default || '',
      description: param?.description || `Path parameter: ${paramName}`,
    };
  }

  return variables;
}

function generateTestCase(endpoint: ParsedEndpoint, options: ImportOptions): TestCase {
  const steps: TestStep[] = [];

  // Generate API call step
  const apiStep = generateApiCallStep(endpoint, options);
  steps.push(apiStep);

  // Generate assertion step if enabled
  if (options.generateAssertions) {
    const assertionStep = generateAssertionStep(endpoint);
    if (assertionStep) {
      steps.push(assertionStep);
    }
  }

  return {
    id: `test-${endpoint.operationId}-${Date.now()}`,
    name: `${endpoint.method.toUpperCase()} ${endpoint.path}`,
    description: endpoint.summary || endpoint.description,
    tags: endpoint.tags,
    steps,
  };
}

function generateApiCallStep(endpoint: ParsedEndpoint, options: ImportOptions): TestStep {
  const blockType = `api_${endpoint.method}`;

  // Convert path parameters from {param} to ${param}
  const urlPath = endpoint.path.replace(/\{([^}]+)\}/g, '${$1}');
  const url = `\${baseUrl}${urlPath}`;

  const params: Record<string, unknown> = {
    URL: url,
  };

  // Add request body for POST/PUT/PATCH
  if (['post', 'put', 'patch'].includes(endpoint.method) && endpoint.requestBody) {
    let body = '{}';

    if (options.includeExamples && endpoint.requestBody.example) {
      body = JSON.stringify(endpoint.requestBody.example, null, 2);
    } else if (endpoint.requestBody.schema) {
      body = generateSchemaExample(endpoint.requestBody.schema);
    }

    params.BODY = body;
  }

  return {
    id: `step-${endpoint.operationId}-call-${Date.now()}`,
    type: blockType,
    params,
  };
}

function generateAssertionStep(endpoint: ParsedEndpoint): TestStep | null {
  // Find the first 2xx response
  const successResponse = endpoint.responses.find(r => r.statusCode.startsWith('2'));

  if (!successResponse) {
    return null;
  }

  const statusCode = parseInt(successResponse.statusCode, 10);

  return {
    id: `step-${endpoint.operationId}-assert-${Date.now()}`,
    type: 'api_assert_status',
    params: {
      STATUS: isNaN(statusCode) ? 200 : statusCode,
    },
  };
}

function generateSchemaExample(schema: Record<string, unknown>): string {
  // Simple schema-to-example generation
  const type = schema.type as string;

  if (schema.example !== undefined) {
    return JSON.stringify(schema.example, null, 2);
  }

  switch (type) {
    case 'object': {
      const properties = schema.properties as Record<string, Record<string, unknown>> | undefined;
      if (!properties) return '{}';

      const obj: Record<string, unknown> = {};
      for (const [key, prop] of Object.entries(properties)) {
        obj[key] = getDefaultValueForType(prop.type as string, prop.example, prop.format as string);
      }
      return JSON.stringify(obj, null, 2);
    }
    case 'array': {
      const items = schema.items as Record<string, unknown> | undefined;
      if (!items) return '[]';
      const itemValue = getDefaultValueForType(items.type as string, items.example, items.format as string);
      return JSON.stringify([itemValue], null, 2);
    }
    default:
      return '{}';
  }
}

function getDefaultValueForType(type: string, example?: unknown, format?: string): unknown {
  if (example !== undefined) return example;

  switch (type) {
    case 'string':
      if (format === 'email') return 'user@example.com';
      if (format === 'date') return '2024-01-01';
      if (format === 'date-time') return '2024-01-01T00:00:00Z';
      if (format === 'uuid') return '00000000-0000-0000-0000-000000000000';
      return 'string';
    case 'integer':
    case 'number':
      return 0;
    case 'boolean':
      return true;
    case 'array':
      return [];
    case 'object':
      return {};
    default:
      return null;
  }
}

function sanitizeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
