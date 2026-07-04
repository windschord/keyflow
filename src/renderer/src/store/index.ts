import { create } from 'zustand';
import { createScoreSlice, ScoreSlice } from './slices/score-slice';
import { createPracticeSlice, PracticeSlice } from './slices/practice-slice';
import { createUiSlice, UiSlice } from './slices/ui-slice';
import { createPlaybackSlice, PlaybackSlice } from './slices/playback-slice';

export type PracticeStore = ScoreSlice & PracticeSlice & UiSlice & PlaybackSlice;

export const usePracticeStore = create<PracticeStore>()((...a) => ({
  ...createScoreSlice(...a),
  ...createPracticeSlice(...a),
  ...createUiSlice(...a),
  ...createPlaybackSlice(...a),
}));
