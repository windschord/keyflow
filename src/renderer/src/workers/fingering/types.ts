import type { Finger, FingerAssignment } from '../../types';
import type { Note } from '../../types';

export type { Finger, FingerAssignment, Note };

// 運指エンジン内では Hand を 'right' | 'left' に限定
export type FingeringHand = 'right' | 'left';

export interface HandSettings {
  maxSpanSemitones: number;  // デフォルト 14
  scaleFactorLeft: number;   // デフォルト 1.0
}

export interface FingeringRequest {
  type: 'COMPUTE';
  requestId: string;
  notes: Note[];
  hand: FingeringHand;
  settings: HandSettings;
}

export interface FingeringResponse {
  type: 'RESULT' | 'PROGRESS' | 'ERROR';
  requestId: string;
  result?: FingeringResult;
  progress?: number;
  error?: string;
}

export interface FingeringResult {
  assignments: FingerAssignment[];
  totalCost: number;
}

export interface DPState {
  cost: number;
  prevFinger: Finger | null;
}
