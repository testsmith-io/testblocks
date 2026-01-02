# TestBlocks

A visual test automation tool using Blockly for building API and web (Playwright) tests. Design tests visually, save them as JSON files for version control, and run them in CI with the CLI runner.

## Features

- **Visual Test Builder** - Drag-and-drop blocks to create tests without coding
- **API Testing** - Built-in blocks for HTTP requests (GET, POST, PUT, PATCH, DELETE) and assertions
- **Web Testing** - Playwright-powered blocks for browser automation (navigate, click, type, assertions)
- **Git-Friendly** - Tests saved as JSON files that can be versioned in repositories
- **CLI Runner** - Run tests in CI/CD pipelines with JUnit/JSON reports
- **Extensible** - Create custom blocks with the plugin system

## Quick Start

### Installation

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Install Playwright browsers
npx playwright install chromium
```

### Development

```bash
# Start the development server (frontend + backend)
npm run dev
```

Open http://localhost:3000 in your browser to use the visual editor.

### Running Tests

```bash
# Run tests via CLI
npm run cli run "examples/tests/*.testblocks.json"

# Run with headed browser (visible)
npm run cli run tests/*.testblocks.json --headed

# Run with JUnit output for CI
npm run cli run tests/*.testblocks.json --reporter junit --output ./results

# Validate test files
npm run cli validate "examples/tests/*.testblocks.json"

# List tests in files
npm run cli list "examples/tests/*.testblocks.json"
```

## Project Structure

```
testblocks/
├── src/
│   ├── core/          # Types, block definitions, plugin system
│   ├── client/        # React + Blockly visual editor
│   ├── server/        # Express server for test execution
│   └── cli/           # CLI runner for CI integration
├── examples/
│   ├── tests/         # Example test files
│   └── plugins/       # Example custom plugins
└── testblocks.config.json
```

## Test File Format

Tests are stored as `.testblocks.json` files:

```json
{
  "version": "1.0.0",
  "name": "My Test Suite",
  "variables": {
    "baseUrl": { "type": "string", "default": "https://example.com" }
  },
  "beforeAll": [],
  "afterAll": [],
  "beforeEach": [],
  "afterEach": [],
  "procedures": {
    "login": {
      "name": "login",
      "params": [{ "name": "username", "type": "string" }],
      "steps": []
    }
  },
  "tests": [
    {
      "id": "test-1",
      "name": "Login test",
      "data": [
        { "name": "admin", "values": { "username": "admin", "password": "123" } },
        { "name": "user", "values": { "username": "user", "password": "456" } }
      ],
      "steps": []
    }
  ]
}
```

## Lifecycle Hooks

TestBlocks supports setup/teardown hooks at multiple levels:

| Hook | Level | Description |
|------|-------|-------------|
| `beforeAll` | Suite | Runs once before all tests |
| `afterAll` | Suite | Runs once after all tests |
| `beforeEach` | Suite | Runs before each test |
| `afterEach` | Suite | Runs after each test |
| `beforeEach` | Test | Runs before this specific test |
| `afterEach` | Test | Runs after this specific test |

## Data-Driven Testing

Run the same test with different data sets:

```json
{
  "id": "test-login",
  "name": "Login with credentials",
  "data": [
    { "name": "admin user", "values": { "username": "admin", "password": "admin123" } },
    { "name": "regular user", "values": { "username": "user1", "password": "pass123" } }
  ],
  "steps": []
}
```

Access data values using `data_get_current` block with the key name, or use `${username}` variable syntax.

## Custom Procedures

Define reusable action sequences (like functions):

```json
{
  "procedures": {
    "login": {
      "name": "login",
      "description": "Login with credentials",
      "params": [
        { "name": "username", "type": "string" },
        { "name": "password", "type": "string" }
      ],
      "steps": []
    }
  }
}
```

Call procedures using the `procedure_call` block with arguments.

## Built-in Blocks

### API Blocks

| Block | Description |
|-------|-------------|
| `GET` | Perform HTTP GET request |
| `POST` | Perform HTTP POST request |
| `PUT` | Perform HTTP PUT request |
| `PATCH` | Perform HTTP PATCH request |
| `DELETE` | Perform HTTP DELETE request |
| `Assert Status` | Assert response status code |
| `Assert Body Contains` | Assert response body contains value |
| `Extract Value` | Extract value from response using JSON path |
| `Headers` | Create headers with authentication |
| `JSON Body` | Create JSON request body |

### Web (Playwright) Blocks

| Block | Description |
|-------|-------------|
| `Navigate` | Navigate to URL |
| `Click` | Click an element |
| `Fill` | Fill input field (clears first) |
| `Type` | Type text character by character |
| `Select` | Select dropdown option |
| `Checkbox` | Check/uncheck checkbox |
| `Hover` | Hover over element |
| `Press Key` | Press keyboard key |
| `Wait for Element` | Wait for element state |
| `Wait for URL` | Wait for URL to match |
| `Wait` | Pause for specified time |
| `Screenshot` | Take screenshot |
| `Get Text` | Get element text content |
| `Get Attribute` | Get element attribute |
| `Assert Visible` | Assert element is visible |
| `Assert Text Contains` | Assert element text contains value |
| `Assert Text Equals` | Assert element text equals value |
| `Assert URL Contains` | Assert URL contains value |
| `Assert Title Contains` | Assert page title contains value |

### Logic Blocks

| Block | Description |
|-------|-------------|
| `Set Variable` | Set a variable value |
| `Get Variable` | Get a variable value |
| `If` | Conditional execution |
| `Compare` | Compare two values |
| `Repeat` | Repeat blocks N times |
| `For Each` | Iterate over array |
| `Try/Catch` | Handle errors |
| `Log` | Log a message |
| `Assert` | Assert condition is true |
| `Fail` | Fail the test |

## CLI Options

```
Usage: testblocks run [options] <patterns...>

Run test files

Options:
  -H, --headed           Run in headed mode (show browser)
  -t, --timeout <ms>     Test timeout in milliseconds (default: 30000)
  -r, --reporter <type>  Reporter: console, json, junit (default: console)
  -o, --output <dir>     Output directory for reports
  -b, --base-url <url>   Base URL for relative URLs
  -v, --var <vars...>    Variables in key=value format
  --fail-fast            Stop on first test failure
  --filter <pattern>     Only run tests matching pattern
```

## Creating Custom Plugins

Create plugins to add custom blocks:

```typescript
import { createPlugin, createBlock, registerPlugin } from '@testblocks/core';

const myPlugin = createPlugin({
  name: 'my-plugin',
  version: '1.0.0',
  description: 'My custom blocks',
  blocks: [
    createBlock({
      type: 'my_custom_block',
      category: 'Custom',
      color: '#9C27B0',
      tooltip: 'My custom action',
      inputs: [
        { name: 'VALUE', type: 'field', fieldType: 'text', required: true },
      ],
      previousStatement: true,
      nextStatement: true,
      execute: async (params, context) => {
        context.logger.info(`Custom block executed with: ${params.VALUE}`);
      },
    }),
  ],
});

registerPlugin(myPlugin);
```

## Configuration

Create `testblocks.config.json` in your project root:

```json
{
  "testDir": "./tests",
  "testMatch": ["**/*.testblocks.json"],
  "timeout": 30000,
  "headless": true,
  "reporter": "console",
  "outputDir": "./testblocks-results",
  "variables": {
    "baseUrl": "http://localhost:3000"
  },
  "plugins": []
}
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - run: npm ci
      - run: npm run build
      - run: npx playwright install chromium

      - run: npm run cli run "tests/**/*.testblocks.json" --reporter junit --output results

      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results
          path: results/
```

### GitLab CI

```yaml
test:
  image: mcr.microsoft.com/playwright:v1.49.0
  script:
    - npm ci
    - npm run build
    - npm run cli run "tests/**/*.testblocks.json" --reporter junit --output results
  artifacts:
    reports:
      junit: results/junit.xml
```

## License

MIT
