import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { usePractice } from './usePractice';
import { usePracticeStore } from '../store';

const handleNoteOnMock = vi.fn();
const handleNoteOffMock = vi.fn();
const setBpmMock = vi.fn();
const setMetronomeEnabledMock = vi.fn();
const playCorrectSoundMock = vi.fn();
const playIncorrectSoundMock = vi.fn();
const disposeMock = vi.fn();
const onNoteOnMock = vi.fn();
const onNoteOffMock = vi.fn();
const initializeMock = vi.fn();

vi.mock('../lib/practice-engine', () => ({
  PracticeEngineService: vi.fn().mockImplementation(() => ({
    handleNoteOn: handleNoteOnMock,
    handleNoteOff: handleNoteOffMock,
  })),
}));

vi.mock('../lib/audio-engine', () => ({
  AudioEngineService: vi.fn().mockImplementation(() => ({
    setBpm: setBpmMock,
    setMetronomeEnabled: setMetronomeEnabledMock,
    playCorrectSound: playCorrectSoundMock,
    playIncorrectSound: playIncorrectSoundMock,
    dispose: disposeMock,
  })),
}));

vi.mock('../lib/midi/web-midi', () => ({
  WebMidiService: vi.fn().mockImplementation(() => ({
    initialize: initializeMock,
    onNoteOn: onNoteOnMock,
    onNoteOff: onNoteOffMock,
  })),
}));

describe('usePractice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initializeMock.mockResolvedValue(undefined);
    usePracticeStore.setState({
      bpm: 120,
      metronomeEnabled: false,
      currentMeasure: 1,
      currentNoteIndex: 0,
    });
  });

  it('applies the current store bpm to audioEngine on mount and on change', () => {
    renderHook(() => usePractice());
    expect(setBpmMock).toHaveBeenCalledWith(120);

    setBpmMock.mockClear();
    act(() => {
      usePracticeStore.getState().setBpm(90);
    });

    expect(setBpmMock).toHaveBeenCalledWith(90);
  });

  it('applies the current store metronomeEnabled to audioEngine on mount and on change', () => {
    renderHook(() => usePractice());
    expect(setMetronomeEnabledMock).toHaveBeenCalledWith(false);

    setMetronomeEnabledMock.mockClear();
    act(() => {
      usePracticeStore.getState().setMetronomeEnabled(true);
    });

    expect(setMetronomeEnabledMock).toHaveBeenCalledWith(true);
  });

  it('plays the correct sound when a MIDI note-on judgement is correct', () => {
    handleNoteOnMock.mockReturnValue({ result: 'correct', note: null, advanced: true });
    renderHook(() => usePractice());

    const noteOnCallback = onNoteOnMock.mock.calls[0][0] as (
      noteNumber: number,
      velocity: number,
      channel: number
    ) => void;

    act(() => {
      noteOnCallback(60, 100, 1);
    });

    expect(playCorrectSoundMock).toHaveBeenCalledTimes(1);
    expect(playIncorrectSoundMock).not.toHaveBeenCalled();
  });

  it('plays the incorrect sound when a MIDI note-on judgement is incorrect', () => {
    handleNoteOnMock.mockReturnValue({ result: 'incorrect', note: null, advanced: false });
    renderHook(() => usePractice());

    const noteOnCallback = onNoteOnMock.mock.calls[0][0] as (
      noteNumber: number,
      velocity: number,
      channel: number
    ) => void;

    act(() => {
      noteOnCallback(61, 100, 1);
    });

    expect(playIncorrectSoundMock).toHaveBeenCalledTimes(1);
    expect(playCorrectSoundMock).not.toHaveBeenCalled();
  });

  it('does not play any sound when a MIDI note-on judgement is ignored', () => {
    handleNoteOnMock.mockReturnValue({ result: 'ignored', note: null, advanced: false });
    renderHook(() => usePractice());

    const noteOnCallback = onNoteOnMock.mock.calls[0][0] as (
      noteNumber: number,
      velocity: number,
      channel: number
    ) => void;

    act(() => {
      noteOnCallback(60, 100, 1);
    });

    expect(playCorrectSoundMock).not.toHaveBeenCalled();
    expect(playIncorrectSoundMock).not.toHaveBeenCalled();
  });

  it('adds a green highlight for the judged note on a correct MIDI judgement (REQ-004-003)', () => {
    handleNoteOnMock.mockReturnValue({
      result: 'correct',
      note: { id: 'P1-M1-N0' },
      advanced: true,
    });
    const { result } = renderHook(() => usePractice());

    const noteOnCallback = onNoteOnMock.mock.calls[0][0] as (
      noteNumber: number,
      velocity: number,
      channel: number
    ) => void;

    act(() => {
      noteOnCallback(60, 100, 1);
    });

    expect(result.current.noteHighlights).toEqual({ 'P1-M1-N0': 'correct' });
  });

  it('adds a red highlight for the judged note on an incorrect MIDI judgement (REQ-004-004)', () => {
    handleNoteOnMock.mockReturnValue({
      result: 'incorrect',
      note: { id: 'P1-M1-N0' },
      advanced: false,
    });
    const { result } = renderHook(() => usePractice());

    const noteOnCallback = onNoteOnMock.mock.calls[0][0] as (
      noteNumber: number,
      velocity: number,
      channel: number
    ) => void;

    act(() => {
      noteOnCallback(61, 100, 1);
    });

    expect(result.current.noteHighlights).toEqual({ 'P1-M1-N0': 'incorrect' });
  });

  it('does not add a highlight when the judgement is ignored or has no note', () => {
    handleNoteOnMock.mockReturnValue({ result: 'ignored', note: null, advanced: false });
    const { result } = renderHook(() => usePractice());

    const noteOnCallback = onNoteOnMock.mock.calls[0][0] as (
      noteNumber: number,
      velocity: number,
      channel: number
    ) => void;

    act(() => {
      noteOnCallback(60, 100, 1);
    });

    expect(result.current.noteHighlights).toEqual({});
  });

  it('clears noteHighlights when the practice position (currentMeasure/currentNoteIndex) advances', () => {
    handleNoteOnMock.mockReturnValue({
      result: 'incorrect',
      note: { id: 'P1-M1-N0' },
      advanced: false,
    });
    usePracticeStore.setState({ currentMeasure: 1, currentNoteIndex: 0 });
    const { result, rerender } = renderHook(() => usePractice());

    const noteOnCallback = onNoteOnMock.mock.calls[0][0] as (
      noteNumber: number,
      velocity: number,
      channel: number
    ) => void;

    act(() => {
      noteOnCallback(61, 100, 1);
    });
    expect(result.current.noteHighlights).toEqual({ 'P1-M1-N0': 'incorrect' });

    act(() => {
      usePracticeStore.setState({ currentMeasure: 1, currentNoteIndex: 1 });
    });
    rerender();

    expect(result.current.noteHighlights).toEqual({});
  });

  it('handleKeyClick judges the note, plays feedback, and schedules note-off', () => {
    vi.useFakeTimers();
    try {
      handleNoteOnMock.mockReturnValue({ result: 'correct', note: null, advanced: true });
      const { result } = renderHook(() => usePractice());

      act(() => {
        result.current.handleKeyClick(60);
      });

      expect(handleNoteOnMock).toHaveBeenCalledWith(
        expect.objectContaining({ midiNumber: 60, type: 'note-on' })
      );
      expect(playCorrectSoundMock).toHaveBeenCalledTimes(1);
      expect(handleNoteOffMock).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(handleNoteOffMock).toHaveBeenCalledWith(
        expect.objectContaining({ midiNumber: 60, type: 'note-off' })
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
