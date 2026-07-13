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
const setMetronomeAccentEnabledMock = vi.fn();
const setMasterVolumeMock = vi.fn();
const setPlaybackVoiceMock = vi.fn().mockResolvedValue(undefined);
const setMetronomeVoiceMock = vi.fn();
const ensurePlaybackVoiceLoadedMock = vi.fn().mockResolvedValue(undefined);
const setVoiceLoadingCallbackMock = vi.fn();
const playCorrectSoundMock = vi.fn();
const playIncorrectSoundMock = vi.fn();
const playNoteMock = vi.fn();
const disposeMock = vi.fn();
const setLoopPointsMock = vi.fn();
const setPositionCallbackMock = vi.fn();
const setOnStopMock = vi.fn();
const setSoundingNotesCallbackMock = vi.fn();
const loadScoreMock = vi.fn();
const stopAccompanimentMock = vi.fn();
const onNoteOnMock = vi.fn();
const onNoteOffMock = vi.fn();
const initializeMock = vi.fn();

vi.mock('../lib/practice-engine', () => ({
  PracticeEngineService: vi.fn().mockImplementation(function () {
    return {
      handleNoteOn: handleNoteOnMock,
      handleNoteOff: handleNoteOffMock,
      resetToMeasure: resetToMeasureMock,
      advanceToPlaybackPosition: advanceToPlaybackPositionMock,
    };
  }),
}));

vi.mock('../lib/audio-engine', () => ({
  AudioEngineService: vi.fn().mockImplementation(function () {
    return {
      setBpm: setBpmMock,
      setMetronomeEnabled: setMetronomeEnabledMock,
      setMetronomeAccentEnabled: setMetronomeAccentEnabledMock,
      setMasterVolume: setMasterVolumeMock,
      setPlaybackVoice: setPlaybackVoiceMock,
      setMetronomeVoice: setMetronomeVoiceMock,
      ensurePlaybackVoiceLoaded: ensurePlaybackVoiceLoadedMock,
      setVoiceLoadingCallback: setVoiceLoadingCallbackMock,
      playCorrectSound: playCorrectSoundMock,
      playIncorrectSound: playIncorrectSoundMock,
      playNote: playNoteMock,
      dispose: disposeMock,
      setLoopPoints: setLoopPointsMock,
      setPositionCallback: setPositionCallbackMock,
      setOnStop: setOnStopMock,
      setSoundingNotesCallback: setSoundingNotesCallbackMock,
      loadScore: loadScoreMock,
      stopAccompaniment: stopAccompanimentMock,
    };
  }),
}));

const setSelectedDeviceMock = vi.fn();

vi.mock('../lib/midi/web-midi', () => ({
  WebMidiService: vi.fn().mockImplementation(function () {
    return {
      initialize: initializeMock,
      onNoteOn: onNoteOnMock,
      onNoteOff: onNoteOffMock,
      setSelectedDevice: setSelectedDeviceMock,
    };
  }),
}));

describe('usePractice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initializeMock.mockResolvedValue(undefined);
    usePracticeStore.setState({
      bpm: 120,
      metronomeEnabled: false,
      metronomeAccentEnabled: true,
      volume: 80,
      playbackVoice: 'grand-piano',
      metronomeVoice: 'click',
      voiceLoading: false,
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

  it('applies the current store metronomeAccentEnabled to audioEngine on mount and on change (TASK-063)', () => {
    renderHook(() => usePractice());
    expect(setMetronomeAccentEnabledMock).toHaveBeenCalledWith(true);

    setMetronomeAccentEnabledMock.mockClear();
    act(() => {
      usePracticeStore.getState().setMetronomeAccentEnabled(false);
    });

    expect(setMetronomeAccentEnabledMock).toHaveBeenCalledWith(false);
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

  // TASK-073: 再生音色・メトロノーム音色（US-013）。
  it('applies the current store playbackVoice to audioEngine.setPlaybackVoice on mount and on change', () => {
    renderHook(() => usePractice());
    expect(setPlaybackVoiceMock).toHaveBeenCalledWith('grand-piano');

    setPlaybackVoiceMock.mockClear();
    act(() => {
      usePracticeStore.getState().setPlaybackVoice('organ');
    });

    expect(setPlaybackVoiceMock).toHaveBeenCalledWith('organ');
  });

  it('applies the current store metronomeVoice to audioEngine.setMetronomeVoice on mount and on change', () => {
    renderHook(() => usePractice());
    expect(setMetronomeVoiceMock).toHaveBeenCalledWith('click');

    setMetronomeVoiceMock.mockClear();
    act(() => {
      usePracticeStore.getState().setMetronomeVoice('cowbell');
    });

    expect(setMetronomeVoiceMock).toHaveBeenCalledWith('cowbell');
  });

  describe('voice loading wiring (REQ-013-003, TASK-073)', () => {
    it('wires audioEngine voice-loading callback to ui-slice.voiceLoading', () => {
      renderHook(() => usePractice());

      expect(setVoiceLoadingCallbackMock).toHaveBeenCalledWith(expect.any(Function));
      const loadingCallback = setVoiceLoadingCallbackMock.mock.calls[0][0] as (
        loading: boolean
      ) => void;

      act(() => {
        loadingCallback(true);
      });
      expect(usePracticeStore.getState().voiceLoading).toBe(true);

      act(() => {
        loadingCallback(false);
      });
      expect(usePracticeStore.getState().voiceLoading).toBe(false);
    });

    it('unregisters the voice-loading callback on unmount', () => {
      const { unmount } = renderHook(() => usePractice());
      setVoiceLoadingCallbackMock.mockClear();

      unmount();

      expect(setVoiceLoadingCallbackMock).toHaveBeenCalledWith(null);
    });
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

  // CodeRabbit PR#25指摘#2: practiceEngine.handleNoteOn は正解完了時に
  // currentMeasure/currentNoteIndex を進めてから判定結果を返す。そのため位置変化を
  // 契機にハイライトを一括クリアする実装では、正解の緑ハイライトが表示された
  // 直後に消えてしまっていた。位置変化ではなく、判定ごとの固定時間
  // （HIGHLIGHT_CLEAR_DELAY_MS = 800ms）で該当noteIdのみを自動クリアする
  // タイマー方式に見直した。
  describe('noteHighlights auto-clear timer (CodeRabbit PR#25指摘#2)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('keeps the highlight visible immediately after the practice position advances', () => {
      handleNoteOnMock.mockReturnValue({
        result: 'correct',
        note: { id: 'P1-M1-N0' },
        advanced: true,
      });
      usePracticeStore.setState({ currentMeasure: 1, currentNoteIndex: 0 });
      const { result, rerender } = renderHook(() => usePractice());

      const noteOnCallback = onNoteOnMock.mock.calls[0][0] as (
        noteNumber: number,
        velocity: number,
        channel: number
      ) => void;

      act(() => {
        noteOnCallback(60, 100, 1);
      });
      expect(result.current.noteHighlights).toEqual({ 'P1-M1-N0': 'correct' });

      // 判定完了に伴い practiceEngine 側で位置が進む状況を再現する。
      act(() => {
        usePracticeStore.setState({ currentMeasure: 1, currentNoteIndex: 1 });
      });
      rerender();

      // 位置が進んだ直後でも、ハイライトはまだ自動クリアのタイマーが
      // 満了していないため表示され続ける。
      expect(result.current.noteHighlights).toEqual({ 'P1-M1-N0': 'correct' });
    });

    it('automatically clears the highlight once the display duration elapses', () => {
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

      act(() => {
        vi.advanceTimersByTime(799);
      });
      expect(result.current.noteHighlights).toEqual({ 'P1-M1-N0': 'incorrect' });

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(result.current.noteHighlights).toEqual({});
    });

    it('resets the clear timer when the same note is judged again before it clears', () => {
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

      act(() => {
        vi.advanceTimersByTime(500);
      });

      // 800ms経過する前に同じnoteIdが再度判定されたら、タイマーはリセットされる。
      act(() => {
        noteOnCallback(60, 100, 1);
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });
      // 最初の判定から通算1000ms経過しているが、リセット後からはまだ500msしか
      // 経過していないため、ハイライトは残っている。
      expect(result.current.noteHighlights).toEqual({ 'P1-M1-N0': 'correct' });

      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(result.current.noteHighlights).toEqual({});
    });

    it('clears timers on unmount without throwing', () => {
      handleNoteOnMock.mockReturnValue({
        result: 'correct',
        note: { id: 'P1-M1-N0' },
        advanced: true,
      });
      const { unmount } = renderHook(() => usePractice());

      const noteOnCallback = onNoteOnMock.mock.calls[0][0] as (
        noteNumber: number,
        velocity: number,
        channel: number
      ) => void;

      act(() => {
        noteOnCallback(60, 100, 1);
      });

      expect(() => unmount()).not.toThrow();

      // アンマウント後にタイマーが発火しても setState 等でエラーにならないこと。
      expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
    });

    it('leaves no pending timers after unmount (StrictMode double-mount safe)', () => {
      // renderHook は renderHookWithStrictMode のエイリアスであり、StrictModeの
      // 「マウント→クリーンアップ→再マウント」を経由する。二重マウントでタイマーの
      // 重複登録やクリーンアップ漏れがあれば、アンマウント後に残留タイマーとして
      // 現れるため、タイマー数がゼロであることを明示的に検証する
      // （CodeRabbit PR#25 再レビュー指摘）。
      handleNoteOnMock.mockReturnValue({
        result: 'correct',
        note: { id: 'P1-M1-N0' },
        advanced: true,
      });
      const { unmount } = renderHook(() => usePractice());

      const noteOnCallback = onNoteOnMock.mock.calls[0][0] as (
        noteNumber: number,
        velocity: number,
        channel: number
      ) => void;

      act(() => {
        noteOnCallback(60, 100, 1);
      });
      expect(vi.getTimerCount()).toBeGreaterThan(0);

      unmount();

      expect(vi.getTimerCount()).toBe(0);
    });
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

  // TASK-057: 再生中の鍵盤表示を音価（durationTicks）に追随させるための
  // 発音中ノーツ集合。audioEngine側でノーツ単位の発音開始/終了境界を
  // 追跡し、変化のたびにこのコールバックが呼ばれる（結線テスト）。
  describe('soundingNotes wiring (TASK-057)', () => {
    it('wires audioEngine sounding-notes callback to state and exposes the current set (initially empty)', () => {
      const { result } = renderHook(() => usePractice());

      expect(setSoundingNotesCallbackMock).toHaveBeenCalledWith(expect.any(Function));
      expect(result.current.soundingNotes).toEqual(new Set());

      const soundingCallback = setSoundingNotesCallbackMock.mock.calls[0][0] as (
        notes: Set<number>
      ) => void;

      act(() => {
        soundingCallback(new Set([60, 64]));
      });

      expect(result.current.soundingNotes).toEqual(new Set([60, 64]));
    });

    it('updates soundingNotes again when audioEngine reports a further change (e.g. a shorter note advancing under a held long note)', () => {
      const { result } = renderHook(() => usePractice());
      const soundingCallback = setSoundingNotesCallbackMock.mock.calls[0][0] as (
        notes: Set<number>
      ) => void;

      act(() => {
        soundingCallback(new Set([60, 48]));
      });
      expect(result.current.soundingNotes).toEqual(new Set([60, 48]));

      act(() => {
        soundingCallback(new Set([60, 50]));
      });
      expect(result.current.soundingNotes).toEqual(new Set([60, 50]));

      act(() => {
        soundingCallback(new Set());
      });
      expect(result.current.soundingNotes).toEqual(new Set());
    });

    it('unregisters the sounding-notes callback on unmount', () => {
      const { unmount } = renderHook(() => usePractice());
      setSoundingNotesCallbackMock.mockClear();

      unmount();

      expect(setSoundingNotesCallbackMock).toHaveBeenCalledWith(null);
    });
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
      usePracticeStore.setState({
        score: mockScore,
        practiceMode: 'both',
        playbackState: 'stopped',
      });
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
      usePracticeStore.setState({
        score: mockScore,
        practiceMode: 'both',
        playbackState: 'stopped',
      });
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

  // TASK-088: window.__e2eMidiHooks__ は実起動E2E専用の計装であり、本番ビルドでは
  // 攻撃対象領域を無用に広げるため公開してはならない。
  // electronAPI.isE2E が true の場合のみ公開する（preload経由で --keyflow-e2e 引数から判定される）。
  describe('__e2eMidiHooks__ instrumentation guard (TASK-088)', () => {
    // 本体（usePractice.ts）と同じく `as unknown as { ... }` で計装プロパティへアクセスする（any不使用）。
    const e2eWindow = window as unknown as {
      electronAPI?: { isE2E?: boolean };
      __e2eMidiHooks__?: { noteOn: unknown; noteOff: unknown };
    };

    afterEach(() => {
      delete e2eWindow.electronAPI;
      delete e2eWindow.__e2eMidiHooks__;
    });

    it('does not expose __e2eMidiHooks__ on window when electronAPI.isE2E is not true', () => {
      renderHook(() => usePractice());

      expect(e2eWindow.__e2eMidiHooks__).toBeUndefined();
    });

    it('exposes __e2eMidiHooks__ on window when electronAPI.isE2E is true', () => {
      e2eWindow.electronAPI = { isE2E: true };

      renderHook(() => usePractice());

      const hooks = e2eWindow.__e2eMidiHooks__;
      expect(hooks).toBeDefined();
      expect(hooks?.noteOn).toBeInstanceOf(Function);
      expect(hooks?.noteOff).toBeInstanceOf(Function);
    });

    it('removes __e2eMidiHooks__ from window on unmount when it was exposed', () => {
      e2eWindow.electronAPI = { isE2E: true };

      const { unmount } = renderHook(() => usePractice());
      expect(e2eWindow.__e2eMidiHooks__).toBeDefined();

      unmount();

      expect(e2eWindow.__e2eMidiHooks__).toBeUndefined();
    });
  });
});
