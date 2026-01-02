import * as Blockly from 'blockly';
import { FieldMultilineInput } from '@blockly/field-multilineinput';
import { BlockDefinition } from '../../core';

// Register the multiline input field
Blockly.fieldRegistry.register('field_multilineinput', FieldMultilineInput);

// Convert our block definitions to Blockly format
export function registerBlocklyBlocks(blocks: BlockDefinition[]): void {
  blocks.forEach(block => {
    // Create the block JSON definition
    const blockJson: Record<string, unknown> = {
      type: block.type,
      colour: block.color,
      tooltip: block.tooltip || '',
      helpUrl: block.helpUrl || '',
    };

    // Build message and args
    let message = '';
    const args: unknown[] = [];
    let argIndex = 0;

    // Add block label based on type
    message += formatBlockLabel(block.type);

    block.inputs.forEach((input) => {
      if (input.type === 'field') {
        // Add label for DATA field in data-driven test block
        if (block.type === 'test_case_data_driven' && input.name === 'DATA') {
          message += ` Data: %${++argIndex}`;
        } else {
          message += ` %${++argIndex}`;
        }
        args.push(createFieldArg(input, argIndex));
      } else if (input.type === 'value') {
        message += ` %${++argIndex}`;
        args.push({
          type: 'input_value',
          name: input.name,
          check: input.check,
        });
      } else if (input.type === 'statement') {
        // Statements go on separate lines
        message += ` %${++argIndex}`;
        args.push({
          type: 'input_statement',
          name: input.name,
        });
      }
    });

    blockJson.message0 = message;
    blockJson.args0 = args;

    if (block.output) {
      blockJson.output = block.output.type;
    }

    if (block.previousStatement !== undefined) {
      blockJson.previousStatement = block.previousStatement ? null : undefined;
    }

    if (block.nextStatement !== undefined) {
      blockJson.nextStatement = block.nextStatement ? null : undefined;
    }

    // Register the block
    Blockly.Blocks[block.type] = {
      init: function() {
        this.jsonInit(blockJson);
      },
    };
  });
}

function formatBlockLabel(type: string): string {
  // Convert type like 'api_get' to 'GET' or 'web_navigate' to 'Navigate'
  const parts = type.split('_');
  if (parts[0] === 'api' || parts[0] === 'web' || parts[0] === 'logic') {
    return parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
  }
  // Format snippet blocks nicely: 'snippet_login' -> 'Login'
  if (parts[0] === 'snippet') {
    return parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
  }
  // Special handling for test case blocks
  if (type === 'test_case') {
    return 'Test Case:';
  }
  if (type === 'test_case_data_driven') {
    return 'Data-Driven Test:';
  }
  return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

function createFieldArg(input: BlockDefinition['inputs'][0], _index: number): unknown {
  const baseArg = { name: input.name };

  switch (input.fieldType) {
    case 'text':
      return {
        ...baseArg,
        type: 'field_input',
        text: input.default !== undefined ? String(input.default) : '',
      };
    case 'number':
      return {
        ...baseArg,
        type: 'field_number',
        value: input.default !== undefined ? Number(input.default) : 0,
      };
    case 'dropdown':
      return {
        ...baseArg,
        type: 'field_dropdown',
        options: input.options || [],
      };
    case 'checkbox':
      return {
        ...baseArg,
        type: 'field_checkbox',
        checked: input.default === true,
      };
    case 'multiline':
      return {
        ...baseArg,
        type: 'field_multilineinput',
        text: input.default !== undefined ? String(input.default) : '',
        spellcheck: false,
      };
    default:
      return {
        ...baseArg,
        type: 'field_input',
        text: '',
      };
  }
}

// Define category colors
const categoryColors: Record<string, string> = {
  'API': '#4CAF50',
  'Web': '#E91E63',
  'Logic': '#5C6BC0',
  'Custom': '#607D8B',
  'Procedures': '#9C27B0',
  'Tests': '#1E88E5',
  'Math': '#9C27B0',
  'Assertions': '#E91E63',
  'Faker': '#FF9800',
  'Snippets': '#795548',
  'Auth': '#4CAF50',
  'TOTP': '#673AB7',
  'Database': '#00796B',
};

// Core categories in display order
const coreOrder = ['Web', 'API', 'Logic', 'Tests', 'Lifecycle', 'Data', 'Procedures'];
const _coreCategorySet = new Set(coreOrder);

// Known plugin categories (from registered plugins)
const pluginCategories = new Set(['Faker', 'Auth', 'TOTP', 'Math', 'Database']);

// Create Blockly toolbox from block definitions with separators
export function createToolbox(blocks: BlockDefinition[]): Blockly.utils.toolbox.ToolboxDefinition {
  // Group blocks by category
  const categories = new Map<string, BlockDefinition[]>();

  blocks.forEach(block => {
    const existing = categories.get(block.category) || [];
    existing.push(block);
    categories.set(block.category, existing);
  });

  // Build toolbox with separators
  const contents: Blockly.utils.toolbox.ToolboxItemInfo[] = [];

  // 1. Add core categories in order
  coreOrder.forEach(categoryName => {
    const categoryBlocks = categories.get(categoryName);
    if (categoryBlocks) {
      contents.push({
        kind: 'category',
        name: categoryName,
        colour: categoryColors[categoryName] || '#795548',
        contents: categoryBlocks.map(block => ({
          kind: 'block',
          type: block.type,
        })),
      } as Blockly.utils.toolbox.ToolboxItemInfo);
      categories.delete(categoryName);
    }
  });

  // 2. Collect plugin and custom categories
  const pluginCats: Array<[string, BlockDefinition[]]> = [];
  const customCats: Array<[string, BlockDefinition[]]> = [];

  categories.forEach((categoryBlocks, categoryName) => {
    if (pluginCategories.has(categoryName)) {
      pluginCats.push([categoryName, categoryBlocks]);
    } else {
      customCats.push([categoryName, categoryBlocks]);
    }
  });

  // 3. Add separator before plugins (if any plugins exist)
  if (pluginCats.length > 0) {
    contents.push({ kind: 'sep' } as Blockly.utils.toolbox.ToolboxItemInfo);
  }

  // 4. Add plugin categories
  pluginCats.forEach(([categoryName, categoryBlocks]) => {
    contents.push({
      kind: 'category',
      name: categoryName,
      colour: categoryColors[categoryName] || '#795548',
      contents: categoryBlocks.map(block => ({
        kind: 'block',
        type: block.type,
      })),
    } as Blockly.utils.toolbox.ToolboxItemInfo);
  });

  // 5. Add separator before custom categories (if any custom exist)
  if (customCats.length > 0) {
    contents.push({ kind: 'sep' } as Blockly.utils.toolbox.ToolboxItemInfo);
  }

  // 6. Add custom/snippet categories
  customCats.forEach(([categoryName, categoryBlocks]) => {
    contents.push({
      kind: 'category',
      name: categoryName,
      colour: categoryColors[categoryName] || '#795548',
      contents: categoryBlocks.map(block => ({
        kind: 'block',
        type: block.type,
      })),
    } as Blockly.utils.toolbox.ToolboxItemInfo);
  });

  return {
    kind: 'categoryToolbox',
    contents,
  };
}

// Lifecycle block types that contain steps in their DO input
const lifecycleContainerTypes = [
  'lifecycle_before_all',
  'lifecycle_after_all',
  'lifecycle_before_each',
  'lifecycle_after_each',
];

// Convert Blockly workspace to our TestFile format
// Extracts steps from test_case, test_case_data_driven, or lifecycle blocks
export function workspaceToTestSteps(workspace: Blockly.Workspace): unknown[] {
  const topBlocks = workspace.getTopBlocks(true);
  const steps: unknown[] = [];

  topBlocks.forEach(block => {
    // If it's a test_case or test_case_data_driven block, extract the steps from inside
    if (block.type === 'test_case' || block.type === 'test_case_data_driven') {
      const stepsInput = block.getInput('STEPS');
      if (stepsInput && stepsInput.connection && stepsInput.connection.targetBlock()) {
        let currentBlock: Blockly.Block | null = stepsInput.connection.targetBlock();
        while (currentBlock) {
          const step = blockToStep(currentBlock);
          if (step) {
            steps.push(step);
          }
          currentBlock = currentBlock.getNextBlock();
        }
      }
    } else if (lifecycleContainerTypes.includes(block.type)) {
      // If it's a lifecycle container block, extract steps from DO input
      const doInput = block.getInput('DO');
      if (doInput && doInput.connection && doInput.connection.targetBlock()) {
        let currentBlock: Blockly.Block | null = doInput.connection.targetBlock();
        while (currentBlock) {
          const step = blockToStep(currentBlock);
          if (step) {
            steps.push(step);
          }
          currentBlock = currentBlock.getNextBlock();
        }
      }
    } else {
      // Handle loose blocks (for backwards compatibility)
      const step = blockToStep(block);
      if (step) {
        steps.push(step);
      }
    }
  });

  return steps;
}

// Get test name from workspace (from test_case or test_case_data_driven block)
export function getTestNameFromWorkspace(workspace: Blockly.Workspace): string | undefined {
  const topBlocks = workspace.getTopBlocks(true);
  for (const block of topBlocks) {
    if (block.type === 'test_case' || block.type === 'test_case_data_driven') {
      const nameField = block.getField('NAME');
      if (nameField) {
        return nameField.getValue() as string;
      }
    }
  }
  return undefined;
}

// Parse CSV string back to test data array
function parseCSVToData(csv: string): Array<{ name?: string; values: Record<string, unknown> }> {
  if (!csv || csv.trim() === '') return [];

  const lines = csv.trim().split('\n');
  if (lines.length < 2) return []; // Need at least header + 1 data row

  const headers = lines[0].split(',').map(h => h.trim());
  const data: Array<{ name?: string; values: Record<string, unknown> }> = [];

  for (let i = 1; i < lines.length; i++) {
    const values: Record<string, unknown> = {};
    // Simple CSV parsing (handles quoted values with commas)
    const row: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of lines[i]) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    row.push(current.trim());

    headers.forEach((header, index) => {
      const val = row[index] ?? '';
      // Try to parse as number or boolean
      if (val === 'true') {
        values[header] = true;
      } else if (val === 'false') {
        values[header] = false;
      } else if (val !== '' && !isNaN(Number(val))) {
        values[header] = Number(val);
      } else {
        values[header] = val;
      }
    });

    data.push({ name: `Row ${i}`, values });
  }

  return data;
}

// Get test data from workspace (from test_case_data_driven block)
export function getTestDataFromWorkspace(workspace: Blockly.Workspace): Array<{ name?: string; values: Record<string, unknown> }> | undefined {
  const topBlocks = workspace.getTopBlocks(true);
  for (const block of topBlocks) {
    if (block.type === 'test_case_data_driven') {
      const dataField = block.getField('DATA');
      if (dataField) {
        const csv = dataField.getValue() as string;
        return parseCSVToData(csv);
      }
    }
  }
  return undefined;
}

function blockToStep(block: Blockly.Block): unknown {
  const step: Record<string, unknown> = {
    id: block.id,
    type: block.type,
    params: {},
  };

  // Extract field values
  block.inputList.forEach(input => {
    input.fieldRow.forEach(field => {
      if (field.name) {
        step.params = step.params || {};
        (step.params as Record<string, unknown>)[field.name] = field.getValue();
      }
    });

    // Handle connected value blocks
    if (input.type === Blockly.inputs.inputTypes.VALUE && input.connection?.targetBlock()) {
      const connectedBlock = input.connection.targetBlock();
      if (connectedBlock) {
        (step.params as Record<string, unknown>)[input.name] = blockToStep(connectedBlock);
      }
    }

    // Handle statement blocks
    if (input.type === Blockly.inputs.inputTypes.STATEMENT && input.connection?.targetBlock()) {
      const statementBlocks: unknown[] = [];
      let currentBlock: Blockly.Block | null = input.connection.targetBlock();

      while (currentBlock) {
        const childStep = blockToStep(currentBlock);
        if (childStep) {
          statementBlocks.push(childStep);
        }
        currentBlock = currentBlock.getNextBlock();
      }

      if (statementBlocks.length > 0) {
        step.children = step.children || {};
        (step.children as Record<string, unknown>)[input.name] = statementBlocks;
      }
    }
  });

  return step;
}

// Map lifecycle type to block type
const lifecycleBlockTypes: Record<string, string> = {
  beforeAll: 'lifecycle_before_all',
  afterAll: 'lifecycle_after_all',
  beforeEach: 'lifecycle_before_each',
  afterEach: 'lifecycle_after_each',
};

// Convert test data array to CSV string
function dataToCSV(data: Array<{ name?: string; values: Record<string, unknown> }>): string {
  if (!data || data.length === 0) return '';

  // Get all unique keys from all data rows
  const allKeys = new Set<string>();
  data.forEach(row => {
    Object.keys(row.values).forEach(key => allKeys.add(key));
  });
  const headers = Array.from(allKeys);

  // Build CSV lines
  const lines: string[] = [headers.join(',')];
  data.forEach(row => {
    const values = headers.map(header => {
      const val = row.values[header];
      if (val === undefined || val === null) return '';
      if (typeof val === 'string' && val.includes(',')) return `"${val}"`;
      return String(val);
    });
    lines.push(values.join(','));
  });

  return lines.join('\n');
}

// Load steps back into Blockly workspace
// If lifecycleType is provided, steps are wrapped in the corresponding lifecycle block
// If testData is provided, uses the data-driven test case block
export function loadStepsToWorkspace(
  workspace: Blockly.Workspace,
  steps: unknown[],
  testName?: string,
  lifecycleType?: string,
  testData?: Array<{ name?: string; values: Record<string, unknown> }>
): void {
  workspace.clear();

  // For lifecycle hooks, wrap in lifecycle container block
  if (lifecycleType && lifecycleBlockTypes[lifecycleType]) {
    const containerType = lifecycleBlockTypes[lifecycleType];
    const containerBlock = workspace.newBlock(containerType);
    containerBlock.initSvg();

    // Create all step blocks
    const stepBlocks: Blockly.Block[] = [];

    steps.forEach((step: unknown) => {
      const stepObj = step as { type: string; id?: string; params?: Record<string, unknown>; children?: Record<string, unknown[]> };

      try {
        const block = workspace.newBlock(stepObj.type);

        // Set field values
        if (stepObj.params) {
          Object.entries(stepObj.params).forEach(([name, value]) => {
            const field = block.getField(name);
            if (field) {
              field.setValue(value);
            }
          });
        }

        block.initSvg();
        stepBlocks.push(block);
      } catch (e) {
        console.error(`Failed to create block of type: ${stepObj.type}`, e);
      }
    });

    // Connect step blocks to each other
    stepBlocks.forEach((block, index) => {
      if (index > 0) {
        const previousBlock = stepBlocks[index - 1];
        if (previousBlock.nextConnection && block.previousConnection) {
          previousBlock.nextConnection.connect(block.previousConnection);
        }
      }
    });

    // Connect first step to container's DO input
    if (stepBlocks.length > 0) {
      const doInput = containerBlock.getInput('DO');
      if (doInput && doInput.connection && stepBlocks[0].previousConnection) {
        doInput.connection.connect(stepBlocks[0].previousConnection);
      }
    }

    // Position and render
    containerBlock.moveBy(50, 50);
    (containerBlock as Blockly.BlockSvg).render();
    stepBlocks.forEach(block => (block as Blockly.BlockSvg).render());
    return;
  }

  // Determine if this is a data-driven test
  const isDataDriven = testData && testData.length > 0;
  const blockType = isDataDriven ? 'test_case_data_driven' : 'test_case';

  // Regular test case - wrap in test_case or test_case_data_driven block
  if (steps.length === 0) {
    // Create empty test case block
    const testCaseBlock = workspace.newBlock(blockType);
    const nameField = testCaseBlock.getField('NAME');
    if (nameField && testName) {
      nameField.setValue(testName);
    }
    // Set DATA field for data-driven tests
    if (isDataDriven) {
      const dataField = testCaseBlock.getField('DATA');
      if (dataField) {
        dataField.setValue(dataToCSV(testData));
      }
    }
    testCaseBlock.initSvg();
    testCaseBlock.moveBy(50, 50);
    (testCaseBlock as Blockly.BlockSvg).render();
    return;
  }

  // Create the test_case container block
  const testCaseBlock = workspace.newBlock(blockType);
  const nameField = testCaseBlock.getField('NAME');
  if (nameField && testName) {
    nameField.setValue(testName);
  }
  // Set DATA field for data-driven tests
  if (isDataDriven) {
    const dataField = testCaseBlock.getField('DATA');
    if (dataField) {
      dataField.setValue(dataToCSV(testData));
    }
  }
  testCaseBlock.initSvg();

  // Create all step blocks
  const stepBlocks: Blockly.Block[] = [];

  steps.forEach((step: unknown) => {
    const stepObj = step as { type: string; id?: string; params?: Record<string, unknown>; children?: Record<string, unknown[]> };

    try {
      const block = workspace.newBlock(stepObj.type);

      // Set field values
      if (stepObj.params) {
        Object.entries(stepObj.params).forEach(([name, value]) => {
          const field = block.getField(name);
          if (field) {
            field.setValue(value);
          }
        });
      }

      block.initSvg();
      stepBlocks.push(block);
    } catch (e) {
      console.error(`Failed to create block of type: ${stepObj.type}`, e);
    }
  });

  // Connect step blocks to each other
  stepBlocks.forEach((block, index) => {
    if (index > 0) {
      const previousBlock = stepBlocks[index - 1];
      if (previousBlock.nextConnection && block.previousConnection) {
        previousBlock.nextConnection.connect(block.previousConnection);
      }
    }
  });

  // Connect first step to test_case's STEPS input
  if (stepBlocks.length > 0) {
    const stepsInput = testCaseBlock.getInput('STEPS');
    if (stepsInput && stepsInput.connection && stepBlocks[0].previousConnection) {
      stepsInput.connection.connect(stepBlocks[0].previousConnection);
    }
  }

  // Position and render
  testCaseBlock.moveBy(50, 50);
  (testCaseBlock as Blockly.BlockSvg).render();
  stepBlocks.forEach(block => (block as Blockly.BlockSvg).render());
}
