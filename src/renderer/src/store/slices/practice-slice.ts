import { StateCreator } from 'zustand';
import { PracticeMode, ErrorMode, Note, PracticeStats } from '../../types';

export interface PracticeSlice {
  practiceMode: PracticeMode;
  errorMode: ErrorMode;
  currentMeasure: number;
  currentNoteIndex: number;
  expectedNotes: Note[];
  pressedKeys: Set<number>;
  incorrectKeys: Set<number>;
  loopEnabled: boolean;
  loopStart: number;
  loopEnd: number;
  stats: PracticeStats;
  setPracticeMode: (mode: PracticeMode) => void;
  setLoopRange: (start: number, end: number) => void;
  toggleLoop: () => void;
}

const initialStats: PracticeStats = {
  totalNotes: 0,
  correctNotes: 0,
  incorrectNotes: 0,
  accuracy: 0,
};

export const createPracticeSlice: StateCreator<PracticeSlice> = (set) => ({
  practiceMode: 'both',
  errorMode: 'wait',
  currentMeasure: 1,
  currentNoteIndex: 0,
  expectedNotes: [],
  pressedKeys: new Set(),
  incorrectKeys: new Set(),
  loopEnabled: false,
  loopStart: 1,
  loopEnd: 1,
  stats: initialStats,
  setPracticeMode: (mode) => set({ practiceMode: mode }),
  setLoopRange: (start, end) => set({ loopStart: start, loopEnd: end }),
  toggleLoop: () => set((state) => ({ loopEnabled: !state.loopEnabled })),
});
