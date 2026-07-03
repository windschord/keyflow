import type { Note, Finger, FingerAssignment } from '../../types';
import type { FingeringHand } from './types';

export interface ScalePattern {
  key: string;
  startMidi: number;
  right: Finger[];
  left: Finger[];
  isAscending: boolean;
  pitchClasses: number[];
}

const MAJOR_INTERVALS = [2, 2, 1, 2, 2, 2, 1];
const MINOR_INTERVALS = [2, 1, 2, 2, 1, 2, 2];

const MAJORS = [
  { key: 'C_MAJOR', startMidi: 0, r: [1, 2, 3, 1, 2, 3, 4, 5], l: [5, 4, 3, 2, 1, 3, 2, 1] },
  { key: 'G_MAJOR', startMidi: 7, r: [1, 2, 3, 1, 2, 3, 4, 5], l: [5, 4, 3, 2, 1, 3, 2, 1] },
  { key: 'D_MAJOR', startMidi: 2, r: [1, 2, 3, 1, 2, 3, 4, 5], l: [5, 4, 3, 2, 1, 3, 2, 1] },
  { key: 'A_MAJOR', startMidi: 9, r: [1, 2, 3, 1, 2, 3, 4, 5], l: [5, 4, 3, 2, 1, 3, 2, 1] },
  { key: 'E_MAJOR', startMidi: 4, r: [1, 2, 3, 1, 2, 3, 4, 5], l: [5, 4, 3, 2, 1, 3, 2, 1] },
  { key: 'B_MAJOR', startMidi: 11, r: [1, 2, 3, 1, 2, 3, 4, 5], l: [4, 3, 2, 1, 4, 3, 2, 1] },
  { key: 'F#_MAJOR', startMidi: 6, r: [2, 3, 1, 2, 3, 4, 1, 2], l: [4, 3, 2, 1, 3, 2, 1, 4] },
  { key: 'Db_MAJOR', startMidi: 1, r: [2, 3, 1, 2, 3, 1, 2, 3], l: [3, 2, 1, 4, 3, 2, 1, 3] },
  { key: 'Ab_MAJOR', startMidi: 8, r: [3, 4, 1, 2, 3, 1, 2, 3], l: [3, 2, 1, 4, 3, 2, 1, 3] },
  { key: 'Eb_MAJOR', startMidi: 3, r: [3, 1, 2, 3, 4, 1, 2, 3], l: [3, 2, 1, 4, 3, 2, 1, 3] },
  { key: 'Bb_MAJOR', startMidi: 10, r: [4, 1, 2, 3, 1, 2, 3, 4], l: [3, 2, 1, 4, 3, 2, 1, 3] },
  { key: 'F_MAJOR', startMidi: 5, r: [1, 2, 3, 4, 1, 2, 3, 4], l: [5, 4, 3, 2, 1, 3, 2, 1] },
];

const MINORS = [
  { key: 'A_MINOR', startMidi: 9, r: [1, 2, 3, 1, 2, 3, 4, 5], l: [5, 4, 3, 2, 1, 3, 2, 1] },
  { key: 'E_MINOR', startMidi: 4, r: [1, 2, 3, 1, 2, 3, 4, 5], l: [5, 4, 3, 2, 1, 3, 2, 1] },
  { key: 'B_MINOR', startMidi: 11, r: [1, 2, 3, 1, 2, 3, 4, 5], l: [4, 3, 2, 1, 4, 3, 2, 1] },
  { key: 'F#_MINOR', startMidi: 6, r: [2, 3, 1, 2, 3, 4, 1, 2], l: [4, 3, 2, 1, 3, 2, 1, 4] },
  { key: 'C#_MINOR', startMidi: 1, r: [3, 1, 2, 3, 4, 1, 2, 3], l: [3, 2, 1, 4, 3, 2, 1, 3] },
  { key: 'G#_MINOR', startMidi: 8, r: [3, 4, 1, 2, 3, 1, 2, 3], l: [3, 2, 1, 4, 3, 2, 1, 3] },
  { key: 'D#_MINOR', startMidi: 3, r: [3, 1, 2, 3, 4, 1, 2, 3], l: [3, 2, 1, 4, 3, 2, 1, 3] },
  { key: 'Bb_MINOR', startMidi: 10, r: [4, 1, 2, 3, 1, 2, 3, 4], l: [3, 2, 1, 4, 3, 2, 1, 3] },
  { key: 'F_MINOR', startMidi: 5, r: [1, 2, 3, 4, 1, 2, 3, 4], l: [5, 4, 3, 2, 1, 3, 2, 1] },
  { key: 'C_MINOR', startMidi: 0, r: [1, 2, 3, 1, 2, 3, 4, 5], l: [5, 4, 3, 2, 1, 3, 2, 1] },
  { key: 'G_MINOR', startMidi: 7, r: [1, 2, 3, 1, 2, 3, 4, 5], l: [5, 4, 3, 2, 1, 3, 2, 1] },
  { key: 'D_MINOR', startMidi: 2, r: [1, 2, 3, 1, 2, 3, 4, 5], l: [5, 4, 3, 2, 1, 3, 2, 1] },
];

function generatePatterns(): ScalePattern[] {
  const patterns: ScalePattern[] = [];

  const add = (list: typeof MAJORS, intervals: number[]) => {
    for (const item of list) {
      const pitchClasses = [item.startMidi];
      let current = item.startMidi;
      for (let i = 0; i < 7; i++) {
        current = (current + intervals[i]) % 12;
        pitchClasses.push(current);
      }

      patterns.push({
        key: item.key,
        startMidi: item.startMidi,
        right: item.r as Finger[],
        left: item.l as Finger[],
        isAscending: true,
        pitchClasses,
      });
      patterns.push({
        key: item.key + '_DESCENDING',
        startMidi: item.startMidi,
        right: [...item.r].reverse() as Finger[],
        left: [...item.l].reverse() as Finger[],
        isAscending: false,
        pitchClasses: [...pitchClasses].reverse(),
      });
    }
  };

  add(MAJORS, MAJOR_INTERVALS);
  add(MINORS, MINOR_INTERVALS);
  return patterns;
}

export const SCALE_PATTERNS: ScalePattern[] = generatePatterns();

export function detectScalePattern(notes: Note[]): ScalePattern | null {
  if (notes.length !== 8) return null;

  const diff = notes[7].midiNumber - notes[0].midiNumber;
  if (Math.abs(diff) !== 12) return null; // Must span exactly one octave

  const isAscending = diff > 0;

  // Note: we also need to ensure notes are strictly ascending or strictly descending
  for (let i = 1; i < 8; i++) {
    const step = notes[i].midiNumber - notes[i - 1].midiNumber;
    if (isAscending && step <= 0) return null;
    if (!isAscending && step >= 0) return null;
  }

  const pitchClasses = notes.map((n) => n.midiNumber % 12);
  const startMidi = pitchClasses[0];

  for (const pattern of SCALE_PATTERNS) {
    if (pattern.startMidi !== startMidi) continue;
    if (pattern.isAscending !== isAscending) continue;

    let match = true;
    for (let i = 0; i < 8; i++) {
      if (pattern.pitchClasses[i] !== pitchClasses[i]) {
        match = false;
        break;
      }
    }
    if (match) return pattern;
  }

  return null;
}

export function applyScalePattern(notes: Note[], hand: FingeringHand): FingerAssignment[] | null {
  const pattern = detectScalePattern(notes);
  if (!pattern) return null;

  const fingers = hand === 'right' ? pattern.right : pattern.left;
  return notes.map((n, i) => ({
    noteId: n.id,
    finger: fingers[i],
    cost: 0,
  }));
}
