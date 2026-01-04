import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { getVariableSuggestions, VariableInfo } from '../blockly/variableContext';

// Delay before hiding autocomplete on blur - allows click events on suggestions to fire first
const AUTOCOMPLETE_BLUR_DELAY_MS = 150;

// Scope colors for visual distinction
const scopeColors: Record<string, string> = {
  global: '#4CAF50',
  file: '#2196F3',
  folder: '#9C27B0',
  test: '#FF9800',
  procedure: '#607D8B',
};

export interface Variable {
  name: string;
  value: string;
}

interface VariablesEditorProps {
  variables: Variable[];
  onChange: (variables: Variable[]) => void;
  title?: string;
  emptyMessage?: string;
}

export function VariablesEditor({
  variables: externalVariables,
  onChange,
  title = 'Variables',
  emptyMessage = 'No variables defined',
}: VariablesEditorProps) {
  // Manage local state to allow editing empty variables
  const [localVariables, setLocalVariables] = useState<Variable[]>(externalVariables);
  const lastExternalRef = useRef<Variable[]>(externalVariables);

  // Sync external variables to local state ONLY when they actually change from outside
  // (not as a result of our own onChange calls)
  useEffect(() => {
    // Check if external variables changed from a different source (e.g., file switch)
    const externalChanged = JSON.stringify(externalVariables) !== JSON.stringify(lastExternalRef.current);

    if (externalChanged) {
      // Check if local has any empty-named variables (user is adding)
      const hasEmptyLocal = localVariables.some(v => !v.name.trim());

      if (!hasEmptyLocal) {
        setLocalVariables(externalVariables);
      }
      lastExternalRef.current = externalVariables;
    }
  }, [externalVariables, localVariables]);

  // Notify parent of changes (filter out empty names and don't propagate duplicates)
  const notifyChange = useCallback((vars: Variable[]) => {
    const validVars = vars.filter(v => v.name.trim() !== '');

    // Check for duplicates - don't propagate if there are any
    const nameSet = new Set<string>();
    let hasDuplicates = false;
    for (const v of validVars) {
      const lowerName = v.name.trim().toLowerCase();
      if (nameSet.has(lowerName)) {
        hasDuplicates = true;
        break;
      }
      nameSet.add(lowerName);
    }

    // Only propagate to parent if no duplicates
    if (!hasDuplicates) {
      lastExternalRef.current = validVars;
      onChange(validVars);
    }
  }, [onChange]);

  const handleAdd = () => {
    const newVars = [...localVariables, { name: '', value: '' }];
    setLocalVariables(newVars);
  };

  const handleUpdate = (index: number, field: 'name' | 'value', value: string) => {
    const updated = [...localVariables];
    updated[index] = { ...updated[index], [field]: value };
    setLocalVariables(updated);
    // Notify parent (will filter empty names)
    notifyChange(updated);
  };

  const handleDelete = (index: number) => {
    const updated = localVariables.filter((_, i) => i !== index);
    setLocalVariables(updated);
    notifyChange(updated);
  };

  // Memoize duplicate name detection
  const duplicateNames = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of localVariables) {
      if (v.name.trim()) {
        const name = v.name.trim().toLowerCase();
        counts.set(name, (counts.get(name) || 0) + 1);
      }
    }
    return new Set(
      [...counts.entries()].filter(([, count]) => count > 1).map(([name]) => name)
    );
  }, [localVariables]);

  return (
    <div className="variables-editor">
      {title && (
        <div className="variables-section-header">
          <h4>{title}</h4>
        </div>
      )}

      {localVariables.length === 0 ? (
        <div className="variables-empty">{emptyMessage}</div>
      ) : (
        localVariables.map((variable, index) => (
          <VariableEditorItem
            key={index}
            variable={variable}
            isDuplicate={duplicateNames.has(variable.name.trim().toLowerCase())}
            onUpdate={(field, value) => handleUpdate(index, field, value)}
            onDelete={() => handleDelete(index)}
          />
        ))
      )}

      <button className="add-variable-btn" onClick={handleAdd}>
        + Add Variable
      </button>
    </div>
  );
}

interface VariableEditorItemProps {
  variable: Variable;
  isDuplicate: boolean;
  onUpdate: (field: 'name' | 'value', value: string) => void;
  onDelete: () => void;
}

function VariableEditorItem({
  variable,
  isDuplicate,
  onUpdate,
  onDelete,
}: VariableEditorItemProps) {
  const [suggestions, setSuggestions] = useState<VariableInfo[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const valueInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Focus name input when newly added (empty name)
  useEffect(() => {
    if (variable.name === '' && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, []);

  // Check for ${} pattern and show autocomplete
  const checkForAutocomplete = useCallback((text: string, cursorPos: number) => {
    const textBeforeCursor = text.substring(0, cursorPos);
    const lastDollarBrace = textBeforeCursor.lastIndexOf('${');

    if (lastDollarBrace !== -1) {
      const textAfterDollar = textBeforeCursor.substring(lastDollarBrace);
      if (!textAfterDollar.includes('}')) {
        const partialVar = textAfterDollar.substring(2);
        const filteredSuggestions = getVariableSuggestions(partialVar);

        if (filteredSuggestions.length > 0) {
          setSuggestions(filteredSuggestions);
          setSelectedIndex(-1);
          setShowAutocomplete(true);
          return;
        }
      }
    }

    setShowAutocomplete(false);
    setSuggestions([]);
  }, []);

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onUpdate('value', newValue);
    checkForAutocomplete(newValue, e.target.selectionStart || 0);
  };

  const selectSuggestion = useCallback((suggestionIndex: number) => {
    if (suggestionIndex < 0 || suggestionIndex >= suggestions.length || !valueInputRef.current) return;

    const selectedVar = suggestions[suggestionIndex];
    const input = valueInputRef.current;
    const cursorPos = input.selectionStart || 0;
    const text = variable.value;

    const textBeforeCursor = text.substring(0, cursorPos);
    const lastDollarBrace = textBeforeCursor.lastIndexOf('${');

    if (lastDollarBrace !== -1) {
      const newValue =
        text.substring(0, lastDollarBrace) +
        '${' + selectedVar.name + '}' +
        text.substring(cursorPos);

      onUpdate('value', newValue);

      const newCursorPos = lastDollarBrace + selectedVar.name.length + 3;
      setTimeout(() => {
        input.setSelectionRange(newCursorPos, newCursorPos);
        input.focus();
      }, 0);
    }

    setShowAutocomplete(false);
    setSuggestions([]);
  }, [suggestions, variable.value, onUpdate]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showAutocomplete) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
        break;
      case 'Enter':
      case 'Tab':
        if (selectedIndex >= 0) {
          e.preventDefault();
          selectSuggestion(selectedIndex);
        } else if (suggestions.length > 0 && e.key === 'Tab') {
          e.preventDefault();
          selectSuggestion(0);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowAutocomplete(false);
        break;
    }
  };

  const handleInputBlur = () => {
    setTimeout(() => {
      setShowAutocomplete(false);
    }, AUTOCOMPLETE_BLUR_DELAY_MS);
  };

  return (
    <div className={`variable-editor-item ${isDuplicate ? 'duplicate' : ''}`}>
      <div className="var-name">
        <input
          ref={nameInputRef}
          type="text"
          value={variable.name}
          onChange={(e) => onUpdate('name', e.target.value)}
          onBlur={handleInputBlur}
          placeholder="name"
          style={isDuplicate ? { borderColor: '#f44336' } : undefined}
        />
        {isDuplicate && (
          <span className="duplicate-warning" title="Duplicate variable name">⚠</span>
        )}
      </div>
      <div className="var-value" style={{ position: 'relative' }}>
        <input
          ref={valueInputRef}
          type="text"
          value={variable.value}
          onChange={handleValueChange}
          onKeyDown={handleKeyDown}
          onBlur={handleInputBlur}
          placeholder="value (use ${var} for references)"
        />

        {/* Autocomplete dropdown */}
        {showAutocomplete && suggestions.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              background: 'white',
              border: '1px solid #ccc',
              borderRadius: '4px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              maxHeight: '150px',
              overflowY: 'auto',
              zIndex: 1000,
            }}
          >
            {suggestions.map((suggestion, idx) => (
              <div
                key={suggestion.name}
                style={{
                  padding: '6px 10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: idx === selectedIndex ? '#e3f2fd' : 'white',
                  borderBottom: '1px solid #eee',
                  fontSize: '12px',
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectSuggestion(idx);
                }}
              >
                <span
                  style={{
                    background: scopeColors[suggestion.scope] || '#999',
                    color: 'white',
                    padding: '1px 5px',
                    borderRadius: '3px',
                    fontSize: '9px',
                    textTransform: 'uppercase',
                  }}
                >
                  {suggestion.scope.charAt(0)}
                </span>
                <span style={{ fontFamily: 'monospace', flex: 1 }}>
                  {'${' + suggestion.name + '}'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="var-actions">
        <button className="btn-icon delete" onClick={onDelete} title="Delete variable">
          ×
        </button>
      </div>
    </div>
  );
}

// Helper to convert Record<string, unknown> to Variable[]
export function recordToVariables(record: Record<string, unknown> | null | undefined): Variable[] {
  if (!record) return [];
  return Object.entries(record).map(([name, value]) => ({
    name,
    value: typeof value === 'string' ? value : JSON.stringify(value),
  }));
}

// Helper to convert Variable[] back to Record<string, unknown>
export function variablesToRecord(variables: Variable[]): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  for (const v of variables) {
    if (v.name.trim()) {
      // Try to parse as JSON for complex values
      try {
        if (v.value.startsWith('{') || v.value.startsWith('[') || v.value === 'true' || v.value === 'false' || (!isNaN(Number(v.value)) && v.value !== '')) {
          record[v.name] = JSON.parse(v.value);
        } else {
          record[v.name] = v.value;
        }
      } catch {
        record[v.name] = v.value;
      }
    }
  }
  return record;
}
