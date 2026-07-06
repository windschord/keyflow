import { describe, it, expect } from 'vitest';
import type { Score, Note, Annotation } from './index';

describe('Type Definitions', () => {
  it('should compile and allow importing Score, Note, Annotation types', () => {
    // This test primarily ensures that the types can be imported
    // without TypeScript compilation errors.
    const mockNote: Note = {
      id: 'P1-M1-N0',
      partId: 'P1',
      measureNumber: 1,
      noteIndex: 0,
      pitch: { step: 'C', octave: 4 },
      midiNumber: 60,
      duration: 1,
      startTick: 0,
      durationTicks: 480,
      startSeconds: 0,
      durationSeconds: 0.5,
      voice: 1,
      isChord: false,
      isRest: false,
    };

    const mockScore: Score = {
      title: 'Test Score',
      parts: [{ id: 'P1', name: 'Piano Right', hand: 'right', clef: 'treble' }],
      measures: [{ number: 1, startTick: 0, notes: [mockNote] }],
      tempo: 120,
      ticksPerQuarter: 480,
      tempoMap: [{ tick: 0, bpm: 120 }],
      timeSignature: { beats: 4, beatType: 4 },
      keySignature: 0,
    };

    const mockAnnotation: Annotation = {
      noteId: mockNote.id,
      fingerNumber: 1,
      isAISuggested: false,
      isApproved: true,
    };

    expect(mockNote.id).toBe('P1-M1-N0');
    expect(mockScore.title).toBe('Test Score');
    expect(mockAnnotation.fingerNumber).toBe(1);
  });
});
