/**
 * Utility functions for reporters
 */

/**
 * Generate timestamp string for filenames (e.g., 2024-01-15T14-30-45)
 */
export function getTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

/**
 * Escape XML special characters
 */
export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Format step type for display (same as StepResultItem.tsx)
 */
export function formatStepType(type: string): string {
  const displayNames: Record<string, string> = {
    'logic_log': 'Log',
    'logic_set_variable': 'Set Variable',
    'logic_get_variable': 'Get Variable',
    'api_set_header': 'Set Header',
    'api_set_headers': 'Set Headers',
    'api_clear_headers': 'Clear Headers',
    'api_assert_status': 'Assert Status',
    'api_assert_body_contains': 'Assert Body',
    'api_extract': 'Extract',
    'api_extract_jsonpath': 'Extract (JSONPath)',
    'api_extract_xpath': 'Extract (XPath)',
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

/**
 * Get step summary from output
 */
export function getStepSummary(stepType: string, output: unknown): string | null {
  if (!output || typeof output !== 'object') return null;
  const out = output as Record<string, unknown>;
  return out._summary as string || null;
}

/**
 * Check if step is an API request
 */
export function isApiRequestStep(stepType: string): boolean {
  return ['api_get', 'api_post', 'api_put', 'api_patch', 'api_delete'].includes(stepType);
}

/**
 * Format step output for display
 */
export function formatStepOutput(output: unknown, stepType: string): string {
  if (output === undefined || output === null) return '';

  if (stepType === 'logic_log' && typeof output === 'object' && output !== null) {
    const logOutput = output as Record<string, unknown>;
    if (logOutput._message) {
      return String(logOutput._message);
    }
  }

  if (typeof output === 'string') return output;
  if (typeof output === 'number' || typeof output === 'boolean') return String(output);

  if (typeof output === 'object') {
    const filtered = Object.fromEntries(
      Object.entries(output as Record<string, unknown>)
        .filter(([key]) => !key.startsWith('_'))
    );
    if (Object.keys(filtered).length === 0) {
      return '';
    }
    return JSON.stringify(filtered, null, 2);
  }

  return JSON.stringify(output, null, 2);
}
