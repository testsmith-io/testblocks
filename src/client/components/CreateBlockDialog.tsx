import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { ExtractedParameter, CustomBlockConfig } from '../blockly/customBlockCreator';
import { BlockMatch, findMatchingSequences, groupMatchesByFile } from '../blockly/blockMatcher';
import { TestStep } from '../../core';
import { EditBlockCanvas } from './EditBlockCanvas';
import { FileNode } from './FileTree';
import { toast } from './Toast';

export interface CreateBlockResult {
  config: CustomBlockConfig;
  selectedMatches: BlockMatch[];
}

interface CreateBlockDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateBlock: (result: CreateBlockResult) => void;
  suggestedParams: ExtractedParameter[];
  steps: TestStep[];
  projectRoot: FileNode | null;
  currentFilePath?: string;
  // Edit mode props
  editMode?: boolean;
  existingConfig?: CustomBlockConfig;
  originalBlockType?: string;
}

export function CreateBlockDialog({
  isOpen,
  onClose,
  onCreateBlock,
  suggestedParams,
  steps: initialSteps,
  projectRoot,
  currentFilePath,
  editMode = false,
  existingConfig,
  originalBlockType: _originalBlockType,
}: CreateBlockDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedParams, setSelectedParams] = useState<Set<string>>(
    new Set(suggestedParams.map(p => p.name))
  );
  const [color, setColor] = useState('#607D8B');
  const [editableSteps, setEditableSteps] = useState<TestStep[]>(initialSteps);
  const [showCanvas, setShowCanvas] = useState(false);
  const createButtonRef = useRef<HTMLButtonElement>(null);

  // Scanning state
  const [matches, setMatches] = useState<BlockMatch[]>([]);
  const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set());
  const [isScanning, setIsScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);

  // Compute parameters from current steps
  const currentParams = useMemo(() => {
    // For now, use the suggested params - in the future we could re-analyze
    return suggestedParams;
  }, [suggestedParams]);

  // Initialize form with existing config when in edit mode
  useEffect(() => {
    if (editMode && existingConfig) {
      setName(existingConfig.name);
      setDescription(existingConfig.description);
      setColor(existingConfig.color);
      setSelectedParams(new Set(existingConfig.parameters.map(p => p.name)));
      setEditableSteps(existingConfig.steps);
      setShowCanvas(true); // Always show canvas in edit mode
    } else if (!editMode) {
      // Reset form for create mode
      setName('');
      setDescription('');
      setColor('#607D8B');
      setSelectedParams(new Set(suggestedParams.map(p => p.name)));
      setEditableSteps(initialSteps);
      setShowCanvas(false);
    }
    // Reset scanning state
    setMatches([]);
    setSelectedMatches(new Set());
    setHasScanned(false);
    setIsScanning(false);
  }, [editMode, existingConfig, suggestedParams, initialSteps]);

  const handleToggleParam = useCallback((paramName: string) => {
    setSelectedParams(prev => {
      const next = new Set(prev);
      if (next.has(paramName)) {
        next.delete(paramName);
      } else {
        next.add(paramName);
      }
      return next;
    });
  }, []);

  const handleStepsChange = useCallback((newSteps: TestStep[]) => {
    setEditableSteps(newSteps);
  }, []);

  const handleScanProject = useCallback(() => {
    if (!projectRoot || editableSteps.length === 0) return;

    console.log('[handleScanProject] Scanning for steps:', editableSteps.map(s => s.type));
    console.log('[handleScanProject] Current file path:', currentFilePath);

    setIsScanning(true);
    // Use setTimeout to allow UI to update before scanning
    setTimeout(() => {
      const foundMatches = findMatchingSequences(editableSteps, projectRoot, currentFilePath);
      console.log('[handleScanProject] Found', foundMatches.length, 'matches:', foundMatches.map(m => ({
        file: m.fileName,
        test: m.testCaseName,
        location: m.location,
        indices: `${m.startIndex}-${m.endIndex}`
      })));
      setMatches(foundMatches);
      // Auto-select all matches by default
      setSelectedMatches(new Set(foundMatches.map(m => m.id)));
      setHasScanned(true);
      setIsScanning(false);
    }, 50);
  }, [projectRoot, editableSteps, currentFilePath]);

  const handleToggleMatch = useCallback((matchId: string) => {
    setSelectedMatches(prev => {
      const next = new Set(prev);
      if (next.has(matchId)) {
        next.delete(matchId);
      } else {
        next.add(matchId);
      }
      return next;
    });
  }, []);

  const handleSelectAllMatches = useCallback(() => {
    setSelectedMatches(new Set(matches.map(m => m.id)));
  }, [matches]);

  const handleDeselectAllMatches = useCallback(() => {
    setSelectedMatches(new Set());
  }, []);

  const handleCreate = useCallback(() => {
    if (!name.trim()) {
      toast.warning('Please enter a block name');
      return;
    }

    if (editableSteps.length === 0) {
      toast.warning('Please add at least one step to the block');
      return;
    }

    const config: CustomBlockConfig = {
      name: name.trim(),
      description: description.trim(),
      parameters: currentParams.filter(p => selectedParams.has(p.name)),
      steps: editableSteps,
      color,
    };

    // Get selected matches to replace
    const matchesToReplace = matches.filter(m => selectedMatches.has(m.id));
    console.log('[CreateBlockDialog] Creating block with', matchesToReplace.length, 'matches to replace');
    console.log('[CreateBlockDialog] All matches:', matches.length, 'Selected IDs:', Array.from(selectedMatches));

    onCreateBlock({ config, selectedMatches: matchesToReplace });
    onClose();

    // Reset form
    setName('');
    setDescription('');
    setColor('#607D8B');
    setShowCanvas(false);
  }, [name, description, selectedParams, currentParams, editableSteps, color, matches, selectedMatches, onCreateBlock, onClose]);

  // Store handleCreate in a ref to avoid stale closures in the native event listener
  const handleCreateRef = useRef(handleCreate);
  handleCreateRef.current = handleCreate;

  // Use native event listener with capture phase to ensure we get the click before Blockly
  useEffect(() => {
    const button = createButtonRef.current;
    if (!button) return;

    const handlePointerDown = (e: PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      // Defer to next frame to avoid interfering with React state updates
      requestAnimationFrame(() => {
        handleCreateRef.current();
      });
    };

    button.addEventListener('pointerdown', handlePointerDown, { capture: true });
    return () => {
      button.removeEventListener('pointerdown', handlePointerDown, { capture: true });
    };
  }, [isOpen]); // Re-attach when dialog opens

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal create-block-modal"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: showCanvas ? '1400px' : '500px',
          width: showCanvas ? '98vw' : '500px',
          height: showCanvas ? '90vh' : 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <h2>{editMode ? 'Edit Reusable Block' : 'Create Reusable Block'}</h2>

        <div className="create-block-content" style={{ display: 'flex', gap: '20px', flex: 1, overflow: 'hidden' }}>
          {/* Left side: Form */}
          <div className="create-block-form" style={{ flex: showCanvas ? '0 0 300px' : '1', overflowY: 'auto' }}>
            <div className="form-group">
              <label>Block Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g., Login, Add To Cart"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What does this block do?"
              />
            </div>

            <div className="form-group">
              <label>Block Color</label>
              <div className="color-picker">
                {['#607D8B', '#9C27B0', '#E91E63', '#4CAF50', '#FF9800', '#2196F3'].map(c => (
                  <button
                    key={c}
                    className={`color-option ${color === c ? 'selected' : ''}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Parameters ({selectedParams.size} selected)</label>
              <p className="helper-text">
                Select which values should be configurable:
              </p>
              <div className="param-list" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                {currentParams.length === 0 ? (
                  <div className="empty-params">No configurable parameters detected</div>
                ) : (
                  currentParams.map(param => (
                    <label key={param.name} className="param-item">
                      <input
                        type="checkbox"
                        checked={selectedParams.has(param.name)}
                        onChange={() => handleToggleParam(param.name)}
                      />
                      <span className="param-name">{param.name}</span>
                      <span className="param-default">
                        = {formatValue(param.defaultValue)}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>

            {/* Steps preview or toggle */}
            {!showCanvas && (
              <div className="form-group">
                <label>Steps ({editableSteps.length})</label>
                <div className="steps-preview">
                  {editableSteps.map((step, index) => (
                    <div key={step.id || index} className="step-preview-item">
                      <span className="step-number">{index + 1}.</span>
                      <span className="step-type">{formatBlockType(step.type)}</span>
                    </div>
                  ))}
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowCanvas(true)}
                  style={{ marginTop: '10px', width: '100%' }}
                >
                  Edit Steps Visually
                </button>
              </div>
            )}

            {/* Scan for matches section - only in create mode */}
            {!editMode && projectRoot && (
              <div className="form-group">
                <label>Find & Replace in Project</label>
                <button
                  className="btn btn-secondary scan-project-btn"
                  onClick={handleScanProject}
                  disabled={isScanning || editableSteps.length === 0}
                  style={{ width: '100%' }}
                >
                  {isScanning ? 'Scanning...' : 'Scan Project for Matches'}
                </button>

                {hasScanned && (
                  <div className="matches-section">
                    {matches.length === 0 ? (
                      <p className="helper-text" style={{ marginTop: '10px' }}>
                        No matching sequences found in other files.
                      </p>
                    ) : (
                      <>
                        <div className="matches-header">
                          <span>Found {matches.length} match{matches.length !== 1 ? 'es' : ''}</span>
                          <div className="matches-actions">
                            <button
                              className="btn-link"
                              onClick={handleSelectAllMatches}
                            >
                              Select all
                            </button>
                            <button
                              className="btn-link"
                              onClick={handleDeselectAllMatches}
                            >
                              Deselect all
                            </button>
                          </div>
                        </div>
                        <div className="matches-list">
                          {Array.from(groupMatchesByFile(matches)).map(([filePath, fileMatches]) => (
                            <div key={filePath} className="match-file-group">
                              <div className="match-file-name">{fileMatches[0].fileName}</div>
                              {fileMatches.map(match => (
                                <label key={match.id} className="match-item">
                                  <input
                                    type="checkbox"
                                    checked={selectedMatches.has(match.id)}
                                    onChange={() => handleToggleMatch(match.id)}
                                  />
                                  <span className="match-location">
                                    {match.testCaseName}
                                    <span className="match-detail">
                                      {match.location === 'steps'
                                        ? ` (steps ${match.startIndex + 1}-${match.endIndex + 1})`
                                        : ` (${match.location})`
                                      }
                                    </span>
                                  </span>
                                </label>
                              ))}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right side: Canvas (when visible) */}
          {showCanvas && (
            <div className="create-block-canvas" style={{ flex: 1, minWidth: '500px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ margin: 0 }}>Steps ({editableSteps.length})</label>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowCanvas(false)}
                  style={{ padding: '4px 8px', fontSize: '12px' }}
                >
                  Hide Canvas
                </button>
              </div>
              <div style={{
                border: '1px solid #ddd',
                borderRadius: '4px',
                flex: 1,
                minHeight: '400px',
              }}>
                <EditBlockCanvas
                  steps={editableSteps}
                  onStepsChange={handleStepsChange}
                />
              </div>
              <p className="helper-text" style={{ marginTop: '8px' }}>
                Drag blocks from the toolbox to add steps. Connect them vertically.
              </p>
            </div>
          )}
        </div>

        <div
          className="modal-actions"
          onMouseDown={() => {
            // Blur any focused element (like Blockly workspace) to ensure button clicks work
            if (document.activeElement instanceof HTMLElement) {
              document.activeElement.blur();
            }
          }}
        >
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            ref={createButtonRef}
            className="btn btn-primary"
          >
            {editMode
              ? 'Save Changes'
              : selectedMatches.size > 0
                ? `Create & Replace ${selectedMatches.size} Match${selectedMatches.size !== 1 ? 'es' : ''}`
                : 'Create Block'
            }
          </button>
        </div>
      </div>
    </div>
  );
}

function formatBlockType(type: string): string {
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') {
    return value.length > 20 ? `"${value.slice(0, 20)}..."` : `"${value}"`;
  }
  return String(value);
}
