import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SettingsService } from './settings';

// Mock electron-store since we are testing in a node environment without an electron runtime
vi.mock('electron-store', () => {
  return {
    default: class MockStore {
      private data: Record<string, unknown>;
      constructor(options: { defaults: Record<string, unknown> }) {
        this.data = { ...options.defaults };
      }
      get(key: string) {
        return this.data[key];
      }
      set(key: string, value: unknown) {
        this.data[key] = value;
      }
    },
  };
});

describe('SettingsService', () => {
  let settingsService: SettingsService;

  beforeEach(() => {
    settingsService = new SettingsService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with default values', () => {
    expect(settingsService.get('recentFiles')).toEqual([]);
    expect(settingsService.get('ui').theme).toBe('light');
    expect(settingsService.get('practice').defaultErrorMode).toBe('wait');
  });

  it('can set and get values', () => {
    settingsService.set('ui', { theme: 'dark', zoom: 1.5, pianoHeight: 100, language: 'en' });
    expect(settingsService.get('ui').theme).toBe('dark');
    expect(settingsService.get('ui').zoom).toBe(1.5);
  });

  it('addRecentFile adds a file to the top', () => {
    settingsService.addRecentFile('/path/to/file1.xml');
    const recentFiles1 = settingsService.getRecentFiles();
    expect(recentFiles1).toHaveLength(1);
    expect(recentFiles1[0].path).toBe('/path/to/file1.xml');

    settingsService.addRecentFile('/path/to/file2.xml');
    const recentFiles2 = settingsService.getRecentFiles();
    expect(recentFiles2).toHaveLength(2);
    expect(recentFiles2[0].path).toBe('/path/to/file2.xml');
    expect(recentFiles2[1].path).toBe('/path/to/file1.xml');
  });

  it('addRecentFile moves an existing file to the top', () => {
    settingsService.addRecentFile('/path/to/file1.xml');
    settingsService.addRecentFile('/path/to/file2.xml');

    // file1 is at index 1 now, let's open it again
    settingsService.addRecentFile('/path/to/file1.xml');
    const recentFiles = settingsService.getRecentFiles();

    expect(recentFiles).toHaveLength(2);
    expect(recentFiles[0].path).toBe('/path/to/file1.xml');
    expect(recentFiles[1].path).toBe('/path/to/file2.xml');
  });

  it('addRecentFile removes the oldest when exceeding 10 entries', () => {
    for (let i = 1; i <= 12; i++) {
      settingsService.addRecentFile(`/path/to/file${i}.xml`);
    }

    const recentFiles = settingsService.getRecentFiles();

    expect(recentFiles).toHaveLength(10);
    // the most recent is file12
    expect(recentFiles[0].path).toBe('/path/to/file12.xml');
    // the oldest should be file3, since file1 and file2 were removed
    expect(recentFiles[9].path).toBe('/path/to/file3.xml');
  });
});
