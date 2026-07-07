import { describe, it, expect, vi, afterEach, type Mock } from 'vitest';
import * as Tone from 'tone';
import { PLAYBACK_VOICES, createPlaybackInstrument, type PlaybackVoiceId } from './voices';

vi.mock('tone', () => {
  return {
    Sampler: vi.fn().mockImplementation((options: Record<string, unknown>) => ({
      __kind: 'Sampler',
      __options: options,
      toDestination: vi.fn().mockReturnThis(),
      triggerAttackRelease: vi.fn(),
      dispose: vi.fn(),
    })),
    PolySynth: vi.fn().mockImplementation((voice: unknown, options: unknown) => ({
      __kind: 'PolySynth',
      __voice: voice,
      __options: options,
      toDestination: vi.fn().mockReturnThis(),
      triggerAttackRelease: vi.fn(),
      dispose: vi.fn(),
    })),
    Synth: vi.fn(),
    FMSynth: vi.fn(),
  };
});

describe('PLAYBACK_VOICES', () => {
  it('defines exactly the 4 documented voice ids', () => {
    expect(Object.keys(PLAYBACK_VOICES).sort()).toEqual(
      ['electric-piano', 'grand-piano', 'organ', 'synth'].sort()
    );
  });

  it('marks grand-piano as requiresLoading: true (Sampler needs sample download)', () => {
    expect(PLAYBACK_VOICES['grand-piano'].requiresLoading).toBe(true);
  });

  it.each(['electric-piano', 'organ', 'synth'] as PlaybackVoiceId[])(
    'marks %s as requiresLoading: false (synth is immediately playable)',
    (id) => {
      expect(PLAYBACK_VOICES[id].requiresLoading).toBe(false);
    }
  );

  it('provides a human-readable label for every voice', () => {
    Object.values(PLAYBACK_VOICES).forEach((voice) => {
      expect(typeof voice.label).toBe('string');
      expect(voice.label.length).toBeGreaterThan(0);
    });
  });
});

describe('createPlaybackInstrument', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('creates a Tone.Sampler for grand-piano', () => {
    const instrument = createPlaybackInstrument('grand-piano');

    expect(Tone.Sampler).toHaveBeenCalledTimes(1);
    expect(Tone.PolySynth).not.toHaveBeenCalled();
    expect((instrument as unknown as { __kind: string }).__kind).toBe('Sampler');
  });

  it('resolves Salamander sample URLs into a urls map keyed by sharp note names (Ds1.mp3 -> "D#1")', () => {
    createPlaybackInstrument('grand-piano');

    const options = (Tone.Sampler as unknown as Mock).mock.calls[0][0] as {
      urls: Record<string, string>;
    };

    // A0/C1 have no sharp; Ds1/Fs1 must be normalized to D#1/F#1 for Tone.Frequency.
    expect(options.urls['A0']).toBeTruthy();
    expect(options.urls['C1']).toBeTruthy();
    expect(options.urls['D#1']).toBeTruthy();
    expect(options.urls['F#1']).toBeTruthy();
    expect(options.urls['Ds1']).toBeUndefined();
  });

  it('passes through onload/onerror callbacks to the Sampler for load-state tracking', () => {
    const onload = vi.fn();
    const onerror = vi.fn();

    createPlaybackInstrument('grand-piano', { onload, onerror });

    const options = (Tone.Sampler as unknown as Mock).mock.calls[0][0] as {
      onload: () => void;
      onerror: (error: Error) => void;
    };
    expect(options.onload).toBe(onload);
    expect(options.onerror).toBe(onerror);
  });

  it('creates a Tone.PolySynth(FMSynth) for electric-piano', () => {
    const instrument = createPlaybackInstrument('electric-piano');

    expect(Tone.PolySynth).toHaveBeenCalledTimes(1);
    expect(Tone.Sampler).not.toHaveBeenCalled();
    expect((Tone.PolySynth as unknown as Mock).mock.calls[0][0]).toBe(Tone.FMSynth);
    expect((instrument as unknown as { __kind: string }).__kind).toBe('PolySynth');
  });

  it('creates a Tone.PolySynth(Synth) with a sustained envelope for organ', () => {
    createPlaybackInstrument('organ');

    expect((Tone.PolySynth as unknown as Mock).mock.calls[0][0]).toBe(Tone.Synth);
    const options = (Tone.PolySynth as unknown as Mock).mock.calls[0][1] as {
      envelope?: { sustain?: number };
    };
    expect(options.envelope?.sustain).toBeGreaterThan(0.5);
  });

  it('creates a Tone.PolySynth(Synth) for synth (current behavior, backward compatible)', () => {
    createPlaybackInstrument('synth');

    expect((Tone.PolySynth as unknown as Mock).mock.calls[0][0]).toBe(Tone.Synth);
    expect((Tone.Sampler as unknown as Mock)).not.toHaveBeenCalled();
  });

  it('ignores onload/onerror options for non-Sampler voices (they are immediately playable)', () => {
    const onload = vi.fn();
    const onerror = vi.fn();

    expect(() => createPlaybackInstrument('synth', { onload, onerror })).not.toThrow();
    expect(onload).not.toHaveBeenCalled();
    expect(onerror).not.toHaveBeenCalled();
  });
});
