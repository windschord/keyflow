import Store from 'electron-store';

interface AppSettings {
  recentFiles: Array<{ path: string; openedAt: string }>;
  midi: { selectedDeviceId: string | null; selectedDeviceIndex: number };
  handSettings: { maxSpanSemitones: number; leftHandScaleFactor: number };
  ui: { theme: 'light' | 'dark'; zoom: number; pianoHeight: number; language: string };
  practice: { defaultErrorMode: 'wait' | 'pass'; metronomeEnabled: boolean };
}

const DEFAULT_SETTINGS: AppSettings = {
  recentFiles: [],
  midi: { selectedDeviceId: null, selectedDeviceIndex: 0 },
  handSettings: { maxSpanSemitones: 14, leftHandScaleFactor: 1.0 },
  ui: { theme: 'light', zoom: 1.0, pianoHeight: 120, language: 'ja' },
  practice: { defaultErrorMode: 'wait', metronomeEnabled: false },
};

export class SettingsService {
  private store: Store<AppSettings>;

  constructor() {
    this.store = new Store<AppSettings>({ defaults: DEFAULT_SETTINGS });
  }

  get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.store.get(key);
  }

  set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    this.store.set(key, value);
  }

  addRecentFile(path: string): void {
    const recentFiles = this.get('recentFiles');
    const existingIndex = recentFiles.findIndex((f) => f.path === path);

    // Remove if it already exists to move it to the top
    if (existingIndex !== -1) {
      recentFiles.splice(existingIndex, 1);
    }

    // Add to the top
    recentFiles.unshift({ path, openedAt: new Date().toISOString() });

    // Keep only the 10 most recent
    if (recentFiles.length > 10) {
      recentFiles.pop();
    }

    this.set('recentFiles', recentFiles);
  }

  getRecentFiles(): AppSettings['recentFiles'] {
    return this.get('recentFiles');
  }
}
