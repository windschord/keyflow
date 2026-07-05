import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { FingeringPanel } from './index';
import type { Note, Score } from '../../types';

const computeFingeringMock = vi.fn();

// FingeringEngineService instantiates a Web Worker, which jsdom does not provide.
// This test only exercises label rendering, so the engine is mocked out.
vi.mock('../../lib/fingering-engine', () => ({
  FingeringEngineService: vi.fn().mockImplementation(() => ({
    computeFingering: computeFingeringMock,
    dispose: vi.fn(),
  })),
  DEFAULT_HAND_SETTINGS: { maxSpanSemitones: 14, scaleFactorLeft: 1.0 },
}));

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

describe('FingeringPanel label', () => {
  it('labels the hand dropdown as the fingering target, distinct from practice mode selection', () => {
    render(<FingeringPanel score={null} onSuggested={() => {}} />);

    // "運指対象" makes clear this selects the hand for fingering computation,
    // distinguishing it from PracticeModeSelector's practice target (左手/右手/両手).
    expect(screen.getByText('運指対象:')).toBeInTheDocument();
  });
});

describe('FingeringPanel note.hand-based filtering (TASK-048)', () => {
  afterEach(() => {
    computeFingeringMock.mockReset();
  });

  it('1パート2段譜（同一partId）で左手選択時にstaff2由来のNote.hand=leftの音のみ計算対象になる', async () => {
    computeFingeringMock.mockResolvedValue({ assignments: [], totalCost: 0 });

    // 1パート('P1')2段譜: staff1='right'、staff2='left' の音符が混在する。
    const upperStaffNote = makeNote({ id: 'P1-M1-N0', partId: 'P1', midiNumber: 60, hand: 'right' });
    const lowerStaffNote = makeNote({ id: 'P1-M1-N1', partId: 'P1', midiNumber: 48, hand: 'left' });
    const score: Score = {
      title: 'Test',
      parts: [{ id: 'P1', name: 'Piano', hand: 'right', clef: 'treble' }],
      measures: [{ number: 1, startTick: 0, notes: [upperStaffNote, lowerStaffNote] }],
      tempo: 120,
      ticksPerQuarter: 480,
      tempoMap: [{ tick: 0, bpm: 120 }],
      timeSignature: { beats: 4, beatType: 4 },
      keySignature: 0,
    };

    render(<FingeringPanel score={score} onSuggested={() => {}} />);

    fireEvent.change(screen.getByLabelText('運指対象:'), { target: { value: 'left' } });
    fireEvent.click(screen.getByText('運指提案'));

    await waitFor(() => expect(computeFingeringMock).toHaveBeenCalled());

    const [notesArg, handArg] = computeFingeringMock.mock.calls[0];
    expect(handArg).toBe('left');
    expect(notesArg).toEqual([lowerStaffNote]);
    // エラーは表示されない（左手の音符が実在するため）。
    expect(screen.queryByText(/音符が見つかりません/)).not.toBeInTheDocument();
  });

  it('選択した手のNoteが1件も無い場合はエラー文言（実態に即した表現）を表示する', async () => {
    const rightOnlyNote = makeNote({ id: 'P1-M1-N0', partId: 'P1', midiNumber: 60, hand: 'right' });
    const score: Score = {
      title: 'Test',
      parts: [{ id: 'P1', name: 'Piano', hand: 'right', clef: 'treble' }],
      measures: [{ number: 1, startTick: 0, notes: [rightOnlyNote] }],
      tempo: 120,
      ticksPerQuarter: 480,
      tempoMap: [{ tick: 0, bpm: 120 }],
      timeSignature: { beats: 4, beatType: 4 },
      keySignature: 0,
    };

    render(<FingeringPanel score={score} onSuggested={() => {}} />);

    fireEvent.change(screen.getByLabelText('運指対象:'), { target: { value: 'left' } });
    fireEvent.click(screen.getByText('運指提案'));

    await waitFor(() => expect(screen.getByText(/左手の音符が見つかりません/)).toBeInTheDocument());
    expect(computeFingeringMock).not.toHaveBeenCalled();
  });

  it('休符（isRest）は計算対象から除外される', async () => {
    computeFingeringMock.mockResolvedValue({ assignments: [], totalCost: 0 });
    const rest = makeNote({ id: 'P1-M1-N0', partId: 'P1', midiNumber: 0, hand: 'right', isRest: true });
    const sounding = makeNote({ id: 'P1-M1-N1', partId: 'P1', midiNumber: 60, hand: 'right' });
    const score: Score = {
      title: 'Test',
      parts: [{ id: 'P1', name: 'Piano', hand: 'right', clef: 'treble' }],
      measures: [{ number: 1, startTick: 0, notes: [rest, sounding] }],
      tempo: 120,
      ticksPerQuarter: 480,
      tempoMap: [{ tick: 0, bpm: 120 }],
      timeSignature: { beats: 4, beatType: 4 },
      keySignature: 0,
    };

    render(<FingeringPanel score={score} onSuggested={() => {}} />);
    fireEvent.click(screen.getByText('運指提案'));

    await waitFor(() => expect(computeFingeringMock).toHaveBeenCalled());
    const [notesArg] = computeFingeringMock.mock.calls[0];
    expect(notesArg).toEqual([sounding]);
  });
});
