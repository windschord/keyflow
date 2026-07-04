import { StateCreator } from 'zustand';

export interface UiSlice {
  bpm: number;
  originalBpm: number;
  metronomeEnabled: boolean;
  zoom: number;
  pianoHeight: number;
  setBpm: (bpm: number) => void;
  setMetronomeEnabled: (enabled: boolean) => void;
  setZoom: (zoom: number) => void;
  /**
   * 楽譜由来のテンポをセッションの基準テンポとして設定する。
   * Reset操作の戻し先である originalBpm と、現在の再生テンポ bpm を
   * 同時に楽譜のテンポへ揃える（スコア読み込み直後に呼ばれる想定）。
   */
  setOriginalBpm: (bpm: number) => void;
}

export const createUiSlice: StateCreator<UiSlice> = (set) => ({
  bpm: 120,
  originalBpm: 120,
  metronomeEnabled: false,
  zoom: 1.0,
  pianoHeight: 150,
  setBpm: (bpm) => set({ bpm: Math.max(20, Math.min(400, bpm)) }),
  setMetronomeEnabled: (enabled) => set({ metronomeEnabled: enabled }),
  setZoom: (zoom) => set({ zoom }),
  setOriginalBpm: (bpm) => {
    const clamped = Math.max(20, Math.min(400, bpm));
    set({ originalBpm: clamped, bpm: clamped });
  },
});
