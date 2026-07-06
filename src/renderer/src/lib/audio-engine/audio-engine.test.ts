import { describe, it, expect, beforeEach, vi, afterEach, type Mock } from 'vitest';
import { AudioEngineService } from './index';
import * as Tone from 'tone';
import type { Score } from '../../types';

vi.mock('tone', () => {
  let scheduleIdSeq = 0;
  const mockTransport = {
    bpm: { value: 120 },
    PPQ: 480,
    loop: false,
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    schedule: vi.fn(() => scheduleIdSeq++),
    clear: vi.fn(),
    setLoopPoints: vi.fn(),
    // TASK-062: アクセント判定はgetTicksAtTime(time)を丸めた値で行う。既定では
    // time自体をtickとして返す（テストごとにmockReturnValueOnce/mockImplementation
    // で上書きする）。
    getTicksAtTime: vi.fn((time: number) => time),
  };
  const mockDraw = {
    // Draw.schedule は本来 requestAnimationFrame タイミングで呼ばれるが、テストでは
    // 即座に呼び出して同期的に検証できるようにする。
    schedule: vi.fn((callback: () => void) => callback()),
  };

  const mockDestination = {
    volume: { value: 0 },
    mute: false,
  };

  return {
    getTransport: vi.fn(() => mockTransport),
    getDraw: vi.fn(() => mockDraw),
    getDestination: vi.fn(() => mockDestination),
    Synth: vi.fn().mockImplementation(() => ({
      toDestination: vi.fn().mockReturnThis(),
      triggerAttackRelease: vi.fn(),
      dispose: vi.fn(),
    })),
    PolySynth: vi.fn().mockImplementation(() => ({
      toDestination: vi.fn().mockReturnThis(),
      triggerAttackRelease: vi.fn(),
      dispose: vi.fn(),
    })),
    Sequence: vi.fn().mockImplementation((callback: (time: number, value: unknown) => void, events: unknown[]) => ({
      callback,
      events,
      start: vi.fn(),
      stop: vi.fn(),
      dispose: vi.fn(),
    })),
    Part: vi.fn().mockImplementation((_callback, events) => ({
      events,
      start: vi.fn().mockReturnThis(),
      dispose: vi.fn(),
    })),
    Frequency: vi.fn((midiNumber) => ({
      toNote: () => {
        if (midiNumber === 60) return 'C4';
        if (midiNumber === 62) return 'D4';
        if (midiNumber === 48) return 'C3';
        return 'A4'; // default
      },
    })),
  };
});

/**
 * tone@15.1.22 の Tone.Sequence._seqCallback（node_modules/tone/build/esm/event/Sequence.js:67）
 * の仕様をエミュレートするテストヘルパー（TASK-061）。events を走査し、
 * `value !== null` の場合のみ `callback(time, value)` を呼ぶ。この判定こそが
 * 「イベント配列に null が含まれるとコールバックが発火しない」という
 * 無音バグの再現条件であり、判定ロジックを弱めてはならない。
 */
function fireSequenceTick(
  sequence: { callback: (time: number, value: unknown) => void; events: unknown[] },
  time: number
): void {
  sequence.events.forEach((value) => {
    if (value !== null) {
      sequence.callback(time, value);
    }
  });
}

function makeNote(
  overrides: Partial<{
    id: string;
    partId: string;
    midiNumber: number;
    startTick: number;
    durationTicks: number;
    isRest: boolean;
    measureNumber: number;
    noteIndex: number;
    hand: 'left' | 'right' | 'unknown';
  }>
) {
  return {
    id: overrides.id ?? 'P1-M1-N0',
    partId: overrides.partId ?? 'P1',
    measureNumber: overrides.measureNumber ?? 1,
    noteIndex: overrides.noteIndex ?? 0,
    pitch: { step: 'C', octave: 4 },
    midiNumber: overrides.midiNumber ?? 60,
    duration: 1,
    startTick: overrides.startTick ?? 0,
    durationTicks: overrides.durationTicks ?? 480,
    startSeconds: 0,
    durationSeconds: 0.5,
    voice: 1,
    isChord: false,
    isRest: overrides.isRest ?? false,
    ...overrides,
  };
}

function makeScore(): Score {
  // Two hands, measure 1: P1 C4@tick0, P2 C3@tick0 (same group), P1 D4@tick480 (right-only group)
  const p1c4 = makeNote({ id: 'P1-M1-N0', partId: 'P1', midiNumber: 60, startTick: 0 });
  const p2c3 = makeNote({ id: 'P2-M1-N0', partId: 'P2', midiNumber: 48, startTick: 0 });
  const p1d4 = makeNote({
    id: 'P1-M1-N1',
    partId: 'P1',
    midiNumber: 62,
    startTick: 480,
    noteIndex: 1,
  });
  const rest = makeNote({
    id: 'P2-M1-N1',
    partId: 'P2',
    midiNumber: 0,
    startTick: 480,
    noteIndex: 1,
    isRest: true,
  });

  return {
    title: 'Test',
    parts: [
      { id: 'P1', name: 'Right', hand: 'right', clef: 'treble' },
      { id: 'P2', name: 'Left', hand: 'left', clef: 'bass' },
    ],
    measures: [{ number: 1, startTick: 0, notes: [p1c4, p2c3, p1d4, rest] }],
    tempo: 120,
    ticksPerQuarter: 480,
    tempoMap: [{ tick: 0, bpm: 120 }],
    timeSignature: { beats: 4, beatType: 4 },
    keySignature: 0,
  };
}

function makeDurationScore(): Score {
  // TASK-057: 全音符（右手、4拍=1920tick）が鳴り続ける間に、左手の四分音符4つが
  // 順に進む混在スコア。判定グループ（startTick単位）は4つ（0/480/960/1440）だが、
  // 発音境界（開始・終了）tickは0/480/960/1440/1920の5つで、うち480/960/1440は
  // 「前の四分音符の終了」と「次の四分音符の開始」が同一tickに重なる。1920は
  // 全音符の終了と最後の四分音符の終了が重なる。
  const wholeNote = makeNote({
    id: 'P1-M1-N0',
    partId: 'P1',
    midiNumber: 60,
    startTick: 0,
    durationTicks: 1920,
    hand: 'right',
  });
  const quarter1 = makeNote({
    id: 'P2-M1-N0',
    partId: 'P2',
    midiNumber: 48,
    startTick: 0,
    durationTicks: 480,
    noteIndex: 0,
    hand: 'left',
  });
  const quarter2 = makeNote({
    id: 'P2-M1-N1',
    partId: 'P2',
    midiNumber: 50,
    startTick: 480,
    durationTicks: 480,
    noteIndex: 1,
    hand: 'left',
  });
  const quarter3 = makeNote({
    id: 'P2-M1-N2',
    partId: 'P2',
    midiNumber: 52,
    startTick: 960,
    durationTicks: 480,
    noteIndex: 2,
    hand: 'left',
  });
  const quarter4 = makeNote({
    id: 'P2-M1-N3',
    partId: 'P2',
    midiNumber: 53,
    startTick: 1440,
    durationTicks: 480,
    noteIndex: 3,
    hand: 'left',
  });

  return {
    title: 'Test',
    parts: [
      { id: 'P1', name: 'Right', hand: 'right', clef: 'treble' },
      { id: 'P2', name: 'Left', hand: 'left', clef: 'bass' },
    ],
    measures: [
      { number: 1, startTick: 0, notes: [wholeNote, quarter1, quarter2, quarter3, quarter4] },
    ],
    tempo: 120,
    ticksPerQuarter: 480,
    tempoMap: [{ tick: 0, bpm: 120 }],
    timeSignature: { beats: 4, beatType: 4 },
    keySignature: 0,
  };
}

function makeHandScore(): Score {
  // TASK-051: practiceMode別スケジューリング検証用。Note.handを明示的に設定する
  // （makeScore()のノーツはhand未設定＝'both'フィルタの後方互換確認専用）。
  // measure 1: P1(right) C4@tick0, P2(left) C3@tick0 (same group), P1(right) D4@tick480
  const rightC4 = makeNote({
    id: 'P1-M1-N0',
    partId: 'P1',
    midiNumber: 60,
    startTick: 0,
    hand: 'right',
  });
  const leftC3 = makeNote({
    id: 'P2-M1-N0',
    partId: 'P2',
    midiNumber: 48,
    startTick: 0,
    hand: 'left',
  });
  const rightD4 = makeNote({
    id: 'P1-M1-N1',
    partId: 'P1',
    midiNumber: 62,
    startTick: 480,
    noteIndex: 1,
    hand: 'right',
  });

  return {
    title: 'Test',
    parts: [
      { id: 'P1', name: 'Right', hand: 'right', clef: 'treble' },
      { id: 'P2', name: 'Left', hand: 'left', clef: 'bass' },
    ],
    measures: [{ number: 1, startTick: 0, notes: [rightC4, leftC3, rightD4] }],
    tempo: 120,
    ticksPerQuarter: 480,
    tempoMap: [{ tick: 0, bpm: 120 }],
    timeSignature: { beats: 4, beatType: 4 },
    keySignature: 0,
  };
}

describe('AudioEngineService', () => {
  let service: AudioEngineService;

  beforeEach(() => {
    service = new AudioEngineService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('setBpm(120) sets Tone.Transport.bpm to 120', () => {
    service.setBpm(120);
    expect(Tone.getTransport().bpm.value).toBe(120);
  });

  it('setMetronomeEnabled(true) starts metronome sequence without starting Transport', () => {
    service.setMetronomeEnabled(true);
    // metronome start triggers sequence start, but must not start the shared Transport
    // (TASK-042: Transport lifecycle belongs to playback controls only).
    // @ts-expect-error private
    expect(service.metronome.sequence.start).toHaveBeenCalledWith(0);
    expect(Tone.getTransport().start).not.toHaveBeenCalled();
  });

  it('setMetronomeEnabled(false) stops metronome sequence without stopping Transport', () => {
    service.setMetronomeEnabled(true);
    service.setMetronomeEnabled(false);
    // @ts-expect-error private
    expect(service.metronome.sequence.stop).toHaveBeenCalled();
    expect(Tone.getTransport().stop).not.toHaveBeenCalled();
  });

  it('playNote(60) correctly plays C4 on playSynth', () => {
    service.playNote(60);
    // @ts-expect-error private
    expect(service.playSynth.triggerAttackRelease).toHaveBeenCalledWith('C4', '8n');
  });

  it('dispose() frees resources', () => {
    // @ts-expect-error private
    const synthSpy = vi.spyOn(service.clickSynth, 'dispose');
    // @ts-expect-error private
    const polySynthSpy = vi.spyOn(service.playSynth, 'dispose');

    service.dispose();

    expect(synthSpy).toHaveBeenCalled();
    expect(polySynthSpy).toHaveBeenCalled();
  });

  describe('StrictMode resilience (2026-07-05 troubleshooting, root cause 1)', () => {
    it('re-initializes synths after dispose(), so calling a method afterwards still produces sound', () => {
      const polySynthCallsBefore = (Tone.PolySynth as unknown as Mock).mock.calls.length;

      // Simulates React 18 StrictMode's "run effect -> cleanup -> run effect again"
      // cycle disposing the AudioEngineService instance retained by useMemo.
      service.dispose();

      // A later method call (e.g. from a subsequent bpm/metronome sync effect)
      // must not operate on disposed/undefined synths.
      expect(() => service.playNote(60)).not.toThrow();

      const polySynthCallsAfter = (Tone.PolySynth as unknown as Mock).mock.calls.length;
      expect(polySynthCallsAfter).toBeGreaterThan(polySynthCallsBefore);
      // @ts-expect-error private
      expect(service.playSynth.triggerAttackRelease).toHaveBeenCalledWith('C4', '8n');
    });

    it('re-initializes the metronome after dispose(), so setMetronomeEnabled still works', () => {
      service.dispose();

      expect(() => service.setMetronomeEnabled(true)).not.toThrow();
      // @ts-expect-error private
      expect(service.metronome.sequence.start).toHaveBeenCalledWith(0);
    });

    it('dispose() is idempotent: calling it twice does not throw and does not double-dispose', () => {
      // @ts-expect-error private
      const synthDisposeSpy = service.clickSynth.dispose as Mock;

      expect(() => {
        service.dispose();
        service.dispose();
      }).not.toThrow();

      expect(synthDisposeSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('loadScore (time-based scheduling, root cause 3)', () => {
    it('sets Transport.PPQ to score.ticksPerQuarter', () => {
      service.loadScore(makeScore());
      expect(Tone.getTransport().PPQ).toBe(480);
    });

    it('registers a Tone.Part event per sounding note (all parts) using tick-based time/duration', () => {
      service.loadScore(makeScore());

      expect(Tone.Part).toHaveBeenCalledTimes(1);
      const events = (Tone.Part as unknown as Mock).mock.calls[0][1] as {
        time: string;
        note: string;
        duration: string;
      }[];

      // 3 sounding notes (rest excluded)
      expect(events).toHaveLength(3);
      expect(events).toEqual(
        expect.arrayContaining([
          { time: '0i', note: 'C4', duration: '480i' },
          { time: '0i', note: 'C3', duration: '480i' },
          { time: '480i', note: 'D4', duration: '480i' },
        ])
      );
    });

    it('disposes the previous Tone.Part when a new score is loaded (score replacement)', () => {
      service.loadScore(makeScore());
      // @ts-expect-error private
      const previousPart = service.scorePart;
      const disposeSpy = previousPart!.dispose as Mock;

      service.loadScore(makeScore());

      expect(disposeSpy).toHaveBeenCalled();
    });

    it('schedules one Transport.schedule callback per judgement group (same startTick) per measure', () => {
      service.loadScore(makeScore());

      // 2 groups: tick0 (C4+C3), tick480 (D4 only; rest excluded). Judgement-group
      // calls are registered first (TASK-057 adds further Transport.schedule calls
      // afterwards for the sounding-notes boundary tracking; see the dedicated
      // describe block below), so the first 2 calls are exactly these groups.
      const scheduleCalls = (Tone.getTransport().schedule as unknown as Mock).mock.calls;
      const groupCalls = scheduleCalls.slice(0, 2);
      expect(groupCalls[0][1]).toBe('0i');
      expect(groupCalls[1][1]).toBe('480i');
    });

    it('fires onPositionChange(measureNumber, groupIndex) in tick order via Tone.getDraw().schedule', () => {
      const onPositionChange = vi.fn();
      service.setPositionCallback(onPositionChange);
      service.loadScore(makeScore());

      const scheduleCalls = (Tone.getTransport().schedule as unknown as Mock).mock.calls;
      // Invoke the scheduled Transport callbacks as Tone.js would at playback time.
      scheduleCalls.forEach(([callback]: [(time: number) => void]) => callback(0));

      expect(onPositionChange).toHaveBeenNthCalledWith(1, 1, 0);
      expect(onPositionChange).toHaveBeenNthCalledWith(2, 1, 1);
    });

    it('clears previously scheduled position events when the score is replaced', () => {
      service.loadScore(makeScore());
      const clearSpy = Tone.getTransport().clear as Mock;
      clearSpy.mockClear();

      service.loadScore(makeScore());

      // 2 judgement-group events + 3 sounding-notes boundary events (TASK-057;
      // tick 0/480/960 for makeScore()'s 3 sounding notes) cleared on the second load.
      expect(clearSpy).toHaveBeenCalledTimes(5);
    });
  });

  describe('sounding notes tracking (TASK-057: keyboard highlight follows note duration)', () => {
    it('registers one Transport.schedule call per unique note start/end tick (aggregated), in addition to the per-judgement-group schedule', () => {
      service.loadScore(makeDurationScore());

      const scheduleCalls = (Tone.getTransport().schedule as unknown as Mock).mock.calls;
      // 4 judgement-group calls (startTick 0/480/960/1440) registered first (existing
      // behavior, unchanged), followed by 5 aggregated boundary calls
      // (tick 0/480/960/1440/1920). Ticks 480/960/1440 each merge a note-end and a
      // note-start into a single Transport.schedule call (no per-note duplication).
      expect(scheduleCalls).toHaveLength(9);
      expect(scheduleCalls.slice(4).map(([, time]) => time)).toEqual([
        '0i',
        '480i',
        '960i',
        '1440i',
        '1920i',
      ]);
    });

    it('fires onSoundingNotesChange via Tone.getDraw().schedule with the currently sounding note set as boundary ticks are reached, so a long note stays highlighted while shorter notes advance underneath it', () => {
      const onSoundingNotesChange = vi.fn();
      service.setSoundingNotesCallback(onSoundingNotesChange);
      service.loadScore(makeDurationScore());

      const scheduleCalls = (Tone.getTransport().schedule as unknown as Mock).mock.calls;
      const boundaryCallbacks = scheduleCalls
        .slice(4)
        .map(([callback]) => callback as (time: number) => void);

      boundaryCallbacks[0](0); // tick 0: whole note(60) + quarter1(48) start
      expect(new Set(onSoundingNotesChange.mock.calls.at(-1)![0])).toEqual(new Set([60, 48]));

      boundaryCallbacks[1](1); // tick 480: quarter1(48) ends, quarter2(50) starts
      expect(new Set(onSoundingNotesChange.mock.calls.at(-1)![0])).toEqual(new Set([60, 50]));

      boundaryCallbacks[2](2); // tick 960: quarter2(50) ends, quarter3(52) starts
      expect(new Set(onSoundingNotesChange.mock.calls.at(-1)![0])).toEqual(new Set([60, 52]));

      boundaryCallbacks[3](3); // tick 1440: quarter3(52) ends, quarter4(53) starts
      expect(new Set(onSoundingNotesChange.mock.calls.at(-1)![0])).toEqual(new Set([60, 53]));

      boundaryCallbacks[4](4); // tick 1920: whole note(60) ends, quarter4(53) ends
      expect(new Set(onSoundingNotesChange.mock.calls.at(-1)![0])).toEqual(new Set());
    });

    it('does not throw when a boundary tick fires and no onSoundingNotesChange callback is registered', () => {
      service.loadScore(makeDurationScore());

      const scheduleCalls = (Tone.getTransport().schedule as unknown as Mock).mock.calls;
      const boundaryCallback = scheduleCalls[4][0] as (time: number) => void;

      expect(() => boundaryCallback(0)).not.toThrow();
    });

    it('resets sounding notes (invokes onSoundingNotesChange with an empty set) when the score is replaced', () => {
      const onSoundingNotesChange = vi.fn();
      service.setSoundingNotesCallback(onSoundingNotesChange);
      service.loadScore(makeDurationScore());
      onSoundingNotesChange.mockClear();

      service.loadScore(makeDurationScore());

      expect(onSoundingNotesChange).toHaveBeenCalledWith(new Set());
    });

    it('clears previously scheduled boundary events (along with judgement-group events) when the score is replaced', () => {
      service.loadScore(makeDurationScore());
      const clearSpy = Tone.getTransport().clear as Mock;
      clearSpy.mockClear();

      service.loadScore(makeDurationScore());

      // 4 judgement-group events + 5 boundary events cleared on the second load.
      expect(clearSpy).toHaveBeenCalledTimes(9);
    });

    it('clears sounding notes when stopAccompaniment is called', () => {
      const onSoundingNotesChange = vi.fn();
      service.setSoundingNotesCallback(onSoundingNotesChange);
      service.loadScore(makeDurationScore());
      const scheduleCalls = (Tone.getTransport().schedule as unknown as Mock).mock.calls;
      (scheduleCalls[4][0] as (time: number) => void)(0);
      onSoundingNotesChange.mockClear();

      service.stopAccompaniment();

      expect(onSoundingNotesChange).toHaveBeenCalledWith(new Set());
    });

    it('clears sounding notes when pauseAccompaniment is called', () => {
      const onSoundingNotesChange = vi.fn();
      service.setSoundingNotesCallback(onSoundingNotesChange);
      service.loadScore(makeDurationScore());
      const scheduleCalls = (Tone.getTransport().schedule as unknown as Mock).mock.calls;
      (scheduleCalls[4][0] as (time: number) => void)(0);
      onSoundingNotesChange.mockClear();

      service.pauseAccompaniment();

      expect(onSoundingNotesChange).toHaveBeenCalledWith(new Set());
    });
  });

  describe('setLoopPoints (REQ-010-008)', () => {
    it('sets Transport.loop=true and computes tick-based loop points from measure startTicks', () => {
      const score = makeScore();
      score.measures.push({
        number: 2,
        startTick: 1920,
        notes: [makeNote({ id: 'P1-M2-N0', startTick: 1920, durationTicks: 480 })],
      });

      service.setLoopPoints(score, true, 1, 1);

      expect(Tone.getTransport().setLoopPoints).toHaveBeenCalledWith('0i', '1920i');
      expect(Tone.getTransport().loop).toBe(true);
    });

    it('sets Transport.loop=false when disabled', () => {
      service.setLoopPoints(makeScore(), false, 1, 1);
      expect(Tone.getTransport().loop).toBe(false);
    });

    it('sets Transport.loop=false when no score is loaded', () => {
      service.setLoopPoints(null, true, 1, 1);
      expect(Tone.getTransport().loop).toBe(false);
    });
  });

  describe('loadScore practiceMode filter (TASK-051, REQ-010-010)', () => {
    it('schedules all sounding notes (both hands) when practiceMode is "both" (default, backward compatible)', () => {
      service.loadScore(makeHandScore());

      const events = (Tone.Part as unknown as Mock).mock.calls[0][1] as { note: string }[];
      expect(events).toHaveLength(3);
    });

    it('schedules only right-hand notes when practiceMode is "right"', () => {
      service.loadScore(makeHandScore(), 'right');

      const events = (Tone.Part as unknown as Mock).mock.calls[0][1] as {
        time: string;
        note: string;
        duration: string;
      }[];
      expect(events).toHaveLength(2);
      expect(events).toEqual(
        expect.arrayContaining([
          { time: '0i', note: 'C4', duration: '480i' },
          { time: '480i', note: 'D4', duration: '480i' },
        ])
      );
    });

    it('schedules only left-hand notes when practiceMode is "left"', () => {
      service.loadScore(makeHandScore(), 'left');

      const events = (Tone.Part as unknown as Mock).mock.calls[0][1] as {
        time: string;
        note: string;
        duration: string;
      }[];
      expect(events).toHaveLength(1);
      expect(events).toEqual([{ time: '0i', note: 'C3', duration: '480i' }]);
    });

    it('does not change the judgement-group position schedule (cursor tracking) based on practiceMode', () => {
      service.loadScore(makeHandScore(), 'left');

      // 2 groups regardless of practiceMode: tick0 (right+left) and tick480 (right only).
      // Cursor progression follows the actual score timing, independent of which hand is
      // being practiced/played. (TASK-057 adds further Transport.schedule calls afterwards
      // for the sounding-notes boundary tracking, scoped to the practiceMode-filtered
      // notes; only the first 2 calls are the judgement-group schedule verified here.)
      const scheduleCalls = (Tone.getTransport().schedule as unknown as Mock).mock.calls;
      const groupCalls = scheduleCalls.slice(0, 2);
      expect(groupCalls).toHaveLength(2);
    });
  });

  describe('playAccompaniment start offset (TASK-051, REQ-010-001)', () => {
    // Transport.start(undefined, `${tick}i`) のoffset引数は一時停止状態からの
    // 再開時に無視されることがある（2026-07-05 実機フィードバックで判明）。
    // 症状は「カーソルで選択した位置から再生されず、前回停止した位置から再生される」。
    // そのため Transport.ticks への明示代入でシークしてから start() する方式を検証する。
    it('starts Transport without seeking when no startTick is given', () => {
      service.playAccompaniment();

      expect(Tone.getTransport().start).toHaveBeenCalledWith();
      expect(Tone.getTransport().ticks).not.toBe(480);
    });

    it('seeks Transport.ticks to the given startTick before starting (cursor position playback)', () => {
      service.playAccompaniment(480);

      expect(Tone.getTransport().ticks).toBe(480);
      expect(Tone.getTransport().start).toHaveBeenCalledWith();
    });

    it('treats startTick=0 as an explicit seek to the beginning', () => {
      // 事前に別の位置へ進んでいた状態を模す
      (Tone.getTransport() as unknown as { ticks: number }).ticks = 960;
      service.playAccompaniment(0);

      expect(Tone.getTransport().ticks).toBe(0);
      expect(Tone.getTransport().start).toHaveBeenCalledWith();
    });
  });

  describe('setOnStop (REQ-010-004)', () => {
    it('invokes the registered stop callback when stopAccompaniment() is called', () => {
      const onStop = vi.fn();
      service.setOnStop(onStop);

      service.stopAccompaniment();

      expect(Tone.getTransport().stop).toHaveBeenCalled();
      expect(onStop).toHaveBeenCalledTimes(1);
    });
  });

  describe('setMasterVolume (TASK-052)', () => {
    it('sets Destination.volume.value to 0dB (unity gain) at the maximum UI value (100) and unmutes', () => {
      service.setMasterVolume(100);

      expect(Tone.getDestination().volume.value).toBeCloseTo(0, 5);
      expect(Tone.getDestination().mute).toBe(false);
    });

    it('mutes Destination when the UI value is 0 (avoids log10(0) = NaN)', () => {
      service.setMasterVolume(0);

      expect(Tone.getDestination().mute).toBe(true);
    });

    it('unmutes Destination when a non-zero value is set after a previous mute', () => {
      service.setMasterVolume(0);
      service.setMasterVolume(50);

      expect(Tone.getDestination().mute).toBe(false);
    });

    it('converts UI values to a monotonically increasing dB scale (quieter UI value -> lower dB)', () => {
      service.setMasterVolume(50);
      const dbAt50 = Tone.getDestination().volume.value;

      service.setMasterVolume(80);
      const dbAt80 = Tone.getDestination().volume.value;

      expect(dbAt50).toBeLessThan(dbAt80);
      expect(dbAt80).toBeLessThanOrEqual(0);
    });

    it('clamps UI values above 100 to the maximum (0dB)', () => {
      service.setMasterVolume(150);

      expect(Tone.getDestination().volume.value).toBeCloseTo(0, 5);
      expect(Tone.getDestination().mute).toBe(false);
    });

    it('does not throw when called after dispose() (re-synced from store on next mount)', () => {
      service.dispose();

      expect(() => service.setMasterVolume(70)).not.toThrow();
    });
  });

  describe('metronome/Transport lifecycle decoupling (TASK-042, REQ-006-005)', () => {
    it('does not start playback when enabling the metronome while stopped (playbackState stays "stopped")', () => {
      service.setMetronomeEnabled(true);

      expect(Tone.getTransport().start).not.toHaveBeenCalled();
    });

    it('schedules the click without an extra Transport.start call when enabling the metronome during playback', () => {
      service.playAccompaniment();
      (Tone.getTransport().start as Mock).mockClear();

      service.setMetronomeEnabled(true);

      // @ts-expect-error private
      expect(service.metronome.sequence.start).toHaveBeenCalledWith(0);
      expect(Tone.getTransport().start).not.toHaveBeenCalled();
    });

    it('stops only the click (not the Transport/accompaniment) when disabling the metronome during playback', () => {
      service.playAccompaniment();
      service.setMetronomeEnabled(true);

      service.setMetronomeEnabled(false);

      // @ts-expect-error private
      expect(service.metronome.sequence.stop).toHaveBeenCalled();
      expect(Tone.getTransport().stop).not.toHaveBeenCalled();
    });

    it('does not resume playback when disabling the metronome while stopped (playbackState stays "stopped")', () => {
      service.setMetronomeEnabled(true);
      service.setMetronomeEnabled(false);

      expect(Tone.getTransport().start).not.toHaveBeenCalled();
      expect(Tone.getTransport().stop).not.toHaveBeenCalled();
    });
  });

  describe('metronome click sound (TASK-061, REQ-006-005)', () => {
    it('triggers synth.triggerAttackRelease when the Sequence tick fires, using the same null-skip semantics as Tone.js (結線テスト)', () => {
      service.setMetronomeEnabled(true);

      // @ts-expect-error private
      const sequence = service.metronome.sequence as {
        callback: (time: number, value: unknown) => void;
        events: unknown[];
      };
      // @ts-expect-error private
      const clickSynth = service.metronome.synth as { triggerAttackRelease: Mock };

      fireSequenceTick(sequence, 0);

      // TASK-062でアクセント判定が追加され、非アクセント拍はvelocity 0.6を明示的に
      // 渡すようになった（従来のvelocity省略=既定1.0から意図的に変更、アクセントとの
      // 相対差を作るため）。スコア未読み込み時はmeasureStartTicksが空集合のため
      // 常に非アクセント判定になる。
      expect(clickSynth.triggerAttackRelease).toHaveBeenCalledWith('C5', '32n', 0, 0.6);
    });

    it('registers an events array containing a non-null value (so Tone.js does not skip the click as a rest)', () => {
      service.setMetronomeEnabled(true);

      // @ts-expect-error private
      const sequence = service.metronome.sequence as { events: unknown[] };

      expect(sequence.events.some((value) => value !== null)).toBe(true);
    });
  });

  describe('metronome accent (TASK-062, REQ-006-008)', () => {
    /** measures[].startTickの集合を指定した最小構成のスコアを作る（アクセント判定用）。 */
    function makeScoreWithMeasureStarts(startTicks: number[]): Score {
      return {
        title: 'Accent Test',
        parts: [{ id: 'P1', name: 'Right', hand: 'right', clef: 'treble' }],
        measures: startTicks.map((startTick, index) => ({
          number: index + 1,
          startTick,
          notes: [],
        })),
        tempo: 120,
        ticksPerQuarter: 480,
        tempoMap: [{ tick: 0, bpm: 120 }],
        timeSignature: { beats: 4, beatType: 4 },
        keySignature: 0,
      };
    }

    function fireAtTick(tick: number): void {
      (Tone.getTransport().getTicksAtTime as Mock).mockReturnValueOnce(tick);
      // @ts-expect-error private
      const sequence = service.metronome.sequence as {
        callback: (time: number, value: unknown) => void;
        events: unknown[];
      };
      fireSequenceTick(sequence, tick);
    }

    function getSynthMock(): Mock {
      // @ts-expect-error private
      return (service.metronome.synth as { triggerAttackRelease: Mock }).triggerAttackRelease;
    }

    it('plays the accent (C6, velocity 1.0) when the click tick matches a measure startTick', () => {
      service.loadScore(makeScoreWithMeasureStarts([0, 1920, 3840]));
      service.setMetronomeEnabled(true);

      fireAtTick(1920);

      expect(getSynthMock()).toHaveBeenCalledWith('C6', '32n', 1920, 1.0);
    });

    it('plays the regular click (C5, velocity 0.6) when the click tick does not match a measure startTick', () => {
      service.loadScore(makeScoreWithMeasureStarts([0, 1920, 3840]));
      service.setMetronomeEnabled(true);

      fireAtTick(480);

      expect(getSynthMock()).toHaveBeenCalledWith('C5', '32n', 480, 0.6);
    });

    it('plays the regular click even at a measure startTick when accent is disabled via setMetronomeAccentEnabled(false)', () => {
      service.loadScore(makeScoreWithMeasureStarts([0, 1920, 3840]));
      service.setMetronomeAccentEnabled(false);
      service.setMetronomeEnabled(true);

      fireAtTick(1920);

      expect(getSynthMock()).toHaveBeenCalledWith('C5', '32n', 1920, 0.6);
    });

    it('correctly accents an irregular (pickup-measure-like) set of measure startTicks', () => {
      service.loadScore(makeScoreWithMeasureStarts([0, 480, 2400]));
      service.setMetronomeEnabled(true);

      fireAtTick(2400);
      expect(getSynthMock()).toHaveBeenLastCalledWith('C6', '32n', 2400, 1.0);

      fireAtTick(960);
      expect(getSynthMock()).toHaveBeenLastCalledWith('C5', '32n', 960, 0.6);
    });

    it('links score measure startTicks to the metronome via loadScore (結線テスト)', () => {
      const score = makeScoreWithMeasureStarts([0, 1920]);

      service.loadScore(score);

      // @ts-expect-error private
      const measureStartTicks = service.metronome.measureStartTicks as Set<number>;
      expect(measureStartTicks.has(0)).toBe(true);
      expect(measureStartTicks.has(1920)).toBe(true);
    });

    it('retains the accent-enabled flag and measure startTicks after dispose() and re-initialization (StrictMode resilience)', () => {
      service.loadScore(makeScoreWithMeasureStarts([0, 1920]));
      service.setMetronomeAccentEnabled(false);

      service.dispose();
      service.setMetronomeEnabled(true);

      fireAtTick(1920);

      // accent無効設定が再初期化後も維持され、小節頭tickでもC5・0.6で鳴る
      expect(getSynthMock()).toHaveBeenCalledWith('C5', '32n', 1920, 0.6);
    });
  });
});
