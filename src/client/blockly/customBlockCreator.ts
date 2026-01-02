import * as Blockly from 'blockly';
import { BlockDefinition, ProcedureDefinition, TestStep } from '../../core';
import { registerBlock, blockRegistry } from '../../core/blocks';
import { registerBlocklyBlocks } from './blockDefinitions';

export interface ExtractedParameter {
  name: string;
  fieldType: 'text' | 'number' | 'dropdown' | 'checkbox';
  defaultValue: unknown;
  blockType: string; // Which block this param came from
  originalFieldName: string;
  stepIndex: number; // Index of the step this param belongs to
}

export interface CustomBlockConfig {
  name: string;
  description: string;
  parameters: ExtractedParameter[];
  steps: TestStep[];
  color: string;
}

// Store custom blocks for persistence
export const customBlockRegistry = new Map<string, CustomBlockConfig>();

/**
 * Analyze selected blocks and extract configurable parameters
 */
export function analyzeSelectedBlocks(blocks: Blockly.Block[]): {
  steps: TestStep[];
  suggestedParams: ExtractedParameter[];
} {
  const steps: TestStep[] = [];
  const suggestedParams: ExtractedParameter[] = [];
  const seenParams = new Set<string>();

  // Sort blocks by position (top to bottom)
  const sortedBlocks = [...blocks].sort((a, b) => {
    const posA = a.getRelativeToSurfaceXY();
    const posB = b.getRelativeToSurfaceXY();
    return posA.y - posB.y;
  });

  // Find the chain of connected blocks
  const chainedBlocks = getBlockChain(sortedBlocks);

  for (const block of chainedBlocks) {
    const step = blockToTestStep(block);
    if (step) {
      const stepIndex = steps.length; // Current index before pushing
      steps.push(step);

      // Extract field parameters
      block.inputList.forEach(input => {
        input.fieldRow.forEach(field => {
          if (field.name && field.EDITABLE !== false) {
            const value = field.getValue();
            // Suggest as parameter if it looks like user input
            if (isUserConfigurableField(field.name, value)) {
              const paramName = generateParamName(field.name, block.type, seenParams);
              seenParams.add(paramName);

              suggestedParams.push({
                name: paramName,
                fieldType: getFieldType(field),
                defaultValue: value,
                blockType: block.type,
                originalFieldName: field.name,
                stepIndex,
              });
            }
          }
        });
      });
    }
  }

  return { steps, suggestedParams };
}

/**
 * Get chain of connected blocks (following next connections)
 */
function getBlockChain(selectedBlocks: Blockly.Block[]): Blockly.Block[] {
  const blockSet = new Set(selectedBlocks.map(b => b.id));
  const chain: Blockly.Block[] = [];
  const visited = new Set<string>();

  // Find the first block in the chain (one without a previous in selection)
  let firstBlock: Blockly.Block | null = null;
  for (const block of selectedBlocks) {
    const prevBlock = block.getPreviousBlock();
    if (!prevBlock || !blockSet.has(prevBlock.id)) {
      firstBlock = block;
      break;
    }
  }

  // Follow the chain
  let current: Blockly.Block | null = firstBlock;
  while (current && blockSet.has(current.id) && !visited.has(current.id)) {
    visited.add(current.id);
    chain.push(current);
    current = current.getNextBlock();
  }

  // If no chain found, just return sorted blocks
  if (chain.length === 0) {
    return selectedBlocks;
  }

  return chain;
}

/**
 * Convert a Blockly block to TestStep format
 */
function blockToTestStep(block: Blockly.Block): TestStep | null {
  if (!block.type || block.type === 'test_case') return null;

  const step: TestStep = {
    id: block.id,
    type: block.type,
    params: {},
  };

  block.inputList.forEach(input => {
    input.fieldRow.forEach(field => {
      if (field.name) {
        step.params[field.name] = field.getValue();
      }
    });

    // Handle connected value blocks
    if (input.type === Blockly.inputs.inputTypes.VALUE && input.connection?.targetBlock()) {
      const connectedBlock = input.connection.targetBlock();
      if (connectedBlock) {
        const connectedStep = blockToTestStep(connectedBlock);
        if (connectedStep) {
          step.params[input.name] = connectedStep;
        }
      }
    }
  });

  return step;
}

/**
 * Check if a field should be suggested as a parameter
 */
function isUserConfigurableField(fieldName: string, value: unknown): boolean {
  // Skip internal fields
  const internalFields = ['TYPE', 'LEVEL'];
  if (internalFields.includes(fieldName)) return false;

  // Include URL, SELECTOR, VALUE, etc.
  const configurableFields = ['URL', 'SELECTOR', 'VALUE', 'TEXT', 'KEY', 'NAME', 'MESSAGE', 'PATH', 'EXPECTED', 'TIMEOUT'];
  if (configurableFields.includes(fieldName)) return true;

  // Include if it has a non-empty string value
  if (typeof value === 'string' && value.trim().length > 0) return true;

  return false;
}

/**
 * Generate a unique parameter name
 */
function generateParamName(fieldName: string, blockType: string, seen: Set<string>): string {
  // Convert to camelCase
  let name = fieldName.toLowerCase();

  // If it's a common field, prefix with block type context
  if (['VALUE', 'SELECTOR', 'TEXT'].includes(fieldName)) {
    const prefix = blockType.split('_').pop() || '';
    name = prefix + fieldName.charAt(0).toUpperCase() + fieldName.slice(1).toLowerCase();
  }

  // Make unique
  let uniqueName = name;
  let counter = 1;
  while (seen.has(uniqueName)) {
    uniqueName = `${name}${counter}`;
    counter++;
  }

  return uniqueName;
}

/**
 * Get field type for parameter definition
 */
function getFieldType(field: Blockly.Field): 'text' | 'number' | 'dropdown' | 'checkbox' {
  if (field instanceof Blockly.FieldNumber) return 'number';
  if (field instanceof Blockly.FieldDropdown) return 'dropdown';
  if (field instanceof Blockly.FieldCheckbox) return 'checkbox';
  return 'text';
}

/**
 * Create a new custom block from configuration
 */
export function createCustomBlock(config: CustomBlockConfig): BlockDefinition {
  const blockType = `custom_${config.name.toLowerCase().replace(/\s+/g, '_')}`;

  const blockDef: BlockDefinition = {
    type: blockType,
    category: 'Custom',
    color: config.color || '#607D8B',
    tooltip: config.description || `Custom block: ${config.name}`,
    inputs: config.parameters.map(param => ({
      name: param.name.toUpperCase(),
      type: 'field' as const,
      fieldType: param.fieldType,
      default: param.defaultValue,
    })),
    previousStatement: true,
    nextStatement: true,
    execute: async (params, context) => {
      // Execute each step in the custom block
      context.logger.info(`Executing custom block: ${config.name}`);

      // Set procedure parameters in context.variables so ${paramName} references work
      config.parameters.forEach(p => {
        const value = params[p.name.toUpperCase()];
        if (value !== undefined) {
          context.variables.set(p.name, value);
        }
      });

      return {
        customBlock: true,
        name: config.name,
        steps: config.steps,
      };
    },
  };

  return blockDef;
}

/**
 * Register a custom block with both core registry and Blockly
 */
export function registerCustomBlock(config: CustomBlockConfig): string {
  const blockDef = createCustomBlock(config);

  // Store in custom registry
  customBlockRegistry.set(blockDef.type, config);

  // Register with core
  registerBlock(blockDef);

  // Register with Blockly
  registerBlocklyBlocks([blockDef]);

  return blockDef.type;
}

/**
 * Update an existing custom block
 */
export function updateCustomBlock(originalType: string, config: CustomBlockConfig): string {
  // Remove old block from registry
  customBlockRegistry.delete(originalType);

  // Create and register the updated block
  const newType = registerCustomBlock(config);

  return newType;
}

/**
 * Get a custom block config by type
 */
export function getCustomBlockConfig(blockType: string): CustomBlockConfig | undefined {
  return customBlockRegistry.get(blockType);
}

/**
 * Check if a block type is a custom block
 */
export function isCustomBlock(blockType: string): boolean {
  return customBlockRegistry.has(blockType);
}

/**
 * Get all custom blocks for toolbox
 */
export function getCustomBlocks(): BlockDefinition[] {
  const blocks: BlockDefinition[] = [];
  customBlockRegistry.forEach((config, type) => {
    const existing = blockRegistry.get(type);
    if (existing) {
      blocks.push(existing);
    }
  });
  return blocks;
}

/**
 * Export custom blocks as procedure definitions for persistence
 */
export function exportCustomBlocksAsProcedures(): Record<string, ProcedureDefinition> {
  const procedures: Record<string, ProcedureDefinition> = {};

  customBlockRegistry.forEach((config) => {
    // Create a mapping from stepIndex.fieldName to parameter name
    // Using stepIndex ensures we correctly map multiple blocks of the same type
    const paramMapping = new Map<string, string>();
    config.parameters.forEach(p => {
      paramMapping.set(`${p.stepIndex}.${p.originalFieldName}`, p.name);
    });

    // Replace hardcoded values in steps with parameter references
    const stepsWithParams = config.steps.map((step, stepIndex) => ({
      ...step,
      params: Object.fromEntries(
        Object.entries(step.params).map(([key, value]) => {
          const mappingKey = `${stepIndex}.${key}`;
          if (paramMapping.has(mappingKey)) {
            // Replace with parameter reference
            return [key, `\${${paramMapping.get(mappingKey)}}`];
          }
          return [key, value];
        })
      ),
    }));

    procedures[config.name] = {
      name: config.name,
      description: config.description,
      params: config.parameters.map(p => ({
        name: p.name,
        type: p.fieldType === 'number' ? 'number' : 'string',
        default: p.defaultValue,
        description: `From ${p.blockType}.${p.originalFieldName}`,
      })),
      steps: stepsWithParams,
    };
  });

  return procedures;
}

/**
 * Load custom blocks from procedure definitions
 */
export function loadCustomBlocksFromProcedures(procedures: Record<string, ProcedureDefinition>): void {
  // Clear existing custom blocks first
  customBlockRegistry.clear();

  Object.values(procedures).forEach(proc => {
    if (proc.steps && proc.steps.length > 0) {
      // Check if already registered
      const blockType = `custom_${proc.name.toLowerCase().replace(/\s+/g, '_')}`;
      if (customBlockRegistry.has(blockType)) {
        return;
      }

      // Find which step each parameter is used in by looking for ${paramName} in step params
      const findStepIndex = (paramName: string): number => {
        for (let i = 0; i < proc.steps.length; i++) {
          const step = proc.steps[i];
          for (const value of Object.values(step.params)) {
            if (typeof value === 'string' && value === `\${${paramName}}`) {
              return i;
            }
          }
        }
        return -1; // Not found
      };

      const config: CustomBlockConfig = {
        name: proc.name,
        description: proc.description || '',
        parameters: (proc.params || []).map(p => {
          // Parse the description to get blockType and originalFieldName if available
          const descMatch = p.description?.match(/From (\w+)\.(\w+)/);
          return {
            name: p.name,
            fieldType: p.type === 'number' ? 'number' as const : 'text' as const,
            defaultValue: p.default,
            blockType: descMatch?.[1] || '',
            originalFieldName: descMatch?.[2] || p.name.toUpperCase(),
            stepIndex: findStepIndex(p.name),
          };
        }),
        steps: proc.steps,
        color: '#607D8B',
      };
      registerCustomBlock(config);
    }
  });
}

/**
 * Clear all custom blocks
 */
export function clearCustomBlocks(): void {
  customBlockRegistry.clear();
}
