import React, { useState } from 'react';
import { StepResult } from '../../core';

interface StepResultItemProps {
  step: StepResult;
}

// Check if step type is an API request
function isApiRequestStep(stepType: string): boolean {
  return ['api_get', 'api_post', 'api_put', 'api_patch', 'api_delete'].includes(stepType);
}

// Format step type for display
function formatStepType(type: string): string {
  // Custom display names for certain blocks
  const displayNames: Record<string, string> = {
    // Logic blocks
    'logic_log': 'Log',
    'logic_set_variable': 'Set Variable',
    'logic_get_variable': 'Get Variable',
    // API blocks
    'api_set_header': 'Set Header',
    'api_set_headers': 'Set Headers',
    'api_clear_headers': 'Clear Headers',
    'api_assert_status': 'Assert Status',
    'api_assert_body_contains': 'Assert Body',
    'api_extract': 'Extract',
    'api_extract_jsonpath': 'Extract (JSONPath)',
    'api_extract_xpath': 'Extract (XPath)',
    // Web blocks
    'web_navigate': 'Navigate',
    'web_click': 'Click',
    'web_fill': 'Fill',
    'web_type': 'Type',
    'web_press_key': 'Press Key',
    'web_select': 'Select',
    'web_checkbox': 'Checkbox',
    'web_hover': 'Hover',
    'web_wait_for_element': 'Wait for Element',
    'web_wait_for_url': 'Wait for URL',
    'web_wait': 'Wait',
    'web_screenshot': 'Screenshot',
    'web_get_text': 'Get Text',
    'web_get_attribute': 'Get Attribute',
    'web_get_input_value': 'Get Input Value',
    'web_get_title': 'Get Title',
    'web_get_url': 'Get URL',
    'web_assert_visible': 'Assert Visible',
    'web_assert_not_visible': 'Assert Not Visible',
    'web_assert_text_contains': 'Assert Text Contains',
    'web_assert_text_equals': 'Assert Text Equals',
    'web_assert_url_contains': 'Assert URL Contains',
    'web_assert_title_contains': 'Assert Title Contains',
    'web_assert_enabled': 'Assert Enabled',
    'web_assert_checked': 'Assert Checked',
    // Auth/TOTP blocks
    'totp_generate': 'Generate TOTP',
    'totp_generate_from_numeric': 'Generate TOTP (Numeric)',
    'totp_setup': 'Setup TOTP',
    'totp_code': 'TOTP Code',
    'totp_time_remaining': 'TOTP Time Remaining',
    'totp_wait_for_new_code': 'Wait for New TOTP',
  };

  if (displayNames[type]) {
    return displayNames[type];
  }

  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Get a short summary for the step (shown in header)
function getStepSummary(step: StepResult): string | null {
  const output = step.output as Record<string, unknown> | undefined;

  // logic_log: no summary in header, message shown in expanded section
  if (step.stepType === 'logic_log') {
    return null;
  }

  // For all other blocks, return _summary if it exists
  return output?._summary as string || null;
}

// Check if step has expandable details
function hasExpandableDetails(step: StepResult): boolean {
  if (step.screenshot) return true;
  if (step.error?.stack) return true;
  if (isApiRequestStep(step.stepType) && step.output) return true;
  if (step.output !== undefined && step.output !== null) return true;
  return false;
}

export function StepResultItem({ step }: StepResultItemProps) {
  // Auto-expand failed steps to show screenshot and trace
  const [isExpanded, setIsExpanded] = useState(step.status === 'failed' && (!!step.screenshot || !!step.error?.stack));

  const isApiRequest = isApiRequestStep(step.stepType);
  const response = step.output as { status?: number; headers?: Record<string, string>; body?: unknown; _summary?: string; _requestHeaders?: Record<string, string>; _requestBody?: unknown } | undefined;
  const canExpand = hasExpandableDetails(step);
  const summary = getStepSummary(step);

  return (
    <div className={`step-result-item ${step.status}`}>
      <div
        className={`step-result-header ${canExpand ? 'expandable' : ''}`}
        onClick={() => canExpand && setIsExpanded(!isExpanded)}
      >
        <span className={`status-dot ${step.status}`} />
        <span className="step-result-type">{formatStepType(step.stepType)}</span>
        {summary && <span className="step-result-summary">{summary}</span>}
        <span className="step-result-duration">{step.duration}ms</span>
        {canExpand && (
          <span className="step-result-expand">
            {isExpanded ? '▼' : '▶'}
          </span>
        )}
      </div>

      {step.error && (
        <div className="step-result-error">{step.error.message}</div>
      )}

      {isExpanded && (
        <div className="step-result-details">
          {/* Screenshot on failure */}
          {step.screenshot && (
            <div className="step-screenshot">
              <div className="screenshot-label">Screenshot at failure:</div>
              <img
                src={step.screenshot}
                alt="Screenshot at failure"
                className="failure-screenshot"
                onClick={() => window.open(step.screenshot, '_blank')}
              />
            </div>
          )}

          {/* Stack trace for errors */}
          {step.error?.stack && (
            <details className="response-section" open>
              <summary>Stack Trace</summary>
              <pre className="response-pre stack-trace">
                {step.error.stack}
              </pre>
            </details>
          )}

          {isApiRequest && response ? (
            // API Response details
            <>
              {response._summary && (
                <div className="response-status">
                  <span className="response-label">Endpoint:</span>
                  <span className="response-endpoint">{response._summary}</span>
                </div>
              )}

              <div className="response-status">
                <span className="response-label">Status:</span>
                <span className={`response-status-code ${getStatusClass(response.status)}`}>
                  {response.status}
                </span>
              </div>

              <details className="response-section">
                <summary>Request Headers</summary>
                <pre className="response-pre">
                  {response._requestHeaders && Object.keys(response._requestHeaders).length > 0
                    ? JSON.stringify(response._requestHeaders, null, 2)
                    : '(none set)'}
                </pre>
              </details>

              {response._requestBody !== undefined && (
                <details className="response-section">
                  <summary>Request Body</summary>
                  <pre className="response-pre">
                    {typeof response._requestBody === 'string'
                      ? response._requestBody
                      : JSON.stringify(response._requestBody, null, 2)}
                  </pre>
                </details>
              )}

              {response.headers && Object.keys(response.headers).length > 0 && (
                <details className="response-section">
                  <summary>Response Headers</summary>
                  <pre className="response-pre">
                    {JSON.stringify(response.headers, null, 2)}
                  </pre>
                </details>
              )}

              {response.body !== undefined && (
                <details className="response-section" open>
                  <summary>Response Body</summary>
                  <pre className="response-pre">
                    {typeof response.body === 'string'
                      ? response.body
                      : JSON.stringify(response.body, null, 2)}
                  </pre>
                </details>
              )}
            </>
          ) : !step.screenshot && !step.error?.stack && (
            // Generic step output details (only if no screenshot/stack shown)
            <div className="step-output">
              <pre className="response-pre">
                {formatOutput(step.output, step.stepType)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getStatusClass(status?: number): string {
  if (!status) return '';
  if (status >= 200 && status < 300) return 'status-success';
  if (status >= 400 && status < 500) return 'status-client-error';
  if (status >= 500) return 'status-server-error';
  return '';
}

function formatOutput(output: unknown, stepType: string): string {
  if (output === undefined || output === null) return 'No output';

  // Special handling for log messages - show just the message
  if (stepType === 'logic_log' && typeof output === 'object' && output !== null) {
    const logOutput = output as Record<string, unknown>;
    if (logOutput._message) {
      return String(logOutput._message);
    }
  }

  if (typeof output === 'string') return output;
  if (typeof output === 'number' || typeof output === 'boolean') return String(output);

  // Filter out internal properties starting with _
  if (typeof output === 'object') {
    const filtered = Object.fromEntries(
      Object.entries(output as Record<string, unknown>)
        .filter(([key]) => !key.startsWith('_'))
    );
    if (Object.keys(filtered).length === 0) {
      return 'Completed';
    }
    return JSON.stringify(filtered, null, 2);
  }

  return JSON.stringify(output, null, 2);
}
