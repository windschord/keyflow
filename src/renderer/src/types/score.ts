export type Hand = 'right' | 'left' | 'unknown';

export interface Score {
  title: string;
  parts: Part[];
  measures: Measure[];
  tempo: number;
  timeSignature: { beats: number; beatType: number };
  keySignature: number;
}

export interface Part {
  id: string;
  name: string;
  hand: Hand;
  clef: 'treble' | 'bass';
}

export interface Measure {
  number: number;
  notes: Note[];
}

/**
 * Represents a musical note.
 * id format: `{partId}-M{measureNumber}-N{noteIndex}` (e.g. `P1-M3-N0`)
 */
export interface Note {
  id: string;
  partId: string;
  measureNumber: number;
  noteIndex: number;
  pitch: { step: string; octave: number; alter?: number };
  midiNumber: number;
  duration: number;
  isChord: boolean;
  isRest: boolean;
}
