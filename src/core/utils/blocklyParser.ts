import { TestStep } from '../types';

/**
 * Utility class for parsing Blockly state into TestSteps
 */
export class BlocklyParser {
  /**
   * Extract steps from Blockly serialization state or direct step array
   */
  static extractSteps(state: unknown): TestStep[] {
    if (!state || typeof state !== 'object') return [];

    const stateObj = state as Record<string, unknown>;

    // Handle Blockly serialization format
    if ('blocks' in stateObj && typeof stateObj.blocks === 'object') {
      const blocks = stateObj.blocks as Record<string, unknown>;
      if ('blocks' in blocks && Array.isArray(blocks.blocks)) {
        return this.blocksToSteps(blocks.blocks);
      }
    }

    // Handle direct array of steps
    if (Array.isArray(state)) {
      return state as TestStep[];
    }

    return [];
  }

  /**
   * Convert Blockly blocks array to TestSteps
   */
  static blocksToSteps(blocks: unknown[]): TestStep[] {
    const steps: TestStep[] = [];

    for (const block of blocks) {
      const step = this.blockToStep(block as Record<string, unknown>);
      if (step) {
        steps.push(step);

        // Handle next block in chain
        let currentBlock = block as Record<string, unknown>;
        while (currentBlock.next) {
          const nextBlock = (currentBlock.next as Record<string, unknown>).block as Record<string, unknown>;
          const nextStep = this.blockToStep(nextBlock);
          if (nextStep) {
            steps.push(nextStep);
          }
          currentBlock = nextBlock;
        }
      }
    }

    return steps;
  }

  /**
   * Convert a single Blockly block to a TestStep
   */
  static blockToStep(block: Record<string, unknown>): TestStep | null {
    if (!block || !block.type) return null;

    const step: TestStep = {
      id: block.id as string || `step-${Date.now()}`,
      type: block.type as string,
      params: {},
    };

    // Extract field values
    if (block.fields && typeof block.fields === 'object') {
      for (const [name, value] of Object.entries(block.fields as Record<string, unknown>)) {
        step.params[name] = value;
      }
    }

    // Extract inputs (connected blocks)
    if (block.inputs && typeof block.inputs === 'object') {
      for (const [name, input] of Object.entries(block.inputs as Record<string, unknown>)) {
        const inputObj = input as Record<string, unknown>;
        if (inputObj.block) {
          // Recursively convert connected block
          const connectedStep = this.blockToStep(inputObj.block as Record<string, unknown>);
          if (connectedStep) {
            step.params[name] = connectedStep;
          }
        }
      }
    }

    return step;
  }
}
