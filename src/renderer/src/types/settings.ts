// Re-export or redefine AppSettings to match the main process structure.
// This is used for strict typing of the IPC channels.
export interface AppSettings {
  recentFiles: Array<{ path: string; openedAt: string }>;
  midi: { selectedDeviceId: string | null; selectedDeviceIndex: number };
  handSettings: { maxSpanSemitones: number; leftHandScaleFactor: number };
  ui: { theme: string; zoom: number; pianoHeight: number; language: string };
  practice: { defaultErrorMode: string; metronomeEnabled: boolean };
}
