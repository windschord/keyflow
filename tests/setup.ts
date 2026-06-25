import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock window.electronAPI for components that render in tests and require settings
Object.defineProperty(window, 'electronAPI', {
  value: {
    file: {
      showOpenDialog: vi.fn(),
      read: vi.fn(),
      readBinary: vi.fn(),
    },
    settings: {
      get: vi.fn().mockImplementation(async (key) => {
        return {
          midi: { selectedDeviceId: null, selectedDeviceIndex: 0 },
          ui: { theme: 'light', zoom: 1.0, pianoHeight: 120, language: 'ja' },
          handSettings: { maxSpanSemitones: 14, leftHandScaleFactor: 1.0 },
          practice: { defaultErrorMode: 'wait', metronomeEnabled: false },
          recentFiles: [],
        }[key];
      }),
      set: vi.fn().mockResolvedValue(undefined),
    },
  },
  writable: true,
});
