export interface HandSettings {
  maxSpanSemitones: number;
  leftHandScaleFactor: number;
}

export interface AppSettings {
  recentFiles: Array<{ path: string; openedAt: string }>;
  midi: { selectedDeviceId: string | null; selectedDeviceIndex: number };
  handSettings: HandSettings;
  ui: {
    theme: 'light' | 'dark' | 'system';
    zoom: number;
    pianoHeight: number;
    language: string;
    /** マスターボリューム（0〜100のUI線形値、TASK-052）。 */
    volume: number;
    /** 楽譜上・鍵盤上の指番号を一括で表示するかどうか（TASK-055）。 */
    showFingerings: boolean;
  };
  practice: { defaultErrorMode: 'wait' | 'pass'; metronomeEnabled: boolean };
}
