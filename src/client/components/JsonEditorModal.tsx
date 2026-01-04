import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getVariableSuggestions, VariableInfo } from '../blockly/variableContext';

// Scope colors for visual distinction
const scopeColors: Record<string, string> = {
  global: '#4CAF50',    // Green
  file: '#2196F3',      // Blue
  folder: '#9C27B0',    // Purple
  test: '#FF9800',      // Orange
  procedure: '#607D8B', // Gray
};

interface JsonEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (json: string) => void;
  initialValue: string;
  title?: string;
}

export function JsonEditorModal({
  isOpen,
  onClose,
  onSave,
  initialValue,
  title = 'Edit JSON',
}: JsonEditorModalProps) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(true);

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<VariableInfo[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompletePosition, setAutocompletePosition] = useState({ top: 0, left: 0 });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
      validateJson(initialValue);
      setShowAutocomplete(false);
    }
  }, [isOpen, initialValue]);

  const validateJson = (json: string): boolean => {
    if (!json.trim()) {
      setError(null);
      setIsValid(true);
      return true;
    }

    try {
      JSON.parse(json);
      setError(null);
      setIsValid(true);
      return true;
    } catch (e) {
      const err = e as SyntaxError;
      setError(err.message);
      setIsValid(false);
      return false;
    }
  };

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

          // Position autocomplete near the cursor
          if (textareaRef.current) {
            const rect = textareaRef.current.getBoundingClientRect();
            // Simple positioning at the bottom of textarea
            setAutocompletePosition({
              top: rect.bottom + 2,
              left: rect.left,
            });
          }
          return;
        }
      }
    }

    setShowAutocomplete(false);
    setSuggestions([]);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    validateJson(newValue);
    checkForAutocomplete(newValue, e.target.selectionStart || 0);
  };

  const selectSuggestion = useCallback((index: number) => {
    if (index < 0 || index >= suggestions.length || !textareaRef.current) return;

    const variable = suggestions[index];
    const textarea = textareaRef.current;
    const cursorPos = textarea.selectionStart || 0;
    const text = value;

    const textBeforeCursor = text.substring(0, cursorPos);
    const lastDollarBrace = textBeforeCursor.lastIndexOf('${');

    if (lastDollarBrace !== -1) {
      const newValue =
        text.substring(0, lastDollarBrace) +
        '${' + variable.name + '}' +
        text.substring(cursorPos);

      setValue(newValue);
      validateJson(newValue);

      // Position cursor after inserted variable
      const newCursorPos = lastDollarBrace + variable.name.length + 3;
      setTimeout(() => {
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
      }, 0);
    }

    setShowAutocomplete(false);
    setSuggestions([]);
  }, [suggestions, value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showAutocomplete) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;

      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;

      case 'Enter':
        if (selectedIndex >= 0) {
          e.preventDefault();
          selectSuggestion(selectedIndex);
        }
        break;

      case 'Tab':
        if (selectedIndex >= 0) {
          e.preventDefault();
          selectSuggestion(selectedIndex);
        } else if (suggestions.length > 0) {
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

  const handleBlur = () => {
    // Delay to allow click on suggestion
    setTimeout(() => {
      setShowAutocomplete(false);
    }, 150);
  };

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(value);
      const formatted = JSON.stringify(parsed, null, 2);
      setValue(formatted);
      setError(null);
      setIsValid(true);
    } catch (e) {
      const err = e as SyntaxError;
      setError(`Cannot format: ${err.message}`);
    }
  };

  const handleMinify = () => {
    try {
      const parsed = JSON.parse(value);
      const minified = JSON.stringify(parsed);
      setValue(minified);
      setError(null);
      setIsValid(true);
    } catch (e) {
      const err = e as SyntaxError;
      setError(`Cannot minify: ${err.message}`);
    }
  };

  const handleSave = () => {
    if (validateJson(value)) {
      onSave(value);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal json-editor-modal"
        onClick={e => e.stopPropagation()}
      >
        <div className="json-editor-header">
          <h3>{title}</h3>
          <button className="btn-close" onClick={onClose}>&times;</button>
        </div>

        <div className="json-editor-toolbar">
          <button
            className="btn btn-small"
            onClick={handleFormat}
            title="Format JSON with indentation"
          >
            Format
          </button>
          <button
            className="btn btn-small"
            onClick={handleMinify}
            title="Minify JSON to single line"
          >
            Minify
          </button>
          <span className={`json-status ${isValid ? 'valid' : 'invalid'}`}>
            {isValid ? 'Valid JSON' : 'Invalid JSON'}
          </span>
          <span className="json-hint" style={{ marginLeft: 'auto', fontSize: '11px', color: '#888' }}>
            Type ${'${'} for variable autocomplete
          </span>
        </div>

        <div className="json-editor-content" style={{ position: 'relative' }}>
          <textarea
            ref={textareaRef}
            className={`json-textarea ${!isValid ? 'has-error' : ''}`}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            spellCheck={false}
            placeholder='{"key": "value"}'
          />
          {error && (
            <div className="json-error">
              {error}
            </div>
          )}

          {/* Autocomplete dropdown */}
          {showAutocomplete && suggestions.length > 0 && (
            <div
              ref={autocompleteRef}
              className="json-autocomplete-dropdown"
              style={{
                position: 'absolute',
                bottom: '60px',
                left: '0',
                right: '0',
                background: 'white',
                border: '1px solid #ccc',
                borderRadius: '4px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                maxHeight: '200px',
                overflowY: 'auto',
                zIndex: 1000,
              }}
            >
              {suggestions.map((variable, index) => (
                <div
                  key={variable.name}
                  className="json-autocomplete-item"
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: index === selectedIndex ? '#e3f2fd' : 'white',
                    borderBottom: '1px solid #eee',
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectSuggestion(index);
                  }}
                >
                  <span
                    style={{
                      background: scopeColors[variable.scope] || '#999',
                      color: 'white',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      fontSize: '10px',
                      textTransform: 'uppercase',
                      flexShrink: 0,
                    }}
                  >
                    {variable.scope.charAt(0).toUpperCase()}
                  </span>
                  <span style={{ fontWeight: 500, flex: 1, fontFamily: 'monospace' }}>
                    {'${' + variable.name + '}'}
                  </span>
                  {variable.description && (
                    <span style={{
                      color: '#888',
                      fontSize: '11px',
                      maxWidth: '200px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {variable.description.replace(/^(Global|File|Folder|Test|Procedure): /, '')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="json-editor-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!isValid}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
