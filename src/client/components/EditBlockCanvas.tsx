import { useEffect, useRef, useCallback } from 'react';
import * as Blockly from 'blockly';
import { builtInBlocks, TestStep } from '../../core';
import { registerBlocklyBlocks, createToolbox } from '../blockly/blockDefinitions';
import { getPluginBlocks } from '../plugins';
import { getSnippetBlocks } from '../snippets';
import { getCustomBlocks } from '../blockly/customBlockCreator';

interface EditBlockCanvasProps {
  steps: TestStep[];
  onStepsChange: (steps: TestStep[]) => void;
}

// Track if blocks are registered for the edit canvas
let editCanvasBlocksRegistered = false;

export function EditBlockCanvas({ steps, onStepsChange }: EditBlockCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const isLoadingRef = useRef(false);

  // Convert workspace to steps
  const workspaceToSteps = useCallback((workspace: Blockly.Workspace): TestStep[] => {
    const topBlocks = workspace.getTopBlocks(true);
    const result: TestStep[] = [];

    // Sort blocks by Y position
    const sortedBlocks = [...topBlocks].sort((a, b) => {
      const posA = a.getRelativeToSurfaceXY();
      const posB = b.getRelativeToSurfaceXY();
      return posA.y - posB.y;
    });

    // Follow the chain for the first block
    if (sortedBlocks.length > 0) {
      let current: Blockly.Block | null = sortedBlocks[0];
      while (current) {
        const step = blockToStep(current);
        if (step) {
          result.push(step);
        }
        current = current.getNextBlock();
      }
    }

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Convert a block to TestStep
  const blockToStep = (block: Blockly.Block): TestStep | null => {
    if (!block.type) return null;

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
          const connectedStep = blockToStep(connectedBlock);
          if (connectedStep) {
            step.params[input.name] = connectedStep;
          }
        }
      }

      // Handle statement blocks (children)
      if (input.type === Blockly.inputs.inputTypes.STATEMENT && input.connection?.targetBlock()) {
        const children: TestStep[] = [];
        let child: Blockly.Block | null = input.connection.targetBlock();
        while (child) {
          const childStep = blockToStep(child);
          if (childStep) {
            children.push(childStep);
          }
          child = child.getNextBlock();
        }
        if (children.length > 0) {
          if (!step.children) step.children = {};
          (step.children as Record<string, TestStep[]>)[input.name] = children;
        }
      }
    });

    return step;
  };

  // Load steps into workspace
  const loadSteps = useCallback((workspace: Blockly.Workspace, stepsToLoad: TestStep[]) => {
    workspace.clear();

    if (stepsToLoad.length === 0) return;

    const blocks: Blockly.Block[] = [];

    stepsToLoad.forEach((step) => {
      try {
        const block = workspace.newBlock(step.type);

        // Set field values
        if (step.params) {
          Object.entries(step.params).forEach(([name, value]) => {
            const field = block.getField(name);
            if (field && typeof value !== 'object') {
              field.setValue(value);
            }
          });
        }

        block.initSvg();
        blocks.push(block);
      } catch (e) {
        console.error(`Failed to create block: ${step.type}`, e);
      }
    });

    // Connect blocks in sequence
    blocks.forEach((block, index) => {
      if (index > 0) {
        const previousBlock = blocks[index - 1];
        if (previousBlock.nextConnection && block.previousConnection) {
          previousBlock.nextConnection.connect(block.previousConnection);
        }
      }
    });

    // Position and render
    if (blocks.length > 0) {
      blocks[0].moveBy(30, 30);
      blocks.forEach(block => (block as Blockly.BlockSvg).render());
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    // Register blocks if needed
    if (!editCanvasBlocksRegistered) {
      registerBlocklyBlocks(builtInBlocks);
      editCanvasBlocksRegistered = true;
    }

    // Register plugin, snippet, and custom blocks
    const pluginBlocks = getPluginBlocks();
    if (pluginBlocks.length > 0) {
      registerBlocklyBlocks(pluginBlocks);
    }

    const snippetBlocks = getSnippetBlocks();
    if (snippetBlocks.length > 0) {
      registerBlocklyBlocks(snippetBlocks);
    }

    const customBlocks = getCustomBlocks();
    if (customBlocks.length > 0) {
      registerBlocklyBlocks(customBlocks);
    }

    // Create toolbox (exclude test_case since we're editing inside a block)
    const allBlocks = [...builtInBlocks, ...pluginBlocks, ...snippetBlocks, ...customBlocks]
      .filter(b => b.type !== 'test_case' && !b.type.startsWith('lifecycle_'));
    const toolbox = createToolbox(allBlocks);

    // Create workspace
    const workspace = Blockly.inject(containerRef.current, {
      toolbox,
      grid: {
        spacing: 20,
        length: 3,
        colour: '#f0f0f0',
        snap: true,
      },
      zoom: {
        controls: true,
        wheel: true,
        startScale: 0.9,
        maxScale: 2,
        minScale: 0.5,
        scaleSpeed: 1.2,
      },
      trashcan: true,
      move: {
        scrollbars: true,
        drag: true,
        wheel: true,
      },
      theme: Blockly.Themes.Classic,
    });

    workspaceRef.current = workspace;

    // Load initial steps
    isLoadingRef.current = true;
    loadSteps(workspace, steps);
    setTimeout(() => {
      isLoadingRef.current = false;
    }, 100);

    // Listen for changes
    const changeListener = (event: Blockly.Events.Abstract) => {
      if (isLoadingRef.current) return;

      if (
        event.type === Blockly.Events.BLOCK_CREATE ||
        event.type === Blockly.Events.BLOCK_DELETE ||
        event.type === Blockly.Events.BLOCK_CHANGE ||
        event.type === Blockly.Events.BLOCK_MOVE
      ) {
        const newSteps = workspaceToSteps(workspace);
        onStepsChange(newSteps);
      }
    };

    workspace.addChangeListener(changeListener);

    // Handle resize
    const handleResize = () => {
      Blockly.svgResize(workspace);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      workspace.removeChangeListener(changeListener);
      workspace.dispose();
      workspaceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount - steps changes handled via onStepsChange

  return (
    <div
      ref={containerRef}
      className="edit-block-canvas"
      style={{ width: '100%', height: '100%', minHeight: '300px' }}
    />
  );
}
