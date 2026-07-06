import Store from 'electron-store';

/**
 * 画面下鍵盤の鍵盤数プリセット（TASK-056）。renderer側
 * （src/renderer/src/types/keyboard.ts）と同じ値だが、main/rendererは
 * 別プロセス・別バンドルのため型定義は独立して持つ（showFingerings等の
 * 他フィールドと同じ既存パターン）。
 */
type KeyboardSize = 88 | 76 | 61 | 49;

interface AppSettings {
  recentFiles: Array<{ path: string; openedAt: string }>;
  midi: { selectedDeviceId: string | null; selectedDeviceIndex: number };
  handSettings: { maxSpanSemitones: number; leftHandScaleFactor: number };
  ui: {
    theme: 'light' | 'dark';
    zoom: number;
    pianoHeight: number;
    language: string;
    /** マスターボリューム（0〜100のUI線形値、TASK-052）。 */
    volume: number;
    /** 楽譜上・鍵盤上の指番号を一括で表示するかどうか（TASK-055）。 */
    showFingerings: boolean;
    /** 画面下鍵盤の鍵盤数プリセット（TASK-056）。 */
    keyboardSize: KeyboardSize;
  };
  practice: { defaultErrorMode: 'wait' | 'pass'; metronomeEnabled: boolean };
}

const DEFAULT_SETTINGS: AppSettings = {
  recentFiles: [],
  midi: { selectedDeviceId: null, selectedDeviceIndex: 0 },
  handSettings: { maxSpanSemitones: 14, leftHandScaleFactor: 1.0 },
  ui: {
    theme: 'light',
    zoom: 1.0,
    pianoHeight: 120,
    language: 'ja',
    volume: 80,
    showFingerings: true,
    keyboardSize: 88,
  },
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
