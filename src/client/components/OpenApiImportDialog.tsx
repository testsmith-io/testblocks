import React, { useState, useCallback, useRef } from 'react';
import { TestFile } from '../../core';

interface OpenApiImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (files: GeneratedFile[]) => void;
  hasProjectOpen?: boolean;
}

type ImportStage = 'input' | 'loading' | 'selection' | 'options' | 'preview' | 'error';

interface EndpointInfo {
  operationId: string;
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  summary?: string;
  description?: string;
  tags: string[];
  deprecated?: boolean;
  hasRequestBody: boolean;
  responses: string[];
}

interface SpecInfo {
  info: { title: string; version: string; description?: string };
  servers: { url: string; description?: string }[];
  endpoints: EndpointInfo[];
  tags: { name: string; description?: string }[];
}

interface ImportOptions {
  baseUrl: string;
  fileStrategy: 'single' | 'per-tag' | 'per-path';
  includeExamples: boolean;
  generateAssertions: boolean;
  authVariablePrefix: string;
}

export interface GeneratedFile {
  fileName: string;
  testFile: TestFile;
  testCount: number;
}

interface ImportState {
  stage: ImportStage;
  inputMode: 'url' | 'file';
  specUrl: string;
  specContent: string | null;
  spec: SpecInfo | null;
  selectedEndpoints: Set<string>;
  options: ImportOptions;
  generatedFiles: GeneratedFile[];
  error: string | null;
  // Filters
  methodFilter: string;
  tagFilter: string;
  searchQuery: string;
}

const METHOD_COLORS: Record<string, string> = {
  get: '#4CAF50',
  post: '#2196F3',
  put: '#FF9800',
  patch: '#9C27B0',
  delete: '#F44336',
};

export function OpenApiImportDialog({ isOpen, onClose, onImport, hasProjectOpen = false }: OpenApiImportDialogProps) {
  const [state, setState] = useState<ImportState>({
    stage: 'input',
    inputMode: 'url',
    specUrl: '',
    specContent: null,
    spec: null,
    selectedEndpoints: new Set(),
    options: {
      baseUrl: '',
      fileStrategy: 'single',
      includeExamples: true,
      generateAssertions: true,
      authVariablePrefix: 'auth',
    },
    generatedFiles: [],
    error: null,
    methodFilter: '',
    tagFilter: '',
    searchQuery: '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = useCallback(() => {
    setState({
      stage: 'input',
      inputMode: 'url',
      specUrl: '',
      specContent: null,
      spec: null,
      selectedEndpoints: new Set(),
      options: {
        baseUrl: '',
        fileStrategy: 'single',
        includeExamples: true,
        generateAssertions: true,
        authVariablePrefix: 'auth',
      },
      generatedFiles: [],
      error: null,
      methodFilter: '',
      tagFilter: '',
      searchQuery: '',
    });
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  const handleParseSpec = useCallback(async () => {
    setState(prev => ({ ...prev, stage: 'loading', error: null }));

    try {
      const endpoint = state.inputMode === 'url'
        ? '/api/openapi/parse'
        : '/api/openapi/parse-content';

      const body = state.inputMode === 'url'
        ? { url: state.specUrl }
        : { content: state.specContent };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to parse spec');
      }

      // Pre-select all endpoints and set baseUrl from spec
      const allEndpoints = new Set(data.endpoints.map((e: EndpointInfo) => e.operationId));
      const baseUrl = data.servers?.[0]?.url || '';

      setState(prev => ({
        ...prev,
        stage: 'selection',
        spec: data,
        selectedEndpoints: allEndpoints,
        options: {
          ...prev.options,
          baseUrl,
        },
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        stage: 'error',
        error: (err as Error).message,
      }));
    }
  }, [state.inputMode, state.specUrl, state.specContent]);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setState(prev => ({
        ...prev,
        specContent: content,
      }));
    };
    reader.readAsText(file);
  }, []);

  const handleToggleEndpoint = useCallback((operationId: string) => {
    setState(prev => {
      const newSelected = new Set(prev.selectedEndpoints);
      if (newSelected.has(operationId)) {
        newSelected.delete(operationId);
      } else {
        newSelected.add(operationId);
      }
      return { ...prev, selectedEndpoints: newSelected };
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setState(prev => {
      const filteredEndpoints = getFilteredEndpoints(prev);
      const newSelected = new Set(prev.selectedEndpoints);
      filteredEndpoints.forEach(e => newSelected.add(e.operationId));
      return { ...prev, selectedEndpoints: newSelected };
    });
  }, []);

  const handleDeselectAll = useCallback(() => {
    setState(prev => {
      const filteredEndpoints = getFilteredEndpoints(prev);
      const newSelected = new Set(prev.selectedEndpoints);
      filteredEndpoints.forEach(e => newSelected.delete(e.operationId));
      return { ...prev, selectedEndpoints: newSelected };
    });
  }, []);

  const getFilteredEndpoints = (currentState: ImportState): EndpointInfo[] => {
    if (!currentState.spec) return [];

    return currentState.spec.endpoints.filter(endpoint => {
      // Method filter
      if (currentState.methodFilter && endpoint.method !== currentState.methodFilter) {
        return false;
      }

      // Tag filter
      if (currentState.tagFilter && !endpoint.tags.includes(currentState.tagFilter)) {
        return false;
      }

      // Search query
      if (currentState.searchQuery) {
        const query = currentState.searchQuery.toLowerCase();
        const matchesPath = endpoint.path.toLowerCase().includes(query);
        const matchesSummary = endpoint.summary?.toLowerCase().includes(query);
        const matchesOperationId = endpoint.operationId.toLowerCase().includes(query);
        if (!matchesPath && !matchesSummary && !matchesOperationId) {
          return false;
        }
      }

      return true;
    });
  };

  const handleGenerateTests = useCallback(async () => {
    setState(prev => ({ ...prev, stage: 'loading', error: null }));

    try {
      const body: Record<string, unknown> = {
        selectedEndpoints: Array.from(state.selectedEndpoints),
        options: state.options,
      };

      if (state.inputMode === 'url') {
        body.url = state.specUrl;
      } else {
        body.content = state.specContent;
      }

      const response = await fetch('/api/openapi/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to generate tests');
      }

      setState(prev => ({
        ...prev,
        stage: 'preview',
        generatedFiles: data.files,
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        stage: 'error',
        error: (err as Error).message,
      }));
    }
  }, [state.selectedEndpoints, state.options, state.inputMode, state.specUrl, state.specContent]);

  const handleImport = useCallback(() => {
    onImport(state.generatedFiles);
    handleClose();
  }, [state.generatedFiles, onImport, handleClose]);

  if (!isOpen) return null;

  const filteredEndpoints = getFilteredEndpoints(state);
  const allTags = state.spec?.tags.map(t => t.name) || [];
  const uniqueTags = [...new Set([...allTags, ...state.spec?.endpoints.flatMap(e => e.tags) || []])];

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal openapi-dialog" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Import from OpenAPI</h2>
          <button className="btn-close" onClick={handleClose}>&times;</button>
        </div>

        <div className="modal-body">
          {/* Input Stage */}
          {state.stage === 'input' && (
            <div className="openapi-input-stage">
              <div className="input-mode-tabs">
                <button
                  className={`tab ${state.inputMode === 'url' ? 'active' : ''}`}
                  onClick={() => setState(prev => ({ ...prev, inputMode: 'url' }))}
                >
                  From URL
                </button>
                <button
                  className={`tab ${state.inputMode === 'file' ? 'active' : ''}`}
                  onClick={() => setState(prev => ({ ...prev, inputMode: 'file' }))}
                >
                  From File
                </button>
              </div>

              {state.inputMode === 'url' ? (
                <div className="url-input-section">
                  <label>OpenAPI Specification URL:</label>
                  <input
                    type="url"
                    className="url-input"
                    value={state.specUrl}
                    onChange={(e) => setState(prev => ({ ...prev, specUrl: e.target.value }))}
                    placeholder="https://api.example.com/openapi.json"
                    autoFocus
                  />
                  <p className="input-hint">
                    Supports OpenAPI 3.x and Swagger 2.0 specifications in JSON or YAML format.
                  </p>
                </div>
              ) : (
                <div className="file-input-section">
                  <label>Upload OpenAPI Specification:</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,.yaml,.yml"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                  <button
                    className="btn btn-secondary file-select-btn"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Select File
                  </button>
                  {state.specContent && (
                    <span className="file-selected">File loaded ({state.specContent.length} bytes)</span>
                  )}
                  <p className="input-hint">
                    Select a .json or .yaml file containing your OpenAPI specification.
                  </p>
                </div>
              )}

              {state.error && (
                <div className="openapi-error">{state.error}</div>
              )}
            </div>
          )}

          {/* Loading Stage */}
          {state.stage === 'loading' && (
            <div className="openapi-loading-stage">
              <div className="processing-spinner" />
              <p>Processing OpenAPI specification...</p>
            </div>
          )}

          {/* Selection Stage */}
          {state.stage === 'selection' && state.spec && (
            <div className="openapi-selection-stage">
              <div className="spec-info">
                <h3>{state.spec.info.title} <span className="version">v{state.spec.info.version}</span></h3>
                {state.spec.info.description && (
                  <p className="spec-description">{state.spec.info.description}</p>
                )}
              </div>

              <div className="endpoint-filters">
                <div className="filter-row">
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search endpoints..."
                    value={state.searchQuery}
                    onChange={(e) => setState(prev => ({ ...prev, searchQuery: e.target.value }))}
                  />
                  <select
                    className="filter-select"
                    value={state.methodFilter}
                    onChange={(e) => setState(prev => ({ ...prev, methodFilter: e.target.value }))}
                  >
                    <option value="">All Methods</option>
                    <option value="get">GET</option>
                    <option value="post">POST</option>
                    <option value="put">PUT</option>
                    <option value="patch">PATCH</option>
                    <option value="delete">DELETE</option>
                  </select>
                  <select
                    className="filter-select"
                    value={state.tagFilter}
                    onChange={(e) => setState(prev => ({ ...prev, tagFilter: e.target.value }))}
                  >
                    <option value="">All Tags</option>
                    {uniqueTags.map(tag => (
                      <option key={tag} value={tag}>{tag}</option>
                    ))}
                  </select>
                </div>
                <div className="selection-actions">
                  <button className="btn btn-small" onClick={handleSelectAll}>Select All</button>
                  <button className="btn btn-small" onClick={handleDeselectAll}>Deselect All</button>
                  <span className="selection-count">
                    {state.selectedEndpoints.size} of {state.spec.endpoints.length} selected
                  </span>
                </div>
              </div>

              <div className="endpoint-list">
                {filteredEndpoints.map(endpoint => (
                  <div
                    key={endpoint.operationId}
                    className={`endpoint-item ${state.selectedEndpoints.has(endpoint.operationId) ? 'selected' : ''} ${endpoint.deprecated ? 'deprecated' : ''}`}
                    onClick={() => handleToggleEndpoint(endpoint.operationId)}
                  >
                    <input
                      type="checkbox"
                      checked={state.selectedEndpoints.has(endpoint.operationId)}
                      onChange={() => handleToggleEndpoint(endpoint.operationId)}
                    />
                    <span
                      className="method-badge"
                      style={{ backgroundColor: METHOD_COLORS[endpoint.method] }}
                    >
                      {endpoint.method.toUpperCase()}
                    </span>
                    <span className="endpoint-path">{endpoint.path}</span>
                    {endpoint.summary && (
                      <span className="endpoint-summary">{endpoint.summary}</span>
                    )}
                    {endpoint.deprecated && (
                      <span className="deprecated-badge">Deprecated</span>
                    )}
                    {endpoint.tags.length > 0 && (
                      <span className="endpoint-tags">
                        {endpoint.tags.map(tag => (
                          <span key={tag} className="tag-badge">{tag}</span>
                        ))}
                      </span>
                    )}
                  </div>
                ))}
                {filteredEndpoints.length === 0 && (
                  <div className="no-endpoints">No endpoints match your filters</div>
                )}
              </div>
            </div>
          )}

          {/* Options Stage */}
          {state.stage === 'options' && (
            <div className="openapi-options-stage">
              <h3>Import Options</h3>

              <div className="option-group">
                <label htmlFor="baseUrl">Base URL:</label>
                <input
                  id="baseUrl"
                  type="text"
                  className="option-input"
                  value={state.options.baseUrl}
                  onChange={(e) => setState(prev => ({
                    ...prev,
                    options: { ...prev.options, baseUrl: e.target.value }
                  }))}
                  placeholder="https://api.example.com"
                />
                <p className="option-hint">
                  The base URL for API requests. Will be stored as a variable.
                </p>
              </div>

              <div className="option-group">
                <label>File Strategy:</label>
                <div className="radio-group">
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="fileStrategy"
                      value="single"
                      checked={state.options.fileStrategy === 'single'}
                      onChange={() => setState(prev => ({
                        ...prev,
                        options: { ...prev.options, fileStrategy: 'single' }
                      }))}
                    />
                    <span>Single file</span>
                    <span className="option-desc">All tests in one file</span>
                  </label>
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="fileStrategy"
                      value="per-tag"
                      checked={state.options.fileStrategy === 'per-tag'}
                      onChange={() => setState(prev => ({
                        ...prev,
                        options: { ...prev.options, fileStrategy: 'per-tag' }
                      }))}
                    />
                    <span>Per tag</span>
                    <span className="option-desc">One file per OpenAPI tag</span>
                  </label>
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="fileStrategy"
                      value="per-path"
                      checked={state.options.fileStrategy === 'per-path'}
                      onChange={() => setState(prev => ({
                        ...prev,
                        options: { ...prev.options, fileStrategy: 'per-path' }
                      }))}
                    />
                    <span>Per path</span>
                    <span className="option-desc">One file per base path</span>
                  </label>
                </div>
              </div>

              <div className="option-group checkbox-group">
                <label className="checkbox-option">
                  <input
                    type="checkbox"
                    checked={state.options.includeExamples}
                    onChange={(e) => setState(prev => ({
                      ...prev,
                      options: { ...prev.options, includeExamples: e.target.checked }
                    }))}
                  />
                  <span>Include example payloads</span>
                </label>
                <p className="option-hint">
                  Use example values from the spec for request bodies.
                </p>
              </div>

              <div className="option-group checkbox-group">
                <label className="checkbox-option">
                  <input
                    type="checkbox"
                    checked={state.options.generateAssertions}
                    onChange={(e) => setState(prev => ({
                      ...prev,
                      options: { ...prev.options, generateAssertions: e.target.checked }
                    }))}
                  />
                  <span>Generate status assertions</span>
                </label>
                <p className="option-hint">
                  Add status code assertions based on documented responses.
                </p>
              </div>
            </div>
          )}

          {/* Preview Stage */}
          {state.stage === 'preview' && (
            <div className="openapi-preview-stage">
              <h3>Preview Generated Tests</h3>
              <p className="preview-summary">
                {state.generatedFiles.length} file(s) will be created with{' '}
                {state.generatedFiles.reduce((sum, f) => sum + f.testCount, 0)} test(s) total.
              </p>

              {!hasProjectOpen && (
                <div className="openapi-warning">
                  No project folder is open. Please open a folder first using "Open Folder" button, then try importing again.
                </div>
              )}

              <div className="generated-files-list">
                {state.generatedFiles.map((file, index) => (
                  <div key={index} className="generated-file-item">
                    <div className="file-header">
                      <span className="file-name">{file.fileName}</span>
                      <span className="test-count">{file.testCount} test(s)</span>
                    </div>
                    <div className="file-tests">
                      {file.testFile.tests.slice(0, 5).map(test => (
                        <div key={test.id} className="preview-test">
                          {test.name}
                        </div>
                      ))}
                      {file.testFile.tests.length > 5 && (
                        <div className="more-tests">
                          +{file.testFile.tests.length - 5} more tests...
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Stage */}
          {state.stage === 'error' && (
            <div className="openapi-error-stage">
              <h3>Import Failed</h3>
              <div className="openapi-error">{state.error}</div>
              <button
                className="btn btn-secondary"
                onClick={() => setState(prev => ({ ...prev, stage: 'input', error: null }))}
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={handleClose}>
            Cancel
          </button>

          {state.stage === 'input' && (
            <button
              className="btn btn-primary"
              onClick={handleParseSpec}
              disabled={state.inputMode === 'url' ? !state.specUrl : !state.specContent}
            >
              Parse Specification
            </button>
          )}

          {state.stage === 'selection' && (
            <>
              <button
                className="btn btn-secondary"
                onClick={() => setState(prev => ({ ...prev, stage: 'input' }))}
              >
                Back
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setState(prev => ({ ...prev, stage: 'options' }))}
                disabled={state.selectedEndpoints.size === 0}
              >
                Configure Options ({state.selectedEndpoints.size} selected)
              </button>
            </>
          )}

          {state.stage === 'options' && (
            <>
              <button
                className="btn btn-secondary"
                onClick={() => setState(prev => ({ ...prev, stage: 'selection' }))}
              >
                Back
              </button>
              <button
                className="btn btn-primary"
                onClick={handleGenerateTests}
              >
                Generate Tests
              </button>
            </>
          )}

          {state.stage === 'preview' && (
            <>
              <button
                className="btn btn-secondary"
                onClick={() => setState(prev => ({ ...prev, stage: 'options' }))}
              >
                Back
              </button>
              <button
                className="btn btn-primary"
                onClick={handleImport}
                disabled={!hasProjectOpen}
                title={!hasProjectOpen ? 'Open a project folder first' : undefined}
              >
                Import {state.generatedFiles.length} File(s)
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
