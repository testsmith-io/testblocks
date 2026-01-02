import React, { useState, useCallback, useEffect, useRef } from 'react';
import { TestStep } from '../../core';

interface RecordDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onStepsRecorded: (steps: TestStep[], mode: 'append' | 'new') => void;
}

type RecordingStage = 'url-input' | 'recording' | 'processing' | 'preview' | 'error';

interface RecordingOptions {
  testIdAttribute: string;
}

interface RecordingState {
  stage: RecordingStage;
  url: string;
  sessionId: string | null;
  steps: TestStep[];
  error: string | null;
  showAdvanced: boolean;
  options: RecordingOptions;
}

/**
 * Get a human-readable description of a step
 */
function getStepDescription(step: TestStep): string {
  switch (step.type) {
    case 'web_navigate':
      return `Navigate → ${step.params.URL}`;
    case 'web_click':
      return `Click → ${step.params.SELECTOR}`;
    case 'web_fill':
      return `Fill → ${step.params.SELECTOR}`;
    case 'web_type':
      return `Type → ${step.params.SELECTOR}`;
    case 'web_checkbox':
      return `${step.params.ACTION === 'check' ? 'Check' : 'Uncheck'} → ${step.params.SELECTOR}`;
    case 'web_select':
      return `Select → ${step.params.SELECTOR}`;
    case 'web_hover':
      return `Hover → ${step.params.SELECTOR}`;
    case 'web_press_key':
      return `Press Key → ${step.params.KEY}`;
    case 'web_wait_for_element':
      return `Wait for → ${step.params.SELECTOR}`;
    case 'web_wait':
      return `Wait → ${step.params.DURATION}ms`;
    default:
      return step.type;
  }
}

export function RecordDialog({ isOpen, onClose, onStepsRecorded }: RecordDialogProps) {
  const [state, setState] = useState<RecordingState>({
    stage: 'url-input',
    url: 'https://',
    sessionId: null,
    steps: [],
    error: null,
    showAdvanced: false,
    options: {
      testIdAttribute: 'data-testid',
    },
  });

  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch global testIdAttribute and reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      // Fetch global settings to get the testIdAttribute
      fetch('/api/globals')
        .then(res => res.json())
        .then(data => {
          setState({
            stage: 'url-input',
            url: 'https://',
            sessionId: null,
            steps: [],
            error: null,
            showAdvanced: false,
            options: {
              testIdAttribute: data.testIdAttribute || 'data-testid',
            },
          });
        })
        .catch(() => {
          // Fallback to defaults if fetch fails
          setState({
            stage: 'url-input',
            url: 'https://',
            sessionId: null,
            steps: [],
            error: null,
            showAdvanced: false,
            options: {
              testIdAttribute: 'data-testid',
            },
          });
        });
    }
    return () => {
      // Clean up polling on unmount
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [isOpen]);

  // Poll for session status when recording
  useEffect(() => {
    if (state.stage === 'recording' && state.sessionId) {
      pollingRef.current = setInterval(async () => {
        try {
          const response = await fetch(`/api/record/status/${state.sessionId}`);
          const data = await response.json();

          if (data.status === 'completed') {
            // Browser was closed, stop recording
            handleStopRecording();
          } else if (data.status === 'error') {
            setState(prev => ({
              ...prev,
              stage: 'error',
              error: data.error || 'Recording failed',
            }));
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
          }
        } catch (err) {
          console.error('Failed to poll recording status:', err);
        }
      }, 2000);

      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.stage, state.sessionId]);

  const handleStartRecording = useCallback(async () => {
    if (!state.url || state.url === 'https://') {
      setState(prev => ({ ...prev, error: 'Please enter a valid URL' }));
      return;
    }

    setState(prev => ({ ...prev, stage: 'processing', error: null }));

    try {
      const response = await fetch('/api/record/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: state.url,
          testIdAttribute: state.options.testIdAttribute || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to start recording');
      }

      setState(prev => ({
        ...prev,
        stage: 'recording',
        sessionId: data.sessionId,
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        stage: 'error',
        error: (err as Error).message,
      }));
    }
  }, [state.url, state.options.testIdAttribute]);

  const handleStopRecording = useCallback(async () => {
    if (!state.sessionId) return;

    // Stop polling
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    setState(prev => ({ ...prev, stage: 'processing' }));

    try {
      const response = await fetch('/api/record/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: state.sessionId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to stop recording');
      }

      setState(prev => ({
        ...prev,
        stage: 'preview',
        steps: data.steps || [],
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        stage: 'error',
        error: (err as Error).message,
      }));
    }
  }, [state.sessionId]);

  const handleAddToCurrent = useCallback(() => {
    onStepsRecorded(state.steps, 'append');
    onClose();
  }, [state.steps, onStepsRecorded, onClose]);

  const handleCreateNew = useCallback(() => {
    onStepsRecorded(state.steps, 'new');
    onClose();
  }, [state.steps, onStepsRecorded, onClose]);

  const handleClose = useCallback(() => {
    // If recording, ask for confirmation
    if (state.stage === 'recording') {
      if (!confirm('Recording is in progress. Are you sure you want to cancel?')) {
        return;
      }
      // Try to stop the recording gracefully
      if (state.sessionId) {
        fetch('/api/record/stop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: state.sessionId }),
        }).catch(() => {});
      }
    }
    onClose();
  }, [state.stage, state.sessionId, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal record-dialog" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Record Browser Actions</h2>
          <button className="btn-close" onClick={handleClose}>&times;</button>
        </div>

        <div className="modal-body">
          {/* URL Input Stage */}
          {state.stage === 'url-input' && (
            <div className="record-url-input">
              <p>Enter the starting URL for recording:</p>
              <input
                type="url"
                className="url-input"
                value={state.url}
                onChange={(e) => setState(prev => ({ ...prev, url: e.target.value, error: null }))}
                placeholder="https://example.com"
                autoFocus
              />
              {state.error && (
                <div className="record-error">{state.error}</div>
              )}
              <p className="record-hint">
                A browser window will open where you can perform actions.
                Close the browser when you're done recording.
              </p>

              {/* Advanced Options */}
              <div className="advanced-options">
                <button
                  type="button"
                  className="advanced-toggle"
                  onClick={() => setState(prev => ({ ...prev, showAdvanced: !prev.showAdvanced }))}
                >
                  <span className="toggle-icon">{state.showAdvanced ? '▼' : '▶'}</span>
                  Advanced Options
                </button>
                {state.showAdvanced && (
                  <div className="advanced-content">
                    <div className="option-row">
                      <label htmlFor="testIdAttribute">Test ID Attribute:</label>
                      <input
                        id="testIdAttribute"
                        type="text"
                        className="option-input"
                        value={state.options.testIdAttribute}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          setState(prev => ({
                            ...prev,
                            options: { ...prev.options, testIdAttribute: newValue }
                          }));
                          // Save globally (debounced save on blur instead)
                        }}
                        onBlur={(e) => {
                          // Save the test ID attribute globally when field loses focus
                          const value = e.target.value.trim();
                          if (value) {
                            fetch('/api/globals/test-id-attribute', {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ testIdAttribute: value }),
                            }).catch(console.error);
                          }
                        }}
                        placeholder="data-testid"
                      />
                    </div>
                    <p className="option-hint">
                      Attribute used to identify elements (e.g., data-testid, data-test, data-cy).
                      This setting is saved globally.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recording Stage */}
          {state.stage === 'recording' && (
            <div className="record-status recording">
              <div className="recording-indicator" />
              <div className="recording-info">
                <h3>Recording in progress...</h3>
                <p>Perform your test actions in the browser window.</p>
                <p>Close the browser or click "Stop Recording" when done.</p>
              </div>
            </div>
          )}

          {/* Processing Stage */}
          {state.stage === 'processing' && (
            <div className="record-status processing">
              <div className="processing-spinner" />
              <p>Processing recorded actions...</p>
            </div>
          )}

          {/* Preview Stage */}
          {state.stage === 'preview' && (
            <div className="record-preview">
              {state.steps.length === 0 ? (
                <div className="record-empty">
                  <p>No actions were recorded.</p>
                  <p className="record-hint">
                    Make sure to interact with elements in the browser
                    (click, type, navigate, etc.)
                  </p>
                </div>
              ) : (
                <>
                  <h3>Recorded {state.steps.length} action{state.steps.length !== 1 ? 's' : ''}:</h3>
                  <div className="steps-preview">
                    {state.steps.map((step, index) => (
                      <div key={step.id} className="step-preview-item">
                        <span className="step-number">{index + 1}.</span>
                        <span className="step-description">{getStepDescription(step)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Error Stage */}
          {state.stage === 'error' && (
            <div className="record-error-state">
              <h3>Recording Failed</h3>
              <p className="record-error">{state.error}</p>
              <button
                className="btn btn-secondary"
                onClick={() => setState(prev => ({ ...prev, stage: 'url-input', error: null }))}
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

          {state.stage === 'url-input' && (
            <button className="btn btn-primary" onClick={handleStartRecording}>
              Start Recording
            </button>
          )}

          {state.stage === 'recording' && (
            <button className="btn btn-warning" onClick={handleStopRecording}>
              Stop Recording
            </button>
          )}

          {state.stage === 'preview' && state.steps.length > 0 && (
            <>
              <button className="btn btn-secondary" onClick={handleAddToCurrent}>
                Add to Current Test
              </button>
              <button className="btn btn-primary" onClick={handleCreateNew}>
                Create New Test
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
