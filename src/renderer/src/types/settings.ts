import type { KeyboardSize } from './keyboard';
import type { PlaybackVoiceId } from '../lib/audio-engine/voices';
import type { MetronomeVoiceId } from '../lib/audio-engine/metronome-voices';

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
    /**
     * UI表示言語（US-016、TASK-096）。'auto'はOSロケールによる自動判定を意味する
     * （lib/i18n/resolve-language.tsが解決する）。既存設定ファイルに保存済みの
     * 'ja'はそのまま日本語として尊重される（DEC-009）。
     */
    language: 'auto' | 'ja' | 'en';
    /** マスターボリューム（0〜100のUI線形値、TASK-052）。 */
    volume: number;
    /** 楽譜上・鍵盤上の指番号を一括で表示するかどうか（TASK-055）。 */
    showFingerings: boolean;
    /** 画面下鍵盤の鍵盤数プリセット（TASK-056）。 */
    keyboardSize: KeyboardSize;
  };
  practice: {
    defaultErrorMode: 'wait' | 'pass';
    metronomeEnabled: boolean;
    /** メトロノームの一拍目アクセントの既定値（REQ-006-008、TASK-063）。既定true。 */
    metronomeAccentEnabled: boolean;
  };
  /**
   * 再生音色・メトロノーム音色（US-013、TASK-073）。electron-store側のデフォルト
   * （src/main/settings.ts DEFAULT_SETTINGS.audio）と一致させる。
   */
  audio: {
    playbackVoice: PlaybackVoiceId;
    metronomeVoice: MetronomeVoiceId;
  };
}
