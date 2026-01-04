import React, { useState } from 'react';

export interface FieldValue {
  fieldName: string;
  displayName: string;
  value: string;
}

interface CreateVariableDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateVariable: (value: string, type: 'global' | 'file', name: string) => void;
  fieldValues: FieldValue[];
  blockType: string;
}

export function CreateVariableDialog({
  isOpen,
  onClose,
  onCreateVariable,
  fieldValues,
  blockType,
}: CreateVariableDialogProps) {
  const [selectedField, setSelectedField] = useState<string | null>(
    fieldValues.length === 1 ? fieldValues[0].fieldName : null
  );
  const [variableName, setVariableName] = useState('');
  const [variableType, setVariableType] = useState<'global' | 'file'>('file');

  if (!isOpen) return null;

  const selectedValue = fieldValues.find(f => f.fieldName === selectedField)?.value || '';

  // Generate suggested variable name from value
  const getSuggestedName = (value: string): string => {
    return value
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 30) || 'variable';
  };

  const handleFieldSelect = (fieldName: string) => {
    setSelectedField(fieldName);
    const value = fieldValues.find(f => f.fieldName === fieldName)?.value || '';
    setVariableName(getSuggestedName(value));
  };

  const handleCreate = () => {
    if (!selectedField || !variableName.trim()) return;
    onCreateVariable(selectedValue, variableType, variableName.trim());
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content create-variable-dialog" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create Variable from Value</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>Block: <code>{blockType}</code></label>
          </div>

          {fieldValues.length > 1 && (
            <div className="form-group">
              <label>Select field value:</label>
              <div className="field-values-list">
                {fieldValues.map(field => (
                  <label key={field.fieldName} className="field-value-option">
                    <input
                      type="radio"
                      name="selectedField"
                      value={field.fieldName}
                      checked={selectedField === field.fieldName}
                      onChange={() => handleFieldSelect(field.fieldName)}
                    />
                    <span className="field-label">{field.displayName}:</span>
                    <span className="field-value" title={field.value}>
                      {field.value.length > 40 ? field.value.substring(0, 40) + '...' : field.value}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {fieldValues.length === 1 && (
            <div className="form-group">
              <label>Value:</label>
              <div className="single-field-value">
                <span className="field-label">{fieldValues[0].displayName}:</span>
                <span className="field-value">{fieldValues[0].value}</span>
              </div>
            </div>
          )}

          {selectedField && (
            <>
              <div className="form-group">
                <label>Variable type:</label>
                <div className="variable-type-options">
                  <label className="type-option">
                    <input
                      type="radio"
                      name="variableType"
                      value="file"
                      checked={variableType === 'file'}
                      onChange={() => setVariableType('file')}
                    />
                    <span>File Variable</span>
                    <span className="type-hint">Available in this test file</span>
                  </label>
                  <label className="type-option">
                    <input
                      type="radio"
                      name="variableType"
                      value="global"
                      checked={variableType === 'global'}
                      onChange={() => setVariableType('global')}
                    />
                    <span>Global Variable</span>
                    <span className="type-hint">Available across all test files</span>
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="variableName">Variable name:</label>
                <input
                  type="text"
                  id="variableName"
                  value={variableName}
                  onChange={e => setVariableName(e.target.value)}
                  placeholder="Enter variable name"
                  autoFocus
                />
                <div className="variable-preview">
                  Usage: <code>${`{${variableName || 'name'}}`}</code>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleCreate}
            disabled={!selectedField || !variableName.trim()}
          >
            Create Variable
          </button>
        </div>
      </div>
    </div>
  );
}
