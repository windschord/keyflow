import { describe, it, expect, afterEach, vi, type Mock } from 'vitest';
import * as Tone from 'tone';
import { METRONOME_VOICES, createMetronomeVoice, type MetronomeVoiceId } from './metronome-voices';

vi.mock('tone', () => {
  function createSynthMock(): { toDestination: Mock; triggerAttackRelease: Mock; dispose: Mock } {
    const instance = {
      toDestination: vi.fn(),
      triggerAttackRelease: vi.fn(),
      dispose: vi.fn(),
    };
    instance.toDestination.mockReturnValue(instance);
    return instance;
  }

  return {
    Synth: vi.fn().mockImplementation(() => createSynthMock()),
    MembraneSynth: vi.fn().mockImplementation(() => createSynthMock()),
    MetalSynth: vi.fn().mockImplementation(() => createSynthMock()),
  };
});

describe('METRONOME_VOICES', () => {
  it('defines exactly the 4 documented voice ids', () => {
    expect(Object.keys(METRONOME_VOICES).sort()).toEqual(
      ['beep', 'click', 'cowbell', 'woodblock'].sort()
    );
  });

  it('provides a human-readable label for every voice', () => {
    Object.values(METRONOME_VOICES).forEach((voice) => {
      expect(typeof voice.label).toBe('string');
      expect(voice.label.length).toBeGreaterThan(0);
    });
  });
});

describe('createMetronomeVoice', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('creates a Tone.Synth for click', () => {
    createMetronomeVoice('click');

    expect(Tone.Synth).toHaveBeenCalledTimes(1);
    expect(Tone.MembraneSynth).not.toHaveBeenCalled();
    expect(Tone.MetalSynth).not.toHaveBeenCalled();
  });

  it('creates a Tone.MembraneSynth for woodblock', () => {
    createMetronomeVoice('woodblock');

    expect(Tone.MembraneSynth).toHaveBeenCalledTimes(1);
    expect(Tone.Synth).not.toHaveBeenCalled();
  });

  it('creates a Tone.Synth with a square oscillator for beep', () => {
    createMetronomeVoice('beep');

    expect(Tone.Synth).toHaveBeenCalledTimes(1);
    const options = (Tone.Synth as unknown as Mock).mock.calls[0][0] as {
      oscillator?: { type?: string };
    };
    expect(options.oscillator?.type).toBe('square');
  });

  it('creates a Tone.MetalSynth for cowbell', () => {
    createMetronomeVoice('cowbell');

    expect(Tone.MetalSynth).toHaveBeenCalledTimes(1);
    expect(Tone.MembraneSynth).not.toHaveBeenCalled();
  });

  describe.each(['click', 'woodblock', 'beep', 'cowbell'] as MetronomeVoiceId[])(
    'REQ-013-005: accent vs. non-accent audible difference for %s',
    (id) => {
      function getUnderlyingSynth(ctor: 'Synth' | 'MembraneSynth' | 'MetalSynth'): {
        triggerAttackRelease: Mock;
      } {
        const mockCtor = Tone[ctor] as unknown as Mock;
        return mockCtor.mock.results[0]?.value as { triggerAttackRelease: Mock };
      }

      function ctorForVoice(voiceId: MetronomeVoiceId): 'Synth' | 'MembraneSynth' | 'MetalSynth' {
        if (voiceId === 'woodblock') return 'MembraneSynth';
        if (voiceId === 'cowbell') return 'MetalSynth';
        return 'Synth';
      }

      it('plays a different pitch (or velocity) with accent=true than with accent=false', () => {
        const voice = createMetronomeVoice(id);
        const synth = getUnderlyingSynth(ctorForVoice(id));

        voice.trigger(0, true, 1.0);
        const accentCall = synth.triggerAttackRelease.mock.calls[0];

        voice.trigger(1, false, 0.6);
        const normalCall = synth.triggerAttackRelease.mock.calls[1];

        // note (arg 0) or velocity (arg 3) must differ between accent and non-accent.
        const differsInPitch = accentCall[0] !== normalCall[0];
        const differsInVelocity = accentCall[3] !== normalCall[3];
        expect(differsInPitch || differsInVelocity).toBe(true);
        // REQ-013-005 requires both a pitch difference AND the caller-supplied velocity
        // to be forwarded as-is (Metronome already differentiates velocity by accent).
        expect(accentCall[3]).toBe(1.0);
        expect(normalCall[3]).toBe(0.6);
      });

      it('forwards the given time to the underlying synth', () => {
        const voice = createMetronomeVoice(id);
        const synth = getUnderlyingSynth(ctorForVoice(id));

        voice.trigger(1.25, true, 1.0);

        expect(synth.triggerAttackRelease.mock.calls[0][2]).toBe(1.25);
      });

      it('dispose() disposes the underlying synth', () => {
        const voice = createMetronomeVoice(id);
        const synth = getUnderlyingSynth(ctorForVoice(id));

        voice.dispose();

        expect(synth.dispose).toHaveBeenCalled();
      });
    }
  );

  it('click keeps the current C6 (accent) / C5 (non-accent) pitch convention (backward compatible)', () => {
    const voice = createMetronomeVoice('click');
    const synth = (Tone.Synth as unknown as Mock).mock.results[0]?.value as {
      triggerAttackRelease: Mock;
    };

    voice.trigger(0, true, 1.0);
    expect(synth.triggerAttackRelease).toHaveBeenCalledWith('C6', '32n', 0, 1.0);

    voice.trigger(1, false, 0.6);
    expect(synth.triggerAttackRelease).toHaveBeenCalledWith('C5', '32n', 1, 0.6);
  });
});
