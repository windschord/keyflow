import type { Finger } from '../../types';
import type { FingeringHand, HandSettings } from './types';

// 指1と指2のペア -> { comfortable: semitones, max: semitones }
export const SPAN_TABLE: Record<number, Record<number, { comfortable: number; max: number }>> = {
  1: {
    2: { comfortable: 2, max: 9 },
    3: { comfortable: 4, max: 11 },
    4: { comfortable: 5, max: 13 },
    5: { comfortable: 7, max: 14 },
  },
  2: {
    3: { comfortable: 2, max: 4 },
    4: { comfortable: 3, max: 7 },
    5: { comfortable: 5, max: 10 },
  },
  3: {
    4: { comfortable: 2, max: 3 },
    5: { comfortable: 3, max: 7 },
  },
  4: {
    5: { comfortable: 2, max: 4 },
  },
};

export function getSpan(
  f1: Finger,
  f2: Finger,
  hand: FingeringHand,
  settings: HandSettings
): { comfortable: number; max: number } {
  const minF = Math.min(f1, f2);
  const maxF = Math.max(f1, f2);

  if (minF === maxF) {
    return { comfortable: 0, max: 0 };
  }

  const baseSpan = SPAN_TABLE[minF][maxF];
  if (!baseSpan) {
    return { comfortable: 0, max: 0 };
  }

  const multiplier = hand === 'left' ? settings.scaleFactorLeft : 1.0;

  return {
    comfortable: baseSpan.comfortable * multiplier,
    max: baseSpan.max * multiplier,
  };
}
