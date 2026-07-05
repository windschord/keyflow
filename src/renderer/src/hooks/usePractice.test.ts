import { act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHookWithStrictMode as renderHook } from '../tests/test-utils';
import { usePractice } from './usePractice';
import { usePracticeStore } from '../store';

const handleNoteOnMock = vi.fn();
const handleNoteOffMock = vi.fn();
const resetToMeasureMock = vi.fn();
const advanceToPlaybackPositionMock = vi.fn();
const setBpmMock = vi.fn();
const setMetronomeEnabledMock = vi.fn();
const setMasterVolumeMock = vi.fn();
const playCorrectSoundMock = vi.fn();
const playIncorrectSoundMock = vi.fn();
const playNoteMock = vi.fn();
const disposeMock = vi.fn();
const setLoopPointsMock = vi.fn();
const setPositionCallbackMock = vi.fn();
const setOnStopMock = vi.fn();
const loadScoreMock = vi.fn();
const stopAccompanimentMock = vi.fn();
const onNoteOnMock = vi.fn();
const onNoteOffMock = vi.fn();
const initializeMock = vi.fn();

vi.mock('../lib/practice-engine', () => ({
  PracticeEngineService: vi.fn().mockImplementation(() => ({
    handleNoteOn: handleNoteOnMock,
    handleNoteOff: handleNoteOffMock,
    resetToMeasure: resetToMeasureMock,
    advanceToPlaybackPosition: advanceToPlaybackPositionMock,
  })),
}));

vi.mock('../lib/audio-engine', () => ({
  AudioEngineService: vi.fn().mockImplementation(() => ({
    setBpm: setBpmMock,
    setMetronomeEnabled: setMetronomeEnabledMock,
    setMasterVolume: setMasterVolumeMock,
    playCorrectSound: playCorrectSoundMock,
    playIncorrectSound: playIncorrectSoundMock,
    playNote: playNoteMock,
    dispose: disposeMock,
    setLoopPoints: setLoopPointsMock,
    setPositionCallback: setPositionCallbackMock,
    setOnStop: setOnStopMock,
    loadScore: loadScoreMock,
    stopAccompaniment: stopAccompanimentMock,
  })),
}));

const setSelectedDeviceMock = vi.fn();

vi.mock('../lib/midi/web-midi', () => ({
  WebMidiService: vi.fn().mockImplementation(() => ({
    initialize: initializeMock,
    onNoteOn: onNoteOnMock,
    onNoteOff: onNoteOffMock,
    setSelectedDevice: setSelectedDeviceMock,
  })),
}));

describe('usePractice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initializeMock.mockResolvedValue(undefined);
    usePracticeStore.setState({
      bpm: 120,
      metronomeEnabled: false,
      volume: 80,
      currentMeasure: 1,
      currentNoteIndex: 0,
      score: null,
      practiceMode: 'both',
      playbackState: 'stopped',
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

  it('applies the current store volume to audioEngine.setMasterVolume on mount and on change (TASK-052)', () => {
    renderHook(() => usePractice());
    expect(setMasterVolumeMock).toHaveBeenCalledWith(80);

    setMasterVolumeMock.mockClear();
    act(() => {
      usePracticeStore.getState().setVolume(30);
    });

    expect(setMasterVolumeMock).toHaveBeenCalledWith(30);
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

  it('handleKeyClick plays the clicked note, judges it, plays feedback, and schedules note-off (REQ-005-006)', () => {
    vi.useFakeTimers();
    try {
      handleNoteOnMock.mockReturnValue({ result: 'correct', note: null, advanced: true });
      const { result } = renderHook(() => usePractice());

      act(() => {
        result.current.handleKeyClick(60);
      });

      // REQ-005-006: 画面鍵盤クリック時、クリックした音自体を発音する。
      expect(playNoteMock).toHaveBeenCalledWith(60);
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

  it('wires audioEngine position callback to practiceEngine.advanceToPlaybackPosition (REQ-010-005)', () => {
    renderHook(() => usePractice());

    expect(setPositionCallbackMock).toHaveBeenCalledWith(expect.any(Function));
    const positionCallback = setPositionCallbackMock.mock.calls[0][0] as (
      measureNumber: number,
      groupIndex: number
    ) => void;

    positionCallback(3, 2);

    expect(advanceToPlaybackPositionMock).toHaveBeenCalledWith(3, 2);
  });

  it('unregisters the position callback on unmount', () => {
    const { unmount } = renderHook(() => usePractice());
    setPositionCallbackMock.mockClear();

    unmount();

    expect(setPositionCallbackMock).toHaveBeenCalledWith(null);
  });

  it('wires audioEngine stop callback to practiceEngine.resetToMeasure(1) when loop is disabled (REQ-010-004)', () => {
    usePracticeStore.setState({ loopEnabled: false, loopStart: 5 });
    renderHook(() => usePractice());

    expect(setOnStopMock).toHaveBeenCalledWith(expect.any(Function));
    const onStop = setOnStopMock.mock.calls[0][0] as () => void;

    onStop();

    expect(resetToMeasureMock).toHaveBeenCalledWith(1);
  });

  it('wires audioEngine stop callback to practiceEngine.resetToMeasure(loopStart) when loop is enabled (REQ-010-004)', () => {
    usePracticeStore.setState({ loopEnabled: true, loopStart: 5 });
    renderHook(() => usePractice());

    const onStop = setOnStopMock.mock.calls[0][0] as () => void;
    onStop();

    expect(resetToMeasureMock).toHaveBeenCalledWith(5);
  });

  it('syncs loop range and score changes to audioEngine.setLoopPoints (REQ-010-008)', () => {
    usePracticeStore.setState({ loopEnabled: true, loopStart: 2, loopEnd: 4, score: null });
    renderHook(() => usePractice());

    expect(setLoopPointsMock).toHaveBeenCalledWith(null, true, 2, 4);
  });

  describe('audioEngine.loadScore sync (TASK-051, REQ-010-010)', () => {
    const mockScore = { title: 'Test', measures: [] } as unknown as import('../types').Score;

    it('loads the score using the current practiceMode when a score is set', () => {
      usePracticeStore.setState({ score: mockScore, practiceMode: 'left' });

      renderHook(() => usePractice());

      expect(loadScoreMock).toHaveBeenCalledWith(mockScore, 'left');
    });

    it('does not call loadScore while no score is loaded', () => {
      usePracticeStore.setState({ score: null });

      renderHook(() => usePractice());

      expect(loadScoreMock).not.toHaveBeenCalled();
    });

    it('re-schedules audioEngine.loadScore when practiceMode changes while a score is loaded', () => {
      usePracticeStore.setState({ score: mockScore, practiceMode: 'both' });
      renderHook(() => usePractice());
      loadScoreMock.mockClear();

      act(() => {
        usePracticeStore.getState().setPracticeMode('right');
      });

      expect(loadScoreMock).toHaveBeenCalledWith(mockScore, 'right');
    });

    it('stops playback when practiceMode changes while playback is in progress (minimal implementation: stop-on-change)', () => {
      usePracticeStore.setState({ score: mockScore, practiceMode: 'both', playbackState: 'stopped' });
      renderHook(() => usePractice());
      stopAccompanimentMock.mockClear();

      // Start playback without touching score/practiceMode, so the sync effect does not
      // fire yet (matches the real flow: PlaybackControls sets playbackState via the store
      // independently of this effect's dependencies).
      act(() => {
        usePracticeStore.setState({ playbackState: 'playing' });
      });

      act(() => {
        usePracticeStore.getState().setPracticeMode('left');
      });

      expect(stopAccompanimentMock).toHaveBeenCalledTimes(1);
      expect(usePracticeStore.getState().playbackState).toBe('stopped');
    });

    it('does not call stopAccompaniment when re-scheduling while playback is not in progress', () => {
      usePracticeStore.setState({ score: mockScore, practiceMode: 'both', playbackState: 'stopped' });
      renderHook(() => usePractice());
      stopAccompanimentMock.mockClear();

      act(() => {
        usePracticeStore.getState().setPracticeMode('right');
      });

      expect(stopAccompanimentMock).not.toHaveBeenCalled();
    });
  });

  // TASK-045: SettingsModalがMIDI入力デバイス一覧（webMidiService.getDevices）を
  // 表示・操作するには、usePractice内で生成された同一のWebMidiServiceインスタンスに
  // アクセスできる必要がある。App.tsxからSettingsModalへpropとして渡すため公開する。
  it('exposes the webMidiService instance used for MIDI input (TASK-045)', () => {
    const { result } = renderHook(() => usePractice());

    expect(result.current.webMidiService).toBeDefined();
    expect(result.current.webMidiService.setSelectedDevice).toBe(setSelectedDeviceMock);
  });
});
