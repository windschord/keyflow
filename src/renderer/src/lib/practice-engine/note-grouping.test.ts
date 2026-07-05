import { describe, it, expect } from 'vitest';
import { filterNotesByPracticeMode, groupNotesByStartTick } from './note-grouping';
import { Note } from '../../types';

function makeNote(overrides: Partial<Note> & Pick<Note, 'id' | 'partId' | 'midiNumber'>): Note {
  return {
    measureNumber: 1,
    noteIndex: 0,
    pitch: { step: 'C', octave: 4 },
    duration: 1,
    startTick: 0,
    durationTicks: 480,
    startSeconds: 0,
    durationSeconds: 0.5,
    voice: 1,
    isChord: false,
    isRest: false,
    staff: 1,
    hand: 'right',
    ...overrides,
  };
}

describe('filterNotesByPracticeMode (TASK-048: note.hand単位フィルタ)', () => {
  // 1パート2段譜（staff1='right'/staff2='left'）を想定したフィクスチャ。
  // パートIDは単一（'P1'）でも、note.handのみで正しくフィルタできることを検証する。
  const rightNote = makeNote({ id: 'P1-M1-N0', partId: 'P1', midiNumber: 60, hand: 'right' });
  const leftNote = makeNote({ id: 'P1-M1-N1', partId: 'P1', midiNumber: 48, hand: 'left' });
  const notes = [rightNote, leftNote];

  it('bothモードでは全ノートを返す', () => {
    expect(filterNotesByPracticeMode(notes, 'both')).toEqual(notes);
  });

  it('rightモードではnote.hand === "right" のノートのみ残す（1パート2段譜の上段）', () => {
    expect(filterNotesByPracticeMode(notes, 'right')).toEqual([rightNote]);
  });

  it('leftモードではnote.hand === "left" のノートのみ残す（1パート2段譜の下段）', () => {
    expect(filterNotesByPracticeMode(notes, 'left')).toEqual([leftNote]);
  });

  it('同一partIdの音符でも、handが異なれば別々にフィルタされる（パート単位判定への回帰なし）', () => {
    const chordRight = makeNote({ id: 'P1-M1-N2', partId: 'P1', midiNumber: 64, hand: 'right' });
    const mixed = [rightNote, leftNote, chordRight];
    expect(filterNotesByPracticeMode(mixed, 'right')).toEqual([rightNote, chordRight]);
  });
});

describe('groupNotesByStartTick (回帰確認: 変更なし)', () => {
  it('同一startTickのノートを1グループにまとめる', () => {
    const a = makeNote({ id: 'P1-M1-N0', partId: 'P1', midiNumber: 60, startTick: 0 });
    const b = makeNote({ id: 'P1-M1-N1', partId: 'P1', midiNumber: 64, startTick: 0 });
    const groups = groupNotesByStartTick([a, b]);
    expect(groups).toEqual([{ startTick: 0, notes: [a, b] }]);
  });
});
