import React, { useEffect, useState } from 'react';
import type { AppSettings } from '../../types/settings';

interface SettingsDialogProps {
  onClose: () => void;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ onClose }) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      const [midi, ui, handSettings, practice, recentFiles] = await Promise.all([
        window.electronAPI.settings.get('midi'),
        window.electronAPI.settings.get('ui'),
        window.electronAPI.settings.get('handSettings'),
        window.electronAPI.settings.get('practice'),
        window.electronAPI.settings.get('recentFiles'),
      ]);

      setSettings({
        midi,
        ui,
        handSettings,
        practice,
        recentFiles,
      });
    };
    loadSettings();
  }, []);

  const handleChange = <K extends keyof AppSettings>(
    key: K,
    updater: (prev: AppSettings[K]) => AppSettings[K]
  ) => {
    if (!settings) return;
    const newValue = updater(settings[key]);
    setSettings((prev) => (prev ? { ...prev, [key]: newValue } : null));
    window.electronAPI.settings.set(key, newValue);
  };

  if (!settings) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          color: '#000',
          padding: '24px',
          borderRadius: '8px',
          width: '400px',
          maxWidth: '90%',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        }}
      >
        <h2 style={{ marginTop: 0 }}>Settings</h2>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Theme</label>
          <select
            value={settings.ui.theme}
            onChange={(e) => handleChange('ui', (prev) => ({ ...prev, theme: e.target.value }))}
            style={{ width: '100%', padding: '8px' }}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            MIDI Device
          </label>
          <select
            value={settings.midi.selectedDeviceId || ''}
            onChange={(e) =>
              handleChange('midi', (prev) => ({
                ...prev,
                selectedDeviceId: e.target.value || null,
              }))
            }
            style={{ width: '100%', padding: '8px' }}
          >
            <option value="">None</option>
            {/* Real implementation would load devices, placeholder for now */}
            <option value="device-1">MIDI Device 1</option>
            <option value="device-2">MIDI Device 2</option>
          </select>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Max Hand Span (Semitones)
          </label>
          <input
            type="number"
            value={settings.handSettings.maxSpanSemitones}
            onChange={(e) =>
              handleChange('handSettings', (prev) => ({
                ...prev,
                maxSpanSemitones: parseInt(e.target.value, 10) || 14,
              }))
            }
            style={{ width: '100%', padding: '8px' }}
            min={1}
            max={30}
          />
        </div>

        <div style={{ textAlign: 'right' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
