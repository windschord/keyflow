export interface HandSettings {
  maxSpanSemitones: number;
  leftHandScaleFactor: number;
}

export interface AppSettings {
  recentFiles: Array<{ path: string; openedAt: string }>;
  midi: { selectedDeviceId: string | null; selectedDeviceIndex: number };
  handSettings: HandSettings;
  ui: { theme: 'light' | 'dark' | 'system'; zoom: number; pianoHeight: number; language: string };
  practice: { defaultErrorMode: 'wait' | 'pass'; metronomeEnabled: boolean };
}
