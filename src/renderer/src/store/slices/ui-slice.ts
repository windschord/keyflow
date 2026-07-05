import { StateCreator } from 'zustand';

export interface UiSlice {
  bpm: number;
  originalBpm: number;
  metronomeEnabled: boolean;
  zoom: number;
  pianoHeight: number;
  /**
   * 選択中のMIDI入力デバイスid（REQ-004-008）。`null`は「すべてのデバイス」を
   * 意味する。SettingsModalでの変更・起動時の設定ロード（electron-store
   * `midi.selectedDeviceId`）の単一の真実源であり、usePractice/useMidiが
   * この値をWebMidiService.setSelectedDeviceへ反映する（TASK-045）。
   */
  midiDeviceId: string | null;
  /**
   * マスターボリューム（0〜100のUI線形値、TASK-052）。electron-store側の
   * デフォルト（src/main/settings.ts DEFAULT_SETTINGS.ui.volume）と一致させる。
   * dB変換・ミュートはAudioEngineService.setMasterVolume側の責務であり、
   * ここでは0〜100の範囲クランプのみを行う（0はミュートとして扱われる）。
   */
  volume: number;
  setBpm: (bpm: number) => void;
  setMetronomeEnabled: (enabled: boolean) => void;
  setZoom: (zoom: number) => void;
  /**
   * 鍵盤の高さ（px）を設定する。80〜300pxにクランプする
   * （注意事項: 妥当な範囲を超えるとPianoKeyboardのレイアウトが崩れるため）。
   */
  setPianoHeight: (height: number) => void;
  setMidiDeviceId: (deviceId: string | null) => void;
  /** マスターボリュームを設定する。0〜100にクランプする（TASK-052）。 */
  setVolume: (volume: number) => void;
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
  setZoom: (zoom) => set({ zoom }),
  setPianoHeight: (height) => set({ pianoHeight: Math.max(80, Math.min(300, height)) }),
  setMidiDeviceId: (deviceId) => set({ midiDeviceId: deviceId }),
  setVolume: (volume) => set({ volume: Math.max(0, Math.min(100, volume)) }),
  setOriginalBpm: (bpm) => {
    const clamped = Math.max(20, Math.min(400, bpm));
    set({ originalBpm: clamped, bpm: clamped });
  },
});
