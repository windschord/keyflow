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
  };
  const mockDraw = {
    // Draw.schedule は本来 requestAnimationFrame タイミングで呼ばれるが、テストでは
    // 即座に呼び出して同期的に検証できるようにする。
    schedule: vi.fn((callback: () => void) => callback()),
  };

  return {
    getTransport: vi.fn(() => mockTransport),
    getDraw: vi.fn(() => mockDraw),
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
    Sequence: vi.fn().mockImplementation(() => ({
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

  it('setMetronomeEnabled(true) starts metronome sequence', () => {
    service.setMetronomeEnabled(true);
    // metronome start triggers sequence start
    // @ts-expect-error private
    expect(service.metronome.sequence.start).toHaveBeenCalledWith(0);
    expect(Tone.getTransport().start).toHaveBeenCalled();
  });

  it('setMetronomeEnabled(false) stops metronome sequence', () => {
    service.setMetronomeEnabled(true);
    service.setMetronomeEnabled(false);
    // @ts-expect-error private
    expect(service.metronome.sequence.stop).toHaveBeenCalled();
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

      // 2 groups: tick0 (C4+C3), tick480 (D4 only; rest excluded)
      const scheduleCalls = (Tone.getTransport().schedule as unknown as Mock).mock.calls;
      expect(scheduleCalls).toHaveLength(2);
      expect(scheduleCalls[0][1]).toBe('0i');
      expect(scheduleCalls[1][1]).toBe('480i');
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

      expect(clearSpy).toHaveBeenCalledTimes(2); // 2 groups scheduled on the first load
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

  describe('setOnStop (REQ-010-004)', () => {
    it('invokes the registered stop callback when stopAccompaniment() is called', () => {
      const onStop = vi.fn();
      service.setOnStop(onStop);

      service.stopAccompaniment();

      expect(Tone.getTransport().stop).toHaveBeenCalled();
      expect(onStop).toHaveBeenCalledTimes(1);
    });
  });
});
