import Store from 'electron-store';

export interface AppSettings {
  recentFiles: Array<{ path: string; openedAt: string }>;
  midi: { selectedDeviceId: string | null; selectedDeviceIndex: number };
  handSettings: { maxSpanSemitones: number; leftHandScaleFactor: number };
  ui: { theme: string; zoom: number; pianoHeight: number; language: string };
  practice: { defaultErrorMode: string; metronomeEnabled: boolean };
}

export const DEFAULT_SETTINGS: AppSettings = {
  recentFiles: [],
  midi: { selectedDeviceId: null, selectedDeviceIndex: 0 },
  handSettings: { maxSpanSemitones: 14, leftHandScaleFactor: 1.0 },
  ui: { theme: 'light', zoom: 1.0, pianoHeight: 120, language: 'ja' },
  practice: { defaultErrorMode: 'wait', metronomeEnabled: false },
};

export class SettingsService {
  private store: Store<AppSettings>;

  constructor() {
    this.store = new Store<AppSettings>({
      defaults: DEFAULT_SETTINGS,
    });
  }

  get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.store.get(key, DEFAULT_SETTINGS[key]);
  }

  set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    this.store.set(key, value);
  }

  addRecentFile(path: string): void {
    const recentFiles = this.get('recentFiles');
    const now = new Date().toISOString();

    // Remove if already exists
    const filteredFiles = recentFiles.filter((file) => file.path !== path);

    // Add to the beginning
    filteredFiles.unshift({ path, openedAt: now });

    // Keep only the latest 10
    const limitedFiles = filteredFiles.slice(0, 10);

    this.set('recentFiles', limitedFiles);
  }

  getRecentFiles(): AppSettings['recentFiles'] {
    return this.get('recentFiles');
  }
}
