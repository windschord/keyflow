import type { Note } from './score';

export type PracticeMode = 'right' | 'left' | 'both';
export type ErrorMode = 'wait' | 'pass';
export type JudgementResult = 'correct' | 'incorrect' | 'ignored';

export interface NoteJudgement {
  result: JudgementResult;
  note: Note | null;
  advanced: boolean;
}

export interface PracticeStats {
  totalNotes: number;
  correctNotes: number;
  incorrectNotes: number;
  accuracy: number;
  /**
   * 現在の連続正解数（US-004: 正解率・連続正解数の可視化）。
   * 正解（判定グループ完了）ごとに+1し、不正解の判定が発生すると0にリセットされる。
   */
  consecutiveCorrect: number;
}
