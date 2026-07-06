import { StateCreator } from 'zustand';
import { KEYBOARD_SIZES, KeyboardSize } from '../../types';

export interface UiSlice {
  bpm: number;
  originalBpm: number;
  metronomeEnabled: boolean;
  /**
   * メトロノームの一拍目アクセント有効/無効（REQ-006-008、TASK-063）。初期値true。
   * electron-store側のデフォルト（src/main/settings.ts DEFAULT_SETTINGS.practice.
   * metronomeAccentEnabled）と一致させる。usePractice.ts が変更を購読し
   * audioEngine.setMetronomeAccentEnabledへ反映する。
   */
  metronomeAccentEnabled: boolean;
  zoom: number;
  pianoHeight: number;
  /**
   * 選択中のMIDI入力デバイスid（REQ-004-008）。`null`は「すべてのデバイス」を
   * 意味する。SettingsModalでの変更・起動時の設定ロード
   * （electron-store `midi.selectedDeviceId`）の単一の真実源である。
   * usePractice/useMidiがこの値をWebMidiService.setSelectedDeviceへ反映する
   * （TASK-045）。
   */
  midiDeviceId: string | null;
  /**
   * マスターボリューム（0〜100のUI線形値、TASK-052）。electron-store側の
   * デフォルト（src/main/settings.ts DEFAULT_SETTINGS.ui.volume）と一致させる。
   * dB変換・ミュートはAudioEngineService.setMasterVolume側の責務であり、
   * ここでは0〜100の範囲クランプのみを行う（0はミュートとして扱われる）。
   */
  volume: number;
  /**
   * 楽譜上・鍵盤上の指番号（annotation-store由来の運指メモ・AI提案の両方）を
   * 一括で表示するかどうか（TASK-055）。初期値true。electron-store側の
   * デフォルト（src/main/settings.ts DEFAULT_SETTINGS.ui.showFingerings）と
   * 一致させる。OFFはApp.tsx側で表示レイヤの制御に使うのみで、
   * annotation-storeの実データやサイドカーJSONには影響しない。
   */
  showFingerings: boolean;
  /**
   * 画面下鍵盤の鍵盤数プリセット（88/76/61/49、TASK-056）。初期値88。
   * electron-store側のデフォルト（src/main/settings.ts DEFAULT_SETTINGS.ui.keyboardSize）
   * と一致させる。PianoKeyboardの表示範囲（canvas幅・クリック座標→MIDI変換・
   * 範囲外ノーツのインジケータ）にのみ影響し、practice-engineの判定ロジック
   * （expectedNotes・正誤判定）には一切影響しない（表示だけの制約）。
   */
  keyboardSize: KeyboardSize;
  setBpm: (bpm: number) => void;
  setMetronomeEnabled: (enabled: boolean) => void;
  /** メトロノームの一拍目アクセントの有効/無効を切り替える（TASK-063）。 */
  setMetronomeAccentEnabled: (enabled: boolean) => void;
  setZoom: (zoom: number) => void;
  /**
   * 鍵盤の高さ（px）を設定する。80〜300pxにクランプする
   * （注意事項: 妥当な範囲を超えるとPianoKeyboardのレイアウトが崩れるため）。
   */
  setPianoHeight: (height: number) => void;
  setMidiDeviceId: (deviceId: string | null) => void;
  /** マスターボリュームを設定する。0〜100にクランプする（TASK-052）。 */
  setVolume: (volume: number) => void;
  /** 運指の一括表示/非表示を切り替える（TASK-055）。 */
  setShowFingerings: (show: boolean) => void;
  /**
   * 画面下鍵盤の鍵盤数プリセットを設定する（TASK-056）。既知のプリセット
   * （88/76/61/49）以外の値が渡された場合は88へフォールバックする
   * （electron-store側の破損・想定外データに対する防御）。値はユーザー入力
   * ではなくSettingsModalのselect経由のみのため通常は発生しないが、
   * 起動時ロードが外部JSONを読むため念のためガードする。
   */
  setKeyboardSize: (size: KeyboardSize) => void;
  /**
   * 楽譜由来のテンポをセッションの基準テンポとして設定する。
   * Reset操作の戻し先である originalBpm と、現在の再生テンポ bpm を
   * 同時に楽譜のテンポへ揃える（スコア読み込み直後に呼ばれる想定）。
   */
  setOriginalBpm: (bpm: number) => void;
}

export const createUiSlice: StateCreator<UiSlice> = (set, get) => ({
  bpm: 120,
  originalBpm: 120,
  metronomeEnabled: false,
  metronomeAccentEnabled: true,
  zoom: 1.0,
  // electron-store側のデフォルト（src/main/settings.ts DEFAULT_SETTINGS.ui.pianoHeight）
  // と一致させる（TASK-045）。以前は150固定でelectron-storeの120と食い違っており、
  // 起動時ロードが実装されるまで不整合が隠蔽されていた。単一の値に揃えることで
  // 「設定未ロード時の初期表示」と「起動時ロード後の値」の間でフラッシュが発生しない。
  pianoHeight: 120,
  midiDeviceId: null,
  // electron-store側のデフォルト（src/main/settings.ts DEFAULT_SETTINGS.ui.volume）
  // と一致させる（TASK-052、pianoHeightと同じ理由で起動時ロード前後の不整合を避ける）。
  volume: 80,
  // electron-store側のデフォルト（src/main/settings.ts DEFAULT_SETTINGS.ui.showFingerings）
  // と一致させる（TASK-055）。
  showFingerings: true,
  // electron-store側のデフォルト（src/main/settings.ts DEFAULT_SETTINGS.ui.keyboardSize）
  // と一致させる（TASK-056）。
  keyboardSize: 88,
  // REQ-006-003: 元のテンポ（originalBpm）の20%〜200%の範囲でクランプする。
  // originalBpmが未設定（0以下）の場合は初期値120を基準にする。
  // originalBpm自体のクランプ（絶対値20〜400）はsetOriginalBpm側の責務であり、
  // ここでは比率クランプの対象をbpmのみに限定する。
  setBpm: (bpm) => {
    const base = get().originalBpm > 0 ? get().originalBpm : 120;
    const min = base * 0.2;
    const max = base * 2.0;
    set({ bpm: Math.max(min, Math.min(max, bpm)) });
  },
  setMetronomeEnabled: (enabled) => set({ metronomeEnabled: enabled }),
  setMetronomeAccentEnabled: (enabled) => set({ metronomeAccentEnabled: enabled }),
  setZoom: (zoom) => set({ zoom }),
  setPianoHeight: (height) => set({ pianoHeight: Math.max(80, Math.min(300, height)) }),
  setMidiDeviceId: (deviceId) => set({ midiDeviceId: deviceId }),
  setVolume: (volume) => set({ volume: Math.max(0, Math.min(100, volume)) }),
  setShowFingerings: (show) => set({ showFingerings: show }),
  setKeyboardSize: (size) =>
    set({ keyboardSize: (KEYBOARD_SIZES as readonly number[]).includes(size) ? size : 88 }),
  setOriginalBpm: (bpm) => {
    const clamped = Math.max(20, Math.min(400, bpm));
    set({ originalBpm: clamped, bpm: clamped });
  },
});
