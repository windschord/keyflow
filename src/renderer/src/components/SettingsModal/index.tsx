import React, { useState, useEffect } from 'react';
import { AppSettings } from '../../types';
import { usePracticeStore } from '../../store';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsModalState = Pick<AppSettings, 'ui' | 'practice'>;

const DEFAULT_SETTINGS: SettingsModalState = {
  ui: { theme: 'light', language: 'ja', zoom: 1.0, pianoHeight: 120 },
  practice: { defaultErrorMode: 'wait', metronomeEnabled: false },
};

function showSettingsError(message: string): void {
  window.alert(message);
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<SettingsModalState>(DEFAULT_SETTINGS);
  const [recentFiles, setRecentFiles] = useState<Array<{ path: string; openedAt: string }>>([]);
  const requestIdRef = React.useRef<number>(0);

  useEffect(() => {
    if (isOpen) {
      const loadSettings = async (): Promise<void> => {
        try {
          const ui = await window.electronAPI.settings.get('ui');
          const practice = await window.electronAPI.settings.get('practice');
          const files = await window.electronAPI.settings.getRecentFiles();

          const finalUi = ui || DEFAULT_SETTINGS.ui;
          // Apply defaults if necessary
          setSettings({
            ui: finalUi,
            practice: practice || DEFAULT_SETTINGS.practice,
          });
          setRecentFiles(files || []);
        } catch {
          setSettings(DEFAULT_SETTINGS);
          setRecentFiles([]);
          showSettingsError('設定の読み込みに失敗しました。既定値で表示します。');
        }
      };
      loadSettings();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const updateUiSetting = async <K extends keyof AppSettings['ui']>(
    key: K,
    value: AppSettings['ui'][K]
  ): Promise<void> => {
    const requestId = ++requestIdRef.current;

    // Save the previous state to revert to if the API call fails
    const previousValue = settings.ui[key];

    const updatedUi = { ...settings.ui, [key]: value };
    setSettings({ ...settings, ui: updatedUi });

    try {
      await window.electronAPI.settings.set('ui', updatedUi);
    } catch {
      // Only rollback if this is still the latest request
      if (requestId === requestIdRef.current) {
        setSettings((currentSettings) => ({
          ...currentSettings,
          ui: { ...currentSettings.ui, [key]: previousValue },
        }));
        showSettingsError('設定の保存に失敗しました。変更を元に戻しました。');
      }
    }
  };

  const updatePracticeSetting = async <K extends keyof AppSettings['practice']>(
    key: K,
    value: AppSettings['practice'][K]
  ): Promise<void> => {
    const requestId = ++requestIdRef.current;

    // Save the previous state to revert to if the API call fails
    const previousValue = settings.practice[key];
    const previousMetronomeEnabled = usePracticeStore.getState().metronomeEnabled;

    const updatedPractice = { ...settings.practice, [key]: value };
    setSettings({ ...settings, practice: updatedPractice });

    // 「Enable Metronome by Default」の変更は、単一の真実源である ui-slice の
    // metronomeEnabled に即座に反映し、ツールバーのチェックボックスへ反映する。
    if (key === 'metronomeEnabled') {
      usePracticeStore.getState().setMetronomeEnabled(value as boolean);
    }

    try {
      await window.electronAPI.settings.set('practice', updatedPractice);
    } catch {
      // Only rollback if this is still the latest request
      if (requestId === requestIdRef.current) {
        setSettings((currentSettings) => ({
          ...currentSettings,
          practice: { ...currentSettings.practice, [key]: previousValue },
        }));
        if (key === 'metronomeEnabled') {
          usePracticeStore.getState().setMetronomeEnabled(previousMetronomeEnabled);
        }
        showSettingsError('設定の保存に失敗しました。変更を元に戻しました。');
      }
    }
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
          color: '#111827',
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
                  onChange={(e) =>
                    updatePracticeSetting(
                      'defaultErrorMode',
                      e.target.value as AppSettings['practice']['defaultErrorMode']
                    )
                  }
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
