import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  isSettingsKey,
  normalizeSettings,
  validateSettingsValue,
} from './settings';

describe('settings validation', () => {
  it('accepts and normalizes valid settings', () => {
    const normalized = normalizeSettings({
      recentFiles: [{ path: '/score.musicxml', openedAt: '2026-06-29T00:00:00.000Z' }],
      midi: { selectedDeviceId: 'device-1', selectedDeviceIndex: 2 },
      handSettings: { maxSpanSemitones: 12, leftHandScaleFactor: 0.9 },
      ui: { theme: 'dark', zoom: 1.25, pianoHeight: 140, language: 'ja' },
      practice: { defaultErrorMode: 'pass', metronomeEnabled: true },
    });

    expect(normalized.ui.theme).toBe('dark');
    expect(normalized.recentFiles).toHaveLength(1);
  });

  it('repairs invalid persisted values with defaults', () => {
    const normalized = normalizeSettings({
      recentFiles: 'broken',
      ui: { theme: 'system', zoom: Number.NaN, pianoHeight: -1, language: 123 },
    });

    expect(normalized.recentFiles).toEqual([]);
    expect(normalized.ui).toEqual(DEFAULT_SETTINGS.ui);
    expect(normalized.practice).toEqual(DEFAULT_SETTINGS.practice);
  });

  it('validates IPC keys and values', () => {
    expect(isSettingsKey('ui')).toBe(true);
    expect(isSettingsKey('not-a-key')).toBe(false);
    expect(validateSettingsValue('ui', DEFAULT_SETTINGS.ui)).toEqual(DEFAULT_SETTINGS.ui);
    expect(() => validateSettingsValue('practice', { defaultErrorMode: 'skip' })).toThrow(
      /Invalid settings value/
    );
  });
});
