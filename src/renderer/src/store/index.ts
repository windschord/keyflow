import { create } from 'zustand';
import { createScoreSlice, ScoreSlice } from './slices/score-slice';
import { createPracticeSlice, PracticeSlice } from './slices/practice-slice';
import { createUiSlice, UiSlice } from './slices/ui-slice';

export type PracticeStore = ScoreSlice & PracticeSlice & UiSlice;

export const usePracticeStore = create<PracticeStore>()((...a) => ({
  ...createScoreSlice(...a),
  ...createPracticeSlice(...a),
  ...createUiSlice(...a),
}));
