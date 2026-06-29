import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AudioEngineService } from './index';
import * as Tone from 'tone';

vi.mock('tone', () => {
  const mockTransport = {
    bpm: { value: 120 },
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
  };

  return {
    getTransport: vi.fn(() => mockTransport),
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
    Part: vi.fn().mockImplementation(() => ({
      start: vi.fn().mockReturnThis(),
      dispose: vi.fn(),
    })),
    Frequency: vi.fn((midiNumber) => ({
      toNote: () => {
        if (midiNumber === 60) return 'C4';
        return 'A4'; // default
      },
    })),
  };
});

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

  it('loadAccompaniment schedules events from score rhythm and tempo', async () => {
    await service.loadAccompaniment(
      {
        title: 'Rhythm test',
        parts: [{ id: 'P1', name: 'Right Hand', hand: 'right', clef: 'treble' }],
        measures: [
          {
            number: 1,
            notes: [
              {
                id: 'P1-M1-N0',
                partId: 'P1',
                measureNumber: 1,
                noteIndex: 0,
                pitch: { step: 'C', octave: 4 },
                midiNumber: 60,
                duration: 4,
                isChord: false,
                isRest: false,
              },
              {
                id: 'P1-M1-N1',
                partId: 'P1',
                measureNumber: 1,
                noteIndex: 1,
                pitch: { step: 'D', octave: 4 },
                midiNumber: 62,
                duration: 2,
                isChord: false,
                isRest: false,
              },
              {
                id: 'P1-M1-N2',
                partId: 'P1',
                measureNumber: 1,
                noteIndex: 2,
                pitch: { step: 'E', octave: 4 },
                midiNumber: 64,
                duration: 2,
                isChord: false,
                isRest: true,
              },
              {
                id: 'P1-M1-N3',
                partId: 'P1',
                measureNumber: 1,
                noteIndex: 3,
                pitch: { step: 'E', octave: 4 },
                midiNumber: 64,
                duration: 6,
                isChord: false,
                isRest: false,
              },
            ],
          },
        ],
        tempo: 120,
        timeSignature: { beats: 4, beatType: 4 },
        keySignature: 0,
      },
      'right'
    );

    expect(Tone.Part).toHaveBeenCalledWith(expect.any(Function), [
      { time: 0, note: 'C4', duration: 0.5 },
      { time: 0.5, note: 'A4', duration: 0.25 },
      { time: 1, note: 'A4', duration: 0.75 },
    ]);
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
});
