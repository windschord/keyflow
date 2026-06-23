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
}
