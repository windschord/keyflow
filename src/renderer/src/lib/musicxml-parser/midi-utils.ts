const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function toMidiNumber(step: string, octave: number, alter = 0): number {
  return 12 * (octave + 1) + SEMITONES[step] + alter;
}
