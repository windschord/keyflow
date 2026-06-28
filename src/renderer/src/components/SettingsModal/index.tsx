import React, { useState, useEffect } from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AppSettings {
  ui: { theme: 'light' | 'dark' | 'system'; language: string; zoom: number; pianoHeight: number };
  practice: { defaultErrorMode: 'wait' | 'pass'; metronomeEnabled: boolean };
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [recentFiles, setRecentFiles] = useState<Array<{ path: string; openedAt: string }>>([]);

  useEffect(() => {
    if (isOpen) {
      const loadSettings = async (): Promise<void> => {
        try {
          const ui = await window.electronAPI.settings.get('ui');
          const practice = await window.electronAPI.settings.get('practice');
          const files = await window.electronAPI.settings.getRecentFiles();

          const finalUi = ui || { theme: 'system', language: 'ja', zoom: 1.0, pianoHeight: 120 };
          // Apply defaults if necessary
          setSettings({
            ui: finalUi,
            practice: practice || { defaultErrorMode: 'wait', metronomeEnabled: false },
          });
          setRecentFiles(files || []);

          // Apply initial theme
          applyTheme(finalUi.theme);
        } catch (error) {
          console.error('Failed to load settings:', error);
        }
      };
      loadSettings();
    }
  }, [isOpen]);

  if (!isOpen || !settings) return null;

  const applyTheme = (theme: string) => {
    if (theme === 'dark') {
      document.documentElement.className = 'dark';
    } else if (theme === 'light') {
      document.documentElement.className = '';
    } else {
      // system
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.className = 'dark';
      } else {
        document.documentElement.className = '';
      }
    }
  };

  const updateUiSetting = async (
    key: keyof AppSettings['ui'],
    value: string | number
  ): Promise<void> => {
    const updatedUi = { ...settings.ui, [key]: value };
    setSettings({ ...settings, ui: updatedUi });
    await window.electronAPI.settings.set('ui', updatedUi);

    if (key === 'theme') {
      applyTheme(value as string);
    }
  };

  const updatePracticeSetting = async (
    key: keyof AppSettings['practice'],
    value: string | boolean
  ): Promise<void> => {
    const updatedPractice = { ...settings.practice, [key]: value };
    setSettings({ ...settings, practice: updatedPractice });
    await window.electronAPI.settings.set('practice', updatedPractice);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: '#fff',
          borderRadius: '8px',
          minWidth: '400px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Settings</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: '#6b7280',
            }}
          >
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
          {/* UI Settings */}
          <section style={{ marginBottom: '24px' }}>
            <h3
              style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#6b7280',
                textTransform: 'uppercase',
                marginBottom: '12px',
              }}
            >
              UI
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label
                  htmlFor="theme"
                  style={{ display: 'block', fontSize: '0.875rem', marginBottom: '4px' }}
                >
                  Theme
                </label>
                <select
                  id="theme"
                  value={settings.ui.theme}
                  onChange={(e) => updateUiSetting('theme', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    border: '1px solid #d1d5db',
                  }}
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="language"
                  style={{ display: 'block', fontSize: '0.875rem', marginBottom: '4px' }}
                >
                  Language
                </label>
                <select
                  id="language"
                  value={settings.ui.language}
                  onChange={(e) => updateUiSetting('language', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    border: '1px solid #d1d5db',
                  }}
                >
                  <option value="ja">日本語</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>
          </section>

          {/* Practice Settings */}
          <section style={{ marginBottom: '24px' }}>
            <h3
              style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#6b7280',
                textTransform: 'uppercase',
                marginBottom: '12px',
              }}
            >
              Practice
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label
                  htmlFor="errorMode"
                  style={{ display: 'block', fontSize: '0.875rem', marginBottom: '4px' }}
                >
                  Default Error Mode
                </label>
                <select
                  id="errorMode"
                  value={settings.practice.defaultErrorMode}
                  onChange={(e) => updatePracticeSetting('defaultErrorMode', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    border: '1px solid #d1d5db',
                  }}
                >
                  <option value="wait">Wait for correct note</option>
                  <option value="pass">Pass through on error</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  id="metronomeEnabled"
                  type="checkbox"
                  checked={settings.practice.metronomeEnabled}
                  onChange={(e) => updatePracticeSetting('metronomeEnabled', e.target.checked)}
                  style={{ width: '16px', height: '16px' }}
                />
                <label
                  htmlFor="metronomeEnabled"
                  style={{ marginLeft: '8px', fontSize: '0.875rem' }}
                >
                  Enable Metronome by Default
                </label>
              </div>
            </div>
          </section>

          {/* Recent Files */}
          <section>
            <h3
              style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#6b7280',
                textTransform: 'uppercase',
                marginBottom: '12px',
              }}
            >
              Recent Files
            </h3>
            {recentFiles.length === 0 ? (
              <p style={{ fontSize: '0.875rem', color: '#6b7280', fontStyle: 'italic' }}>
                No recent files
              </p>
            ) : (
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  borderTop: '1px solid #e5e7eb',
                }}
              >
                {recentFiles.map((file, idx) => {
                  const parts = file.path.split(/[\\/]/);
                  const filename = parts[parts.length - 1];
                  const date = new Date(file.openedAt).toLocaleDateString();
                  return (
                    <li
                      key={idx}
                      style={{
                        padding: '12px 0',
                        borderBottom: '1px solid #e5e7eb',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          overflow: 'hidden',
                          paddingRight: '16px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={file.path}
                        >
                          {filename}
                        </span>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            color: '#6b7280',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {file.path}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                        {date}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #e5e7eb',
            backgroundColor: '#f9fafb',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
