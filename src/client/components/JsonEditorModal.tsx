import React, { useState, useEffect } from 'react';

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

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
      validateJson(initialValue);
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

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    validateJson(newValue);
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
        </div>

        <div className="json-editor-content">
          <textarea
            className={`json-textarea ${!isValid ? 'has-error' : ''}`}
            value={value}
            onChange={handleChange}
            spellCheck={false}
            placeholder='{"key": "value"}'
          />
          {error && (
            <div className="json-error">
              {error}
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
