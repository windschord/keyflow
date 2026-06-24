import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingsService, DEFAULT_SETTINGS } from './settings';
// Store is mocked below, no need to import it just to ignore it

// electron-store のモック
vi.mock('electron-store', () => {
  return {
    default: vi.fn().mockImplementation(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let store: any = {};
      return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        get: vi.fn((key: string, defaultValue: any) => {
          return store[key] !== undefined ? store[key] : defaultValue;
        }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        set: vi.fn((key: string, value: any) => {
          store[key] = value;
        }),
        clear: vi.fn(() => {
          store = {};
        }),
      };
    }),
  };
});

describe('SettingsService', () => {
  let settingsService: SettingsService;

  beforeEach(() => {
    vi.clearAllMocks();
    settingsService = new SettingsService();
  });

  it('should initialize with default values', () => {
    expect(settingsService.get('ui')).toEqual(DEFAULT_SETTINGS.ui);
    expect(settingsService.get('midi')).toEqual(DEFAULT_SETTINGS.midi);
  });

  it('should get and set values correctly', () => {
    const newUiSettings = { theme: 'dark', zoom: 1.5, pianoHeight: 150, language: 'en' };
    settingsService.set('ui', newUiSettings);
    expect(settingsService.get('ui')).toEqual(newUiSettings);
  });

  it('should add a recent file', () => {
    const path = '/path/to/file.xml';
    settingsService.addRecentFile(path);
    const recentFiles = settingsService.getRecentFiles();
    expect(recentFiles.length).toBe(1);
    expect(recentFiles[0].path).toBe(path);
  });

  it('should not add duplicate recent files, but move them to the top', () => {
    const path1 = '/path/to/file1.xml';
    const path2 = '/path/to/file2.xml';

    settingsService.addRecentFile(path1);
    settingsService.addRecentFile(path2);
    settingsService.addRecentFile(path1);

    const recentFiles = settingsService.getRecentFiles();
    expect(recentFiles.length).toBe(2);
    expect(recentFiles[0].path).toBe(path1);
    expect(recentFiles[1].path).toBe(path2);
  });

  it('should remove oldest recent files when exceeding 10', () => {
    for (let i = 0; i < 15; i++) {
      settingsService.addRecentFile(`/path/to/file${i}.xml`);
    }

    const recentFiles = settingsService.getRecentFiles();
    expect(recentFiles.length).toBe(10);
    expect(recentFiles[0].path).toBe('/path/to/file14.xml');
    expect(recentFiles[9].path).toBe('/path/to/file5.xml');
  });
});
