import React, { useState } from 'react';

interface HelpDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface HelpSection {
  id: string;
  title: string;
  content: React.ReactNode;
}

const HELP_SECTIONS: HelpSection[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    content: (
      <>
        <h3>Welcome to TestBlocks</h3>
        <p>TestBlocks is a visual test automation tool that lets you create browser and API tests using drag-and-drop blocks.</p>

        <div className="help-feature">
          <h4>Opening a Project</h4>
          <ol>
            <li>Click <strong>Open Folder</strong> to select your project directory</li>
            <li>TestBlocks will scan for <code>.testblocks.json</code> files</li>
            <li>Click any file in the sidebar to open it</li>
          </ol>
        </div>

        <div className="help-feature">
          <h4>Creating a Test</h4>
          <ol>
            <li>Click <strong>+ Add Test</strong> in the sidebar</li>
            <li>Give your test a name by clicking the test name</li>
            <li>Drag blocks from the left toolbox into the workspace</li>
            <li>Connect blocks vertically to create your test flow</li>
          </ol>
        </div>

        <div className="help-feature">
          <h4>Running Tests</h4>
          <ol>
            <li>Click the <strong>Run</strong> button next to a test to run just that test</li>
            <li>Click <strong>Run All Tests</strong> to run all tests in the file</li>
            <li>Toggle <strong>Headless</strong> off to see the browser while testing</li>
            <li>View results in the right panel</li>
          </ol>
        </div>

        <div className="help-feature">
          <h4>Saving Your Work</h4>
          <ol>
            <li>Click <strong>Save</strong> to save changes to the current file</li>
            <li>Files are saved as <code>.testblocks.json</code> format</li>
          </ol>
        </div>
      </>
    ),
  },
  {
    id: 'web-testing',
    title: 'Web Testing',
    content: (
      <>
        <h3>Browser Automation</h3>
        <p>Use Web blocks to automate browser interactions like clicking, typing, and navigating.</p>

        <div className="help-feature">
          <h4>Navigating to a Page</h4>
          <ol>
            <li>Drag the <strong>Navigate</strong> block into your test</li>
            <li>Enter the URL (e.g., <code>https://example.com</code>)</li>
            <li>Use variables: <code>{"${baseUrl}"}/login</code></li>
          </ol>
        </div>

        <div className="help-feature">
          <h4>Clicking Elements</h4>
          <ol>
            <li>Use the <strong>Click</strong> block</li>
            <li>Enter a CSS selector: <code>#submit-button</code> or <code>.btn-primary</code></li>
            <li>Or use text: <code>text=Sign In</code></li>
          </ol>
        </div>

        <div className="help-feature">
          <h4>Filling Forms</h4>
          <ol>
            <li><strong>Fill</strong> - clears the field first, then types the value</li>
            <li><strong>Type</strong> - types character by character (useful for autocomplete)</li>
            <li>Example: Fill <code>#email</code> with <code>user@example.com</code></li>
          </ol>
        </div>

        <div className="help-feature">
          <h4>Waiting for Elements</h4>
          <ol>
            <li><strong>Wait for Element</strong> - wait until element is visible/hidden</li>
            <li><strong>Wait for URL</strong> - wait for navigation to complete</li>
            <li><strong>Wait</strong> - pause for a fixed time (use sparingly)</li>
          </ol>
        </div>

        <div className="help-feature">
          <h4>Assertions</h4>
          <ul>
            <li><strong>Assert Visible</strong> - check element exists on page</li>
            <li><strong>Assert Text Contains</strong> - verify text content</li>
            <li><strong>Assert URL Contains</strong> - verify current URL</li>
          </ul>
        </div>

        <div className="help-tip">
          <strong>Tip:</strong> Right-click in Chrome DevTools and select "Copy selector" to get CSS selectors for elements.
        </div>
      </>
    ),
  },
  {
    id: 'api-testing',
    title: 'API Testing',
    content: (
      <>
        <h3>REST API Testing</h3>
        <p>Test APIs directly without a browser using API blocks.</p>

        <div className="help-feature">
          <h4>Making a GET Request</h4>
          <ol>
            <li>Drag the <strong>GET</strong> block into your test</li>
            <li>Enter the URL: <code>/api/users</code> (relative) or full URL</li>
            <li>The response is automatically stored for assertions</li>
          </ol>
        </div>

        <div className="help-feature">
          <h4>Making POST/PUT/PATCH Requests</h4>
          <ol>
            <li>Use the <strong>POST</strong>, <strong>PUT</strong>, or <strong>PATCH</strong> blocks</li>
            <li>Connect a <strong>JSON Body</strong> block to provide the request body</li>
            <li>Example body: <code>{`{"name": "John", "email": "john@test.com"}`}</code></li>
          </ol>
        </div>

        <div className="help-feature">
          <h4>Setting Headers</h4>
          <ol>
            <li><strong>Set Header</strong> - set a single header (e.g., <code>Authorization: Bearer token</code>)</li>
            <li><strong>Headers</strong> block - create headers with built-in auth options (Bearer, Basic, API Key)</li>
            <li>Headers persist across requests until cleared</li>
          </ol>
        </div>

        <div className="help-feature">
          <h4>Extracting Response Data</h4>
          <ol>
            <li>Use <strong>Extract JSONPath</strong> to get values from JSON responses</li>
            <li>Example: <code>$.data.id</code> gets the id from <code>{`{"data": {"id": 123}}`}</code></li>
            <li>Store in a variable for use in later requests</li>
          </ol>
        </div>

        <div className="help-feature">
          <h4>Assertions</h4>
          <ul>
            <li><strong>Assert Status</strong> - check response code (200, 201, 404, etc.)</li>
            <li><strong>Assert Body Contains</strong> - verify response contains text</li>
          </ul>
        </div>

        <div className="help-tip">
          <strong>JSONPath Examples:</strong><br/>
          <code>$.name</code> - root level property<br/>
          <code>$.users[0].email</code> - first user's email<br/>
          <code>$.data[*].id</code> - all ids in data array
        </div>
      </>
    ),
  },
  {
    id: 'variables',
    title: 'Variables',
    content: (
      <>
        <h3>Using Variables</h3>
        <p>Variables let you store and reuse values across your tests.</p>

        <div className="help-feature">
          <h4>Defining Variables</h4>
          <ol>
            <li>Click <strong>+ Add Variable</strong> in the sidebar</li>
            <li>Enter a name (e.g., <code>baseUrl</code>)</li>
            <li>Set the default value</li>
            <li>Choose the type (string, number, boolean, object, array)</li>
          </ol>
        </div>

        <div className="help-feature">
          <h4>Using Variables in Text Fields</h4>
          <p>Reference variables using <code>{"${variableName}"}</code> syntax:</p>
          <ul>
            <li>URL: <code>{"${baseUrl}"}/api/users</code></li>
            <li>Email: <code>{"${username}"}@example.com</code></li>
            <li>Nested: <code>{"${user.profile.name}"}</code></li>
          </ul>
        </div>

        <div className="help-feature">
          <h4>Setting Variables in Tests</h4>
          <ol>
            <li>Use the <strong>Set Variable</strong> block from the Logic category</li>
            <li>Store extracted API responses, computed values, etc.</li>
            <li>Variables are shared across all tests in a file</li>
          </ol>
        </div>

        <div className="help-feature">
          <h4>Getting Variable Values</h4>
          <ul>
            <li>Use <strong>Get Variable</strong> block when you need the value as a block</li>
            <li>Use <code>{"${varName}"}</code> syntax in text fields</li>
          </ul>
        </div>

        <div className="help-tip">
          <strong>Tip:</strong> Define environment-specific variables like <code>baseUrl</code> to easily switch between dev/staging/production.
        </div>
      </>
    ),
  },
  {
    id: 'data-driven',
    title: 'Data-Driven Testing',
    content: (
      <>
        <h3>Data-Driven Testing</h3>
        <p>Run the same test with multiple sets of data automatically.</p>

        <div className="help-feature">
          <h4>How It Works</h4>
          <ol>
            <li>Define a data set with multiple rows</li>
            <li>Your test runs once for each row</li>
            <li>Access current row values using <strong>Get Current Value</strong></li>
          </ol>
        </div>

        <div className="help-feature">
          <h4>Defining Data</h4>
          <p>Use the <strong>Define Data</strong> block with JSON array:</p>
          <pre className="help-code">{`[
  {"username": "user1", "password": "pass1"},
  {"username": "user2", "password": "pass2"},
  {"username": "user3", "password": "pass3"}
]`}</pre>
        </div>

        <div className="help-feature">
          <h4>Using Data Values</h4>
          <ol>
            <li>Use <strong>Get Current Value</strong> block with field name</li>
            <li>Example: Get Current Value <code>username</code></li>
            <li>Or use in text: <code>{"${data.username}"}</code></li>
          </ol>
        </div>

        <div className="help-feature">
          <h4>Other Data Blocks</h4>
          <ul>
            <li><strong>Data Table</strong> - define data with headers and rows</li>
            <li><strong>CSV Data</strong> - parse CSV-style data</li>
            <li><strong>Range</strong> - generate number sequences (1 to 10)</li>
            <li><strong>For Each Data</strong> - iterate within a test</li>
          </ul>
        </div>

        <div className="help-tip">
          <strong>Example Use Case:</strong> Test login with valid users, invalid passwords, empty fields, and special characters all in one test.
        </div>
      </>
    ),
  },
  {
    id: 'custom-blocks',
    title: 'Custom Blocks',
    content: (
      <>
        <h3>Creating Reusable Blocks</h3>
        <p>Turn any sequence of blocks into a reusable custom block.</p>

        <div className="help-feature">
          <h4>Creating a Custom Block</h4>
          <ol>
            <li>Build your block sequence in the workspace</li>
            <li><strong>Select multiple blocks</strong> using Shift+Click or Ctrl/Cmd+Click</li>
            <li>Right-click and choose <strong>"Create Reusable Block"</strong></li>
            <li>Name your block (e.g., "Login", "Add to Cart")</li>
            <li>Choose which values should be parameters</li>
            <li>Click <strong>Create Block</strong></li>
          </ol>
        </div>

        <div className="help-feature">
          <h4>Using Custom Blocks</h4>
          <ol>
            <li>Find your block in the <strong>Custom</strong> category in the toolbox</li>
            <li>Drag it into any test</li>
            <li>Fill in the parameter values</li>
          </ol>
        </div>

        <div className="help-feature">
          <h4>Editing Custom Blocks</h4>
          <ol>
            <li>Right-click on any instance of your custom block</li>
            <li>Choose <strong>"Edit Reusable Block"</strong></li>
            <li>Modify the steps or parameters</li>
            <li>Click <strong>Save Changes</strong></li>
          </ol>
        </div>

        <div className="help-feature">
          <h4>Parameters</h4>
          <p>When creating a custom block, you can choose which field values become parameters:</p>
          <ul>
            <li>Checked = user can customize this value when using the block</li>
            <li>Unchecked = value is fixed inside the block</li>
          </ul>
        </div>

        <div className="help-tip">
          <strong>Best Practice:</strong> Create custom blocks for common flows like login, navigation, or form filling to keep tests DRY (Don't Repeat Yourself).
        </div>
      </>
    ),
  },
  {
    id: 'lifecycle',
    title: 'Lifecycle Hooks',
    content: (
      <>
        <h3>Setup & Teardown</h3>
        <p>Run code before/after tests using lifecycle hooks.</p>

        <div className="help-feature">
          <h4>Available Hooks</h4>
          <ul>
            <li><strong>Before All</strong> - runs once before all tests start</li>
            <li><strong>After All</strong> - runs once after all tests complete</li>
            <li><strong>Before Each</strong> - runs before each individual test</li>
            <li><strong>After Each</strong> - runs after each individual test</li>
          </ul>
        </div>

        <div className="help-feature">
          <h4>Accessing Lifecycle Tabs</h4>
          <ol>
            <li>Click the tabs above the workspace: <strong>Test | Before All | After All | Before Each | After Each</strong></li>
            <li>Add blocks to the selected lifecycle phase</li>
            <li>Blocks run automatically at the appropriate time</li>
          </ol>
        </div>

        <div className="help-feature">
          <h4>Common Use Cases</h4>
          <ul>
            <li><strong>Before All:</strong> Set up test data, authenticate API</li>
            <li><strong>Before Each:</strong> Navigate to starting page, reset state</li>
            <li><strong>After Each:</strong> Take screenshot, log out user</li>
            <li><strong>After All:</strong> Clean up test data, close connections</li>
          </ul>
        </div>

        <div className="help-feature">
          <h4>Special Lifecycle Blocks</h4>
          <ul>
            <li><strong>On Failure</strong> - only runs if the test fails</li>
            <li><strong>Skip If</strong> - skip test based on condition</li>
            <li><strong>Retry</strong> - retry failed steps automatically</li>
          </ul>
        </div>

        <div className="help-tip">
          <strong>Tip:</strong> Use Before Each to ensure each test starts from a clean state, making tests independent and reliable.
        </div>
      </>
    ),
  },
  {
    id: 'logic',
    title: 'Logic & Control Flow',
    content: (
      <>
        <h3>Control Flow</h3>
        <p>Add conditional logic, loops, and error handling to your tests.</p>

        <div className="help-feature">
          <h4>Conditional Execution (If/Else)</h4>
          <ol>
            <li>Use the <strong>If</strong> block from Logic category</li>
            <li>Connect a condition block (e.g., <strong>Compare</strong>)</li>
            <li>Add blocks inside the "then" section</li>
            <li>Optionally add blocks to the "else" section</li>
          </ol>
        </div>

        <div className="help-feature">
          <h4>Comparisons</h4>
          <p>Use the <strong>Compare</strong> block to check:</p>
          <ul>
            <li><code>=</code> equals</li>
            <li><code>≠</code> not equals</li>
            <li><code>&lt;</code> <code>&gt;</code> <code>≤</code> <code>≥</code> numeric comparisons</li>
            <li><code>contains</code> text contains</li>
          </ul>
        </div>

        <div className="help-feature">
          <h4>Loops</h4>
          <ul>
            <li><strong>Repeat</strong> - run blocks N times</li>
            <li><strong>For Each</strong> - iterate over an array</li>
          </ul>
        </div>

        <div className="help-feature">
          <h4>Error Handling</h4>
          <ol>
            <li>Use <strong>Try/Catch</strong> to handle potential failures</li>
            <li>Blocks in "try" run first</li>
            <li>If they fail, "catch" blocks run instead</li>
          </ol>
        </div>

        <div className="help-feature">
          <h4>Logging & Debugging</h4>
          <ul>
            <li><strong>Log</strong> - output messages (info, warn, error, debug)</li>
            <li><strong>Comment</strong> - add notes (doesn't run)</li>
            <li><strong>Fail</strong> - force test to fail with message</li>
          </ul>
        </div>
      </>
    ),
  },
  {
    id: 'tips',
    title: 'Tips & Tricks',
    content: (
      <>
        <h3>Pro Tips</h3>

        <div className="help-feature">
          <h4>Selectors</h4>
          <p>Best practices for finding elements:</p>
          <ul>
            <li><code>#id</code> - by ID (most reliable)</li>
            <li><code>[data-testid="value"]</code> - by test ID attribute</li>
            <li><code>.class-name</code> - by CSS class</li>
            <li><code>text=Click me</code> - by visible text</li>
            <li><code>button:has-text("Submit")</code> - button containing text</li>
          </ul>
        </div>

        <div className="help-feature">
          <h4>Keyboard Shortcuts</h4>
          <ul>
            <li><strong>Delete/Backspace</strong> - delete selected block</li>
            <li><strong>Ctrl/Cmd + C/V</strong> - copy/paste blocks</li>
            <li><strong>Ctrl/Cmd + Z</strong> - undo</li>
            <li><strong>Shift + Click</strong> - select multiple blocks</li>
          </ul>
        </div>

        <div className="help-feature">
          <h4>Debugging Failed Tests</h4>
          <ol>
            <li>Turn off <strong>Headless</strong> mode to watch the browser</li>
            <li>Add <strong>Wait</strong> blocks to slow down execution</li>
            <li>Use <strong>Screenshot</strong> blocks to capture state</li>
            <li>Check the Results panel for error details</li>
          </ol>
        </div>

        <div className="help-feature">
          <h4>Test Organization</h4>
          <ul>
            <li>One test file per feature or page</li>
            <li>Use descriptive test names</li>
            <li>Keep tests independent (don't rely on other tests)</li>
            <li>Use lifecycle hooks for common setup</li>
          </ul>
        </div>

        <div className="help-feature">
          <h4>Performance Tips</h4>
          <ul>
            <li>Avoid fixed <strong>Wait</strong> blocks - use <strong>Wait for Element</strong> instead</li>
            <li>Run tests in <strong>Headless</strong> mode for speed</li>
            <li>Use API calls to set up test data (faster than UI)</li>
          </ul>
        </div>
      </>
    ),
  },
];

export function HelpDialog({ isOpen, onClose }: HelpDialogProps) {
  const [activeSection, setActiveSection] = useState('getting-started');

  if (!isOpen) return null;

  const currentSection = HELP_SECTIONS.find(s => s.id === activeSection);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal help-modal"
        onClick={e => e.stopPropagation()}
      >
        <div className="help-header">
          <h2>TestBlocks Guide</h2>
          <button className="btn-close" onClick={onClose}>&times;</button>
        </div>

        <div className="help-layout">
          <nav className="help-nav">
            {HELP_SECTIONS.map(section => (
              <button
                key={section.id}
                className={`help-nav-item ${activeSection === section.id ? 'active' : ''}`}
                onClick={() => setActiveSection(section.id)}
              >
                {section.title}
              </button>
            ))}
          </nav>

          <div className="help-content">
            {currentSection?.content}
          </div>
        </div>
      </div>
    </div>
  );
}
