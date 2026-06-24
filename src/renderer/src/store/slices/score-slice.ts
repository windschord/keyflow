import { StateCreator } from 'zustand';
import { Score } from '../../types';

export interface ScoreSlice {
  score: Score | null;
  musicXmlPath: string | null;
  musicXmlContent: string | null;
  setScore: (score: Score, path: string, xmlContent: string) => void;
}

export const createScoreSlice: StateCreator<ScoreSlice> = (set) => ({
  score: null,
  musicXmlPath: null,
  musicXmlContent: null,
  setScore: (score, path, xmlContent) =>
    set({ score, musicXmlPath: path, musicXmlContent: xmlContent }),
});
