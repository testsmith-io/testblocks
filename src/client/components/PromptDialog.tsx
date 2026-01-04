import React, { useState, useEffect, useRef } from 'react';

export interface PromptField {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
}

export interface PromptDialogProps {
  isOpen: boolean;
  title: string;
  fields: PromptField[];
  onSubmit: (values: Record<string, string>) => void;
  onCancel: () => void;
  submitLabel?: string;
}

export function PromptDialog({
  isOpen,
  title,
  fields,
  onSubmit,
  onCancel,
  submitLabel = 'Create',
}: PromptDialogProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Initialize values with defaults
      const initial: Record<string, string> = {};
      fields.forEach(f => {
        initial[f.name] = f.defaultValue || '';
      });
      setValues(initial);
      // Focus first input after a short delay
      setTimeout(() => firstInputRef.current?.focus(), 50);
    }
  }, [isOpen, fields]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Check required fields
    const allValid = fields.every(f => !f.required || values[f.name]?.trim());
    if (allValid) {
      onSubmit(values);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal prompt-dialog"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="btn-close" onClick={onCancel}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {fields.map((field, index) => (
              <div key={field.name} className="prompt-field">
                <label htmlFor={`prompt-${field.name}`}>{field.label}</label>
                <input
                  ref={index === 0 ? firstInputRef : undefined}
                  type="text"
                  id={`prompt-${field.name}`}
                  value={values[field.name] || ''}
                  onChange={e => setValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                  placeholder={field.placeholder}
                  required={field.required}
                />
              </div>
            ))}
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
