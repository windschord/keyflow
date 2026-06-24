import { describe, it, expect } from 'vitest';
import { filterNotesByMode, judgeChord } from './judgement';
import { Note, Part } from '../../types';

describe('judgement', () => {
  describe('filterNotesByMode', () => {
    const parts: Part[] = [
      { id: 'P1', name: 'Right', hand: 'right', clef: 'treble' },
      { id: 'P2', name: 'Left', hand: 'left', clef: 'bass' },
    ];

    const notes: Note[] = [
      { id: '1', partId: 'P1', midiNumber: 60 } as Note,
      { id: '2', partId: 'P2', midiNumber: 48 } as Note,
    ];

    it('returns all for both mode', () => {
      expect(filterNotesByMode(notes, 'both', parts)).toHaveLength(2);
    });

    it('filters right hand notes', () => {
      const result = filterNotesByMode(notes, 'right', parts);
      expect(result).toHaveLength(1);
      expect(result[0].partId).toBe('P1');
    });

    it('filters left hand notes', () => {
      const result = filterNotesByMode(notes, 'left', parts);
      expect(result).toHaveLength(1);
      expect(result[0].partId).toBe('P2');
    });
  });

  describe('judgeChord', () => {
    const expectedNotes: Note[] = [{ midiNumber: 60 } as Note, { midiNumber: 64 } as Note];

    it('returns correct when all keys match', () => {
      expect(judgeChord(new Set([60, 64]), expectedNotes)).toBe('correct');
    });

    it('returns partial when subset of keys match', () => {
      expect(judgeChord(new Set([60]), expectedNotes)).toBe('partial');
    });

    it('returns incorrect when wrong keys are pressed', () => {
      expect(judgeChord(new Set([60, 61]), expectedNotes)).toBe('incorrect');
      expect(judgeChord(new Set([61]), expectedNotes)).toBe('incorrect');
    });

    it('returns incorrect for empty expected notes', () => {
      expect(judgeChord(new Set([60]), [])).toBe('incorrect');
    });
  });
});
