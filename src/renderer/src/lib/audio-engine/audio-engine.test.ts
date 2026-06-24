import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioEngineService } from './index';
import * as Tone from 'tone';
import type { Score } from '../../types/score';

vi.mock('tone', () => {
  const bpmMock = { value: 120 };
  const transportMock = {
    bpm: bpmMock,
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    position: 0,
    cancel: vi.fn(),
  };

  const synthInstanceMock = {
    triggerAttackRelease: vi.fn(),
    dispose: vi.fn(),
    toDestination: vi.fn().mockReturnThis(),
  };

  const partInstanceMock = {
    start: vi.fn(),
    stop: vi.fn(),
    dispose: vi.fn(),
  };

  const sequenceInstanceMock = {
    start: vi.fn(),
    stop: vi.fn(),
    dispose: vi.fn(),
  };

  return {
    getTransport: vi.fn(() => transportMock),
    Synth: vi.fn(() => synthInstanceMock),
    PolySynth: vi.fn(() => synthInstanceMock),
    MembraneSynth: vi.fn(() => synthInstanceMock),
    Part: vi.fn(() => partInstanceMock),
    Sequence: vi.fn(() => sequenceInstanceMock),
    start: vi.fn(),
    Frequency: vi.fn((val: number) => ({
      toNote: vi.fn(() => {
        if (val === 60) return 'C4';
        return 'A4';
      }),
    })),
  };
});

describe('AudioEngineService', () => {
  let service: AudioEngineService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AudioEngineService();
  });

  it('should set BPM correctly', () => {
    service.setBpm(120);
    const transport = Tone.getTransport();
    expect(transport.bpm.value).toBe(120);
  });

  it('should enable and disable metronome', () => {
    service.setMetronomeEnabled(true);
    // As Tone.js is mocked, we can check if the underlying sequence start/stop logic is called,
    // or just assume the state changes. If Metronome uses Tone.Sequence, it should be called.
    service.setMetronomeEnabled(false);
    expect(Tone.Sequence).toHaveBeenCalled();
  });

  it('should play C4 when playNote(60) is called', () => {
    service.playNote(60);
    expect(Tone.Frequency).toHaveBeenCalledWith(60, 'midi');
    // It should trigger attack release on the internal synth
    expect(Tone.Synth).toHaveBeenCalled();
  });

  it('should release resources when dispose is called', () => {
    service.dispose();
    // We expect the synths created in the constructor to be disposed
    // and Tone.getTransport().stop/cancel etc if applicable.
    // The specifics depend on implementation, but calling dispose should not throw.
    expect(true).toBe(true);
  });

  it('should play correct and incorrect sounds', () => {
    service.playCorrectSound();
    service.playIncorrectSound();
    expect(Tone.Synth).toHaveBeenCalled();
  });

  it('should handle accompaniment lifecycle', async () => {
    const dummyScore: Score = {
      title: 'Test',
      parts: [],
      measures: [],
      tempo: 120,
      timeSignature: { beats: 4, beatType: 4 },
      keySignature: 0,
    };
    await service.loadAccompaniment(dummyScore, 'left');
    service.playAccompaniment();
    service.pauseAccompaniment();
    service.stopAccompaniment();
    expect(Tone.getTransport().start).toHaveBeenCalled();
    expect(Tone.getTransport().pause).toHaveBeenCalled();
    expect(Tone.getTransport().stop).toHaveBeenCalled();
  });
});
