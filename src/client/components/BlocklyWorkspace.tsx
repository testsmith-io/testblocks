import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as Blockly from 'blockly';
import { builtInBlocks, TestStep } from '../../core';
import { registerBlocklyBlocks, createToolbox, workspaceToTestSteps, loadStepsToWorkspace, getTestNameFromWorkspace, getTestDataFromWorkspace } from '../blockly/blockDefinitions';
import { analyzeSelectedBlocks, registerCustomBlock, updateCustomBlock, CustomBlockConfig, getCustomBlocks, getCustomBlockConfig, isCustomBlock, ExtractedParameter } from '../blockly/customBlockCreator';
import { CreateBlockDialog, CreateBlockResult } from './CreateBlockDialog';
import { JsonEditorModal } from './JsonEditorModal';
import { FileNode } from './FileTree';
import { getPluginBlocks, initializePlugins } from '../plugins';
import { loadSnippetsFromServer, getSnippetBlocks } from '../snippets';

// Block types that have JSON body fields
const JSON_BODY_BLOCKS = ['api_post', 'api_put', 'api_patch', 'api_set_headers', 'api_json_body'];

// Initialize plugins and snippets once when module loads
let pluginsInitialized = false;
let snippetsInitialized = false;

function ensurePluginsInitialized() {
  if (!pluginsInitialized) {
    initializePlugins();
    pluginsInitialized = true;
  }
}

async function ensureSnippetsInitialized(): Promise<void> {
  if (!snippetsInitialized) {
    await loadSnippetsFromServer();
    snippetsInitialized = true;
  }
}

interface BlocklyWorkspaceProps {
  onWorkspaceChange: (steps: unknown[], testName?: string, testData?: Array<{ name?: string; values: Record<string, unknown> }>) => void;
  onCustomBlockCreated?: (blockType: string) => void;
  onReplaceMatches?: (result: CreateBlockResult, blockType: string) => void;
  initialSteps?: unknown[];
  testName?: string;
  lifecycleType?: string; // 'beforeAll' | 'afterAll' | 'beforeEach' | 'afterEach'
  testData?: Array<{ name?: string; values: Record<string, unknown> }>; // Data for data-driven tests
  projectRoot?: FileNode | null;
  currentFilePath?: string;
}

// Register blocks once globally
let blocksRegistered = false;

export function BlocklyWorkspace({ onWorkspaceChange, onCustomBlockCreated, onReplaceMatches, initialSteps, testName, lifecycleType, testData, projectRoot, currentFilePath }: BlocklyWorkspaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const isLoadingRef = useRef(false);

  // Dialog state for creating/editing custom blocks
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [dialogData, setDialogData] = useState<{
    suggestedParams: ExtractedParameter[];
    steps: TestStep[];
    editMode?: boolean;
    existingConfig?: CustomBlockConfig;
    originalBlockType?: string;
  } | null>(null);

  // JSON editor modal state
  const [jsonEditorOpen, setJsonEditorOpen] = useState(false);
  const [jsonEditorValue, setJsonEditorValue] = useState('');
  const [jsonEditorBlockId, setJsonEditorBlockId] = useState<string | null>(null);
  const [jsonEditorFieldName, setJsonEditorFieldName] = useState<string>('BODY');

  // Store callback in ref to avoid re-initialization
  const onChangeRef = useRef(onWorkspaceChange);
  onChangeRef.current = onWorkspaceChange;

  const onCustomBlockCreatedRef = useRef(onCustomBlockCreated);
  onCustomBlockCreatedRef.current = onCustomBlockCreated;

  // Store initial values in refs - only used on mount
  const initialStepsRef = useRef(initialSteps);
  const testNameRef = useRef(testName);
  const lifecycleTypeRef = useRef(lifecycleType);
  const testDataRef = useRef(testData);

  // Store selected block IDs for replacement after dialog
  const selectedBlockIdsRef = useRef<string[]>([]);

  // Store onReplaceMatches in a ref to avoid stale closures
  const onReplaceMatchesRef = useRef(onReplaceMatches);
  onReplaceMatchesRef.current = onReplaceMatches;

  // Handle creating or updating a custom block from the dialog
  const handleCreateBlock = useCallback((result: CreateBlockResult) => {
    const { config, selectedMatches } = result;
    console.log('[handleCreateBlock] Received result with', selectedMatches.length, 'matches to replace');
    console.log('[handleCreateBlock] Match details:', selectedMatches.map(m => ({
      file: m.fileName,
      test: m.testCaseName,
      location: m.location,
      indices: `${m.startIndex}-${m.endIndex}`
    })));
    const workspace = workspaceRef.current;
    const isEditing = dialogData?.editMode && dialogData?.originalBlockType;

    let blockType: string;
    if (isEditing) {
      // Update existing block
      blockType = updateCustomBlock(dialogData.originalBlockType!, config);
    } else {
      // Create new block
      blockType = registerCustomBlock(config);
    }

    // Update the toolbox to include the new/updated custom block
    if (workspace) {
      const allBlocks = [...builtInBlocks, ...getPluginBlocks(), ...getSnippetBlocks(), ...getCustomBlocks()];
      const toolbox = createToolbox(allBlocks);
      workspace.updateToolbox(toolbox);

      // Replace selected blocks with the new custom block (only for new blocks)
      if (!isEditing && selectedBlockIdsRef.current.length > 0) {
        const blockIds = selectedBlockIdsRef.current;

        // Find the first and last blocks in the chain
        const blocks = blockIds
          .map(id => workspace.getBlockById(id))
          .filter((b): b is Blockly.Block => b !== null);

        if (blocks.length > 0) {
          // Sort by Y position to find the chain order
          blocks.sort((a, b) => {
            const posA = a.getRelativeToSurfaceXY();
            const posB = b.getRelativeToSurfaceXY();
            return posA.y - posB.y;
          });

          const firstBlock = blocks[0];
          const lastBlock = blocks[blocks.length - 1];

          // Get connections to preserve
          const previousBlock = firstBlock.getPreviousBlock();
          const nextBlock = lastBlock.getNextBlock();
          const position = firstBlock.getRelativeToSurfaceXY();

          // Disable events during block manipulation to prevent errors
          Blockly.Events.disable();
          try {
            // Create the new custom block
            const newBlock = workspace.newBlock(blockType);

            // Set default parameter values from config
            config.parameters.forEach(param => {
              const field = newBlock.getField(param.name.toUpperCase());
              if (field && param.defaultValue !== undefined) {
                field.setValue(param.defaultValue);
              }
            });

            newBlock.initSvg();
            (newBlock as Blockly.BlockSvg).render();

            // Connect to previous block or position
            if (previousBlock && previousBlock.nextConnection && newBlock.previousConnection) {
              previousBlock.nextConnection.connect(newBlock.previousConnection);
            } else {
              newBlock.moveBy(position.x, position.y);
            }

            // Connect to next block
            if (nextBlock && newBlock.nextConnection && nextBlock.previousConnection) {
              newBlock.nextConnection.connect(nextBlock.previousConnection);
            }

            // Delete the original blocks (check if still valid before disposing)
            blocks.forEach(block => {
              if (block && !block.disposed) {
                block.dispose(false);
              }
            });
          } finally {
            Blockly.Events.enable();
          }

          // Manually trigger workspace change to sync state since we disabled events
          if (onChangeRef.current) {
            const steps = workspaceToTestSteps(workspace);
            console.log('[handleCreateBlock] Syncing workspace state after block replacement');
            onChangeRef.current(steps);
          }
        }

        selectedBlockIdsRef.current = [];
      }
    }

    // Notify parent
    if (onCustomBlockCreatedRef.current) {
      onCustomBlockCreatedRef.current(blockType);
    }

    // Always notify parent to handle matches and save procedure to current file
    // (even if no matches, we need to save the procedure definition)
    if (onReplaceMatchesRef.current) {
      onReplaceMatchesRef.current(result, blockType);
    }

    setShowCreateDialog(false);
    setDialogData(null);
  }, [dialogData]);

  // Handle saving JSON from the editor
  const handleJsonSave = useCallback((newValue: string) => {
    if (!jsonEditorBlockId || !workspaceRef.current) return;

    const block = workspaceRef.current.getBlockById(jsonEditorBlockId);
    if (!block) return;

    const field = block.getField(jsonEditorFieldName);
    if (field) {
      field.setValue(newValue);
    }

    setJsonEditorOpen(false);
    setJsonEditorBlockId(null);
  }, [jsonEditorBlockId, jsonEditorFieldName]);

  useEffect(() => {
    if (!containerRef.current) return;

    let isMounted = true;
    let cleanupFns: (() => void)[] = [];

    // Initialize and create workspace asynchronously
    const initWorkspace = async () => {
      if (!containerRef.current || !isMounted) return;

      // Initialize plugins first
      ensurePluginsInitialized();

      // Load snippets from server
      await ensureSnippetsInitialized();

      if (!containerRef.current || !isMounted) return;

      // Register blocks only once
      if (!blocksRegistered) {
        registerBlocklyBlocks(builtInBlocks);
        blocksRegistered = true;
      }

      // Get plugin blocks and register them with Blockly
      const pluginBlocks = getPluginBlocks();
      if (pluginBlocks.length > 0) {
        registerBlocklyBlocks(pluginBlocks);
      }

      // Get snippet blocks and register them with Blockly
      const snippetBlocks = getSnippetBlocks();
      if (snippetBlocks.length > 0) {
        registerBlocklyBlocks(snippetBlocks);
      }

      // Get custom blocks and register them with Blockly
      const customBlocks = getCustomBlocks();
      if (customBlocks.length > 0) {
        registerBlocklyBlocks(customBlocks);
      }

      // Create toolbox with built-in, plugin, snippet, and custom blocks
      const allBlocks = [...builtInBlocks, ...pluginBlocks, ...snippetBlocks, ...customBlocks];
      const toolbox = createToolbox(allBlocks);

      // Initialize workspace
      const workspace = Blockly.inject(containerRef.current, {
        toolbox,
        grid: {
          spacing: 20,
          length: 3,
          colour: '#e0e0e0',
          snap: true,
        },
        zoom: {
          controls: true,
          wheel: true,
          startScale: 1.0,
          maxScale: 3,
          minScale: 0.3,
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

      // Track multi-selected blocks
      const multiSelectedBlocks = new Set<string>();

      // Add click handler for multi-select (Shift+Click or Ctrl/Cmd+Click)
      const onBlockClick = (event: Event) => {
        const e = event as MouseEvent;
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
          // Clear selection on regular click
          multiSelectedBlocks.forEach(id => {
            const block = workspace.getBlockById(id);
            if (block) {
              block.setHighlighted(false);
            }
          });
          multiSelectedBlocks.clear();
        }
      };
      workspace.getParentSvg().addEventListener('click', onBlockClick);

      // Override block selection to support multi-select
      workspace.addChangeListener((event) => {
        if (event.type === Blockly.Events.CLICK) {
          const clickEvent = event as Blockly.Events.Click;
          if (clickEvent.blockId) {
            const block = workspace.getBlockById(clickEvent.blockId);
            if (block && block.type !== 'test_case') {
              // Check if Shift or Ctrl/Cmd is held (we detect this via a data attribute)
              const isMultiSelect = (window as unknown as { __blocklyMultiSelect?: boolean }).__blocklyMultiSelect;
              if (isMultiSelect) {
                if (multiSelectedBlocks.has(clickEvent.blockId)) {
                  // Deselect
                  multiSelectedBlocks.delete(clickEvent.blockId);
                  block.setHighlighted(false);
                } else {
                  // Add to selection
                  multiSelectedBlocks.add(clickEvent.blockId);
                  block.setHighlighted(true);
                }
              }
            }
          }
        }
      });

      // Track modifier keys globally
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          (window as unknown as { __blocklyMultiSelect?: boolean }).__blocklyMultiSelect = true;
        }
      };
      const onKeyUp = (e: KeyboardEvent) => {
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
          (window as unknown as { __blocklyMultiSelect?: boolean }).__blocklyMultiSelect = false;
        }
      };
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);

      // Register custom context menu for creating blocks from selection
      const createBlockMenuItem = {
        displayText: () => {
          const count = multiSelectedBlocks.size;
          if (count > 1) {
            return `Create Reusable Block from ${count} Selected Blocks`;
          }
          return 'Create Reusable Block from Connected Blocks';
        },
        preconditionFn: (scope: { block?: Blockly.Block }) => {
          // Show if at least one actionable block is selected
          if (scope.block && scope.block.type !== 'test_case') {
            return 'enabled';
          }
          return 'hidden';
        },
        callback: (scope: { block?: Blockly.Block }) => {
          if (!scope.block) return;

          let selectedBlocks: Blockly.Block[] = [];

          // If we have multi-selected blocks, use those
          if (multiSelectedBlocks.size > 1) {
            selectedBlocks = Array.from(multiSelectedBlocks)
              .map(id => workspace.getBlockById(id))
              .filter((b): b is Blockly.Block => b !== null && b.type !== 'test_case');
          } else {
            // Otherwise, use the chain of connected blocks
            let current: Blockly.Block | null = scope.block;

            // First, find the start of the chain
            while (current.getPreviousBlock()) {
              const prev = current.getPreviousBlock();
              if (prev && prev.type !== 'test_case') {
                current = prev;
              } else {
                break;
              }
            }

            // Now collect all connected blocks
            while (current) {
              if (current.type !== 'test_case') {
                selectedBlocks.push(current);
              }
              current = current.getNextBlock();
            }
          }

          // Analyze the selected blocks
          const { steps, suggestedParams } = analyzeSelectedBlocks(selectedBlocks);

          if (steps.length === 0) {
            alert('No valid blocks selected');
            return;
          }

          // Store selected block IDs for replacement after creation
          selectedBlockIdsRef.current = selectedBlocks.map(b => b.id);

          // Clear multi-selection highlighting
          multiSelectedBlocks.forEach(id => {
            const block = workspace.getBlockById(id);
            if (block) {
              block.setHighlighted(false);
            }
          });
          multiSelectedBlocks.clear();

          // Open the dialog
          setDialogData({ steps, suggestedParams });
          setShowCreateDialog(true);
        },
        scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
        id: 'create_reusable_block',
        weight: 200,
      };

      // Register the menu item
      try {
        Blockly.ContextMenuRegistry.registry.unregister('create_reusable_block');
      } catch {
        // Item not registered yet, that's fine
      }
      Blockly.ContextMenuRegistry.registry.register(createBlockMenuItem);

      // Edit custom block context menu
      const editBlockMenuItem = {
        displayText: () => 'Edit Reusable Block',
        preconditionFn: (scope: { block?: Blockly.Block }) => {
          // Show only for custom blocks (not snippets - those come from server)
          if (scope.block && isCustomBlock(scope.block.type)) {
            return 'enabled';
          }
          return 'hidden';
        },
        callback: (scope: { block?: Blockly.Block }) => {
          if (!scope.block) return;

          const blockType = scope.block.type;
          const config = getCustomBlockConfig(blockType);

          if (!config) {
            alert('Could not find block configuration');
            return;
          }

          // Extract parameters from the config for editing
          const suggestedParams: ExtractedParameter[] = config.parameters.map(p => ({
            name: p.name,
            fieldType: p.fieldType,
            defaultValue: p.defaultValue,
            blockType: p.blockType,
            originalFieldName: p.originalFieldName,
          }));

          // Open the dialog in edit mode
          setDialogData({
            steps: config.steps,
            suggestedParams,
            editMode: true,
            existingConfig: config,
            originalBlockType: blockType,
          });
          setShowCreateDialog(true);
        },
        scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
        id: 'edit_reusable_block',
        weight: 201,
      };

      // Register the edit menu item
      try {
        Blockly.ContextMenuRegistry.registry.unregister('edit_reusable_block');
      } catch {
        // Item not registered yet, that's fine
      }
      Blockly.ContextMenuRegistry.registry.register(editBlockMenuItem);

      // Edit JSON body context menu for API blocks
      const editJsonMenuItem = {
        displayText: () => 'Edit JSON Body',
        preconditionFn: (scope: { block?: Blockly.Block }) => {
          if (scope.block && JSON_BODY_BLOCKS.includes(scope.block.type)) {
            return 'enabled';
          }
          return 'hidden';
        },
        callback: (scope: { block?: Blockly.Block }) => {
          if (!scope.block) return;

          // Determine which field to edit based on block type
          let fieldName = 'BODY';
          if (scope.block.type === 'api_set_headers') {
            fieldName = 'HEADERS';
          } else if (scope.block.type === 'api_json_body') {
            fieldName = 'JSON';
          }

          const field = scope.block.getField(fieldName);
          const currentValue = field ? String(field.getValue()) : '{}';

          setJsonEditorBlockId(scope.block.id);
          setJsonEditorFieldName(fieldName);
          setJsonEditorValue(currentValue);
          setJsonEditorOpen(true);
        },
        scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
        id: 'edit_json_body',
        weight: 50,
      };

      // Register the JSON editor menu item
      try {
        Blockly.ContextMenuRegistry.registry.unregister('edit_json_body');
      } catch {
        // Item not registered yet, that's fine
      }
      Blockly.ContextMenuRegistry.registry.register(editJsonMenuItem);

      // Load initial steps - use refs to get initial values
      isLoadingRef.current = true;
      const steps = initialStepsRef.current;
      const name = testNameRef.current;
      const lifecycleT = lifecycleTypeRef.current;
      const data = testDataRef.current;

      try {
        if (steps && typeof steps === 'object' && !Array.isArray(steps) && 'blocks' in steps) {
          // Blockly's native serialization format
          Blockly.serialization.workspaces.load(steps as Blockly.serialization.workspaces.State, workspace);
        } else {
          // Our TestStep[] format or empty - wrap in container block
          loadStepsToWorkspace(workspace, Array.isArray(steps) ? steps : [], name, lifecycleT, data);
        }
      } catch (e) {
        console.error('Failed to load workspace state:', e);
        // Create empty container on error
        loadStepsToWorkspace(workspace, [], name, lifecycleT, data);
      }

      // Allow change events after initial load
      setTimeout(() => {
        isLoadingRef.current = false;
      }, 100);

      // Add change listener
      const changeListener = (event: Blockly.Events.Abstract) => {
        // Skip events during initial load
        if (isLoadingRef.current) return;

        // Only handle user-initiated changes
        if (
          event.type === Blockly.Events.BLOCK_CREATE ||
          event.type === Blockly.Events.BLOCK_DELETE ||
          event.type === Blockly.Events.BLOCK_CHANGE ||
          event.type === Blockly.Events.BLOCK_MOVE
        ) {
          if (workspaceRef.current) {
            const newSteps = workspaceToTestSteps(workspaceRef.current);
            const newTestName = getTestNameFromWorkspace(workspaceRef.current);
            const newTestData = getTestDataFromWorkspace(workspaceRef.current);
            onChangeRef.current(newSteps, newTestName, newTestData);
          }
        }
      };

      workspace.addChangeListener(changeListener);

      // Handle window resize
      const handleResize = () => {
        Blockly.svgResize(workspace);
      };
      window.addEventListener('resize', handleResize);

      // Store cleanup functions
      cleanupFns = [
        () => window.removeEventListener('resize', handleResize),
        () => window.removeEventListener('keydown', onKeyDown),
        () => window.removeEventListener('keyup', onKeyUp),
        () => workspace.getParentSvg().removeEventListener('click', onBlockClick),
        () => workspace.removeChangeListener(changeListener),
        () => {
          workspace.dispose();
          workspaceRef.current = null;
        },
      ];
    };

    // Start initialization
    initWorkspace();

    // Cleanup
    return () => {
      isMounted = false;
      cleanupFns.forEach(fn => fn());
    };
  }, []); // Empty dependency array - only run on mount/unmount

  return (
    <>
      <div
        ref={containerRef}
        id="blockly-div"
        style={{ width: '100%', height: '100%' }}
      />
      {dialogData && (
        <CreateBlockDialog
          isOpen={showCreateDialog}
          onClose={() => {
            setShowCreateDialog(false);
            setDialogData(null);
          }}
          onCreateBlock={handleCreateBlock}
          suggestedParams={dialogData.suggestedParams}
          steps={dialogData.steps}
          projectRoot={projectRoot || null}
          currentFilePath={currentFilePath}
          editMode={dialogData.editMode}
          existingConfig={dialogData.existingConfig}
          originalBlockType={dialogData.originalBlockType}
        />
      )}
      <JsonEditorModal
        isOpen={jsonEditorOpen}
        onClose={() => {
          setJsonEditorOpen(false);
          setJsonEditorBlockId(null);
        }}
        onSave={handleJsonSave}
        initialValue={jsonEditorValue}
        title={jsonEditorFieldName === 'HEADERS' ? 'Edit Headers JSON' : 'Edit JSON Body'}
      />
    </>
  );
}

// Utility to get workspace state for saving
export function getWorkspaceState(workspace: Blockly.WorkspaceSvg): unknown {
  return Blockly.serialization.workspaces.save(workspace);
}
