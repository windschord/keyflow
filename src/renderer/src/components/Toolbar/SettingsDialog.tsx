import React, { useEffect, useState } from 'react';
import type { AppSettings } from '../../types/settings';
import type { MidiDevice } from '../../types/electron-api';

interface SettingsDialogProps {
  onClose: () => void;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ onClose }) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [midiDevices, setMidiDevices] = useState<MidiDevice[]>([]);

  useEffect(() => {
    const loadSettings = async () => {
      const [midi, ui, handSettings, practice, recentFiles] = await Promise.all([
        window.electronAPI.settings.get('midi'),
        window.electronAPI.settings.get('ui'),
        window.electronAPI.settings.get('handSettings'),
        window.electronAPI.settings.get('practice'),
        window.electronAPI.settings.get('recentFiles'),
      ]);
      setSettings({ midi, ui, handSettings, practice, recentFiles });
    };

    const loadDevices = async () => {
      try {
        const devices = await window.electronAPI.midi.getDevices();
        setMidiDevices(devices);
      } catch {
        setMidiDevices([]);
      }
    };

    loadSettings();
    loadDevices();

    window.electronAPI.midi.onDevicesChanged((devices) => {
      setMidiDevices(devices);
    });
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

  const handleThemeChange = (theme: string) => {
    document.documentElement.setAttribute('data-theme', theme);
    handleChange('ui', (prev) => ({ ...prev, theme }));
  };

  const handleMidiDeviceChange = (selectedIndex: number) => {
    const device = midiDevices.find((d) => d.index === selectedIndex) ?? null;
    window.electronAPI.midi.selectDevice(selectedIndex);
    handleChange('midi', (prev) => ({
      ...prev,
      selectedDeviceId: device?.name ?? null,
      selectedDeviceIndex: selectedIndex,
    }));
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
          backgroundColor: 'var(--color-background)',
          color: 'var(--color-text)',
          padding: '24px',
          borderRadius: '8px',
          width: '400px',
          maxWidth: '90%',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
        }}
      >
        <h2 style={{ marginTop: 0 }}>Settings</h2>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Theme</label>
          <select
            value={settings.ui.theme}
            onChange={(e) => handleThemeChange(e.target.value)}
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
            value={settings.midi.selectedDeviceIndex}
            onChange={(e) => handleMidiDeviceChange(Number(e.target.value))}
            style={{ width: '100%', padding: '8px' }}
          >
            <option value={-1}>None</option>
            {midiDevices.map((device) => (
              <option key={device.index} value={device.index}>
                {device.name}
              </option>
            ))}
          </select>
          {midiDevices.length === 0 && (
            <p style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
              No MIDI devices detected
            </p>
          )}
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
