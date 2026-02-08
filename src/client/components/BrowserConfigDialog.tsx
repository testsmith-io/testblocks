import React, { useState, useEffect, useRef } from 'react';

export interface BrowserConfig {
  headless: boolean;
  testIdAttribute: string;
  geolocation: { latitude: string; longitude: string };
  locale: string;
  timezoneId: string;
  viewport: { width: string; height: string };
  localStorage: { name: string; value: string }[];
}

interface BrowserConfigDialogProps {
  isOpen: boolean;
  config: BrowserConfig;
  onSave: (config: BrowserConfig) => void;
  onCancel: () => void;
}

export const defaultBrowserConfig: BrowserConfig = {
  headless: true,
  testIdAttribute: '',
  geolocation: { latitude: '', longitude: '' },
  locale: '',
  timezoneId: '',
  viewport: { width: '', height: '' },
  localStorage: [],
};

export function BrowserConfigDialog({ isOpen, config, onSave, onCancel }: BrowserConfigDialogProps) {
  const [local, setLocal] = useState<BrowserConfig>(config);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setLocal(config);
      setTimeout(() => firstInputRef.current?.focus(), 50);
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(local);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal browser-config-dialog"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="modal-header">
          <h2>Browser Configuration</h2>
          <button className="btn-close" onClick={onCancel}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="headless-field">
              <input
                type="checkbox"
                id="browser-headless"
                checked={local.headless}
                onChange={e => setLocal(prev => ({ ...prev, headless: e.target.checked }))}
              />
              <label htmlFor="browser-headless">Headless mode</label>
            </div>

            <div className="prompt-field">
              <label htmlFor="browser-testid">Test ID Attribute</label>
              <input
                ref={firstInputRef}
                type="text"
                id="browser-testid"
                value={local.testIdAttribute}
                onChange={e => setLocal(prev => ({ ...prev, testIdAttribute: e.target.value }))}
                placeholder="e.g., data-testid"
              />
            </div>

            <div className="prompt-field">
              <label>Viewport</label>
              <div className="field-row">
                <div className="prompt-field">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={local.viewport.width}
                    onChange={e => setLocal(prev => ({
                      ...prev,
                      viewport: { ...prev.viewport, width: e.target.value },
                    }))}
                    placeholder="1920"
                  />
                </div>
                <div className="prompt-field">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={local.viewport.height}
                    onChange={e => setLocal(prev => ({
                      ...prev,
                      viewport: { ...prev.viewport, height: e.target.value },
                    }))}
                    placeholder="1080"
                  />
                </div>
              </div>
            </div>

            <div className="prompt-field">
              <label htmlFor="browser-locale">Locale</label>
              <input
                type="text"
                id="browser-locale"
                value={local.locale}
                onChange={e => setLocal(prev => ({ ...prev, locale: e.target.value }))}
                placeholder="e.g., en-US"
              />
            </div>

            <div className="prompt-field">
              <label htmlFor="browser-timezone">Timezone ID</label>
              <input
                type="text"
                id="browser-timezone"
                value={local.timezoneId}
                onChange={e => setLocal(prev => ({ ...prev, timezoneId: e.target.value }))}
                placeholder="e.g., America/New_York"
              />
            </div>

            <div className="prompt-field">
              <label>Geolocation</label>
              <div className="field-row">
                <div className="prompt-field">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={local.geolocation.latitude}
                    onChange={e => setLocal(prev => ({
                      ...prev,
                      geolocation: { ...prev.geolocation, latitude: e.target.value },
                    }))}
                    placeholder="Latitude"
                  />
                </div>
                <div className="prompt-field">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={local.geolocation.longitude}
                    onChange={e => setLocal(prev => ({
                      ...prev,
                      geolocation: { ...prev.geolocation, longitude: e.target.value },
                    }))}
                    placeholder="Longitude"
                  />
                </div>
              </div>
            </div>

            <div className="prompt-field">
              <label>Local Storage</label>
              {local.localStorage.map((item, index) => (
                <div className="field-row localStorage-row" key={index}>
                  <div className="prompt-field">
                    <input
                      type="text"
                      value={item.name}
                      onChange={e => {
                        const updated = [...local.localStorage];
                        updated[index] = { ...updated[index], name: e.target.value };
                        setLocal(prev => ({ ...prev, localStorage: updated }));
                      }}
                      placeholder="Name"
                    />
                  </div>
                  <div className="prompt-field">
                    <input
                      type="text"
                      value={item.value}
                      onChange={e => {
                        const updated = [...local.localStorage];
                        updated[index] = { ...updated[index], value: e.target.value };
                        setLocal(prev => ({ ...prev, localStorage: updated }));
                      }}
                      placeholder="Value"
                    />
                  </div>
                  <button
                    type="button"
                    className="btn-icon btn-remove"
                    onClick={() => {
                      const updated = local.localStorage.filter((_, i) => i !== index);
                      setLocal(prev => ({ ...prev, localStorage: updated }));
                    }}
                    title="Remove"
                  >&times;</button>
                </div>
              ))}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setLocal(prev => ({
                  ...prev,
                  localStorage: [...prev.localStorage, { name: '', value: '' }],
                }))}
              >+ Add item</button>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
