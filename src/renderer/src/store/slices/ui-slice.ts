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
}

export const createUiSlice: StateCreator<UiSlice> = (set) => ({
  bpm: 120,
  originalBpm: 120,
  metronomeEnabled: false,
  zoom: 1.0,
  pianoHeight: 150,
  setBpm: (bpm) => set({ bpm }),
  setMetronomeEnabled: (enabled) => set({ metronomeEnabled: enabled }),
  setZoom: (zoom) => set({ zoom }),
});
