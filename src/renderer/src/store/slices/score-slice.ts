import { StateCreator } from 'zustand';
import { Score } from '../../types';

export interface ScoreSlice {
  score: Score | null;
  musicXmlPath: string | null;
  setScore: (score: Score, path: string) => void;
}

export const createScoreSlice: StateCreator<ScoreSlice> = (set) => ({
  score: null,
  musicXmlPath: null,
  setScore: (score, path) => set({ score, musicXmlPath: path }),
});
