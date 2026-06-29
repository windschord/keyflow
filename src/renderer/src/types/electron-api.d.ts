export interface ElectronAppSettings {
  recentFiles: Array<{ path: string; openedAt: string }>;
  midi: { selectedDeviceId: string | null; selectedDeviceIndex: number };
  handSettings: { maxSpanSemitones: number; leftHandScaleFactor: number };
  ui: { theme: 'light' | 'dark'; zoom: number; pianoHeight: number; language: string };
  practice: { defaultErrorMode: 'wait' | 'pass'; metronomeEnabled: boolean };
}

export interface ElectronAPI {
  file: {
    showOpenDialog(): Promise<string | null>;
    read(path: string): Promise<string>;
    readBinary(path: string): Promise<ArrayBuffer>;
    write(path: string, content: string): Promise<void>;
  };
  settings: {
    get<K extends keyof ElectronAppSettings>(key: K): Promise<ElectronAppSettings[K]>;
    set<K extends keyof ElectronAppSettings>(key: K, value: ElectronAppSettings[K]): Promise<void>;
    getRecentFiles(): Promise<Array<{ path: string; openedAt: string }>>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
