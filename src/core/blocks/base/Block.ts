import { BlockDefinition, BlockInput, BlockOutput, ExecutionContext } from '../../types';

/**
 * Abstract base class for all blocks.
 * Encapsulates block definition, Blockly JSON generation, and execution logic.
 */
export abstract class Block {
  /** Unique block type identifier (e.g., 'api_get') */
  abstract readonly type: string;

  /** Category for toolbox organization */
  abstract readonly category: string;

  /** Hex color for visual appearance */
  abstract readonly color: string;

  /** UI tooltip on hover */
  readonly tooltip?: string;

  /** Documentation URL */
  readonly helpUrl?: string;

  /** Can be chained after another block */
  readonly previousStatement: boolean = false;

  /** Can chain to next block */
  readonly nextStatement: boolean = false;

  /** Output type if this is a value block */
  readonly output?: BlockOutput;

  /**
   * Get the inputs for this block.
   * Override in subclasses to define block inputs.
   */
  abstract getInputs(): BlockInput[];

  /**
   * Execute the block logic.
   * @param params - The parameter values from the block fields
   * @param context - The execution context
   * @returns The execution result
   */
  abstract execute(params: Record<string, unknown>, context: ExecutionContext): Promise<unknown>;

  /**
   * Convert this block to a BlockDefinition for backward compatibility.
   * This allows the class-based blocks to work with the existing registry system.
   */
  toDefinition(): BlockDefinition {
    return {
      type: this.type,
      category: this.category,
      color: this.color,
      tooltip: this.tooltip,
      helpUrl: this.helpUrl,
      inputs: this.getInputs(),
      output: this.output,
      previousStatement: this.previousStatement || undefined,
      nextStatement: this.nextStatement || undefined,
      execute: this.execute.bind(this),
    };
  }

  /**
   * Generate Blockly JSON definition for this block.
   * Override in subclasses for custom Blockly layouts.
   */
  toBlocklyJson(): Record<string, unknown> {
    const blockJson: Record<string, unknown> = {
      type: this.type,
      colour: this.color,
      tooltip: this.tooltip || '',
      helpUrl: this.helpUrl || '',
    };

    // Build message and args
    let message = this.getBlockLabel();
    const args: unknown[] = [];
    let argIndex = 0;

    this.getInputs().forEach((input) => {
      if (input.type === 'field') {
        message += ` %${++argIndex}`;
        args.push(this.createFieldArg(input));
      } else if (input.type === 'value') {
        message += ` %${++argIndex}`;
        args.push({
          type: 'input_value',
          name: input.name,
          check: input.check,
        });
      } else if (input.type === 'statement') {
        message += ` %${++argIndex}`;
        args.push({
          type: 'input_statement',
          name: input.name,
        });
      }
    });

    blockJson.message0 = message;
    blockJson.args0 = args;

    if (this.output) {
      blockJson.output = this.output.type;
    }

    if (this.previousStatement) {
      blockJson.previousStatement = null;
    }

    if (this.nextStatement) {
      blockJson.nextStatement = null;
    }

    return blockJson;
  }

  /**
   * Get the block label for display in Blockly.
   * Override for custom labels.
   */
  protected getBlockLabel(): string {
    // Convert type like 'api_get' to 'GET' or 'web_navigate' to 'Navigate'
    const parts = this.type.split('_');
    const prefix = parts[0];

    if (prefix === 'api' || prefix === 'web' || prefix === 'logic') {
      return parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    }

    if (prefix === 'snippet' || prefix === 'custom') {
      return parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    }

    return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
  }

  /**
   * Create a Blockly field argument from a BlockInput.
   */
  protected createFieldArg(input: BlockInput): unknown {
    const baseArg = { name: input.name };

    switch (input.fieldType) {
      case 'text':
        return {
          ...baseArg,
          type: 'field_input_autocomplete',
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
          type: 'field_multiline_autocomplete',
          text: input.default !== undefined ? String(input.default) : '',
          spellcheck: false,
        };
      default:
        return {
          ...baseArg,
          type: 'field_input_autocomplete',
          text: '',
        };
    }
  }

  /**
   * Get the Blockly init extension function for custom initialization.
   * Override for custom init behavior (e.g., adding tooltips to fields).
   */
  getBlocklyInitExtension(): (() => void) | undefined {
    return undefined;
  }
}
