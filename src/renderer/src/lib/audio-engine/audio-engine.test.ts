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

  const createSynthInstanceMock = () => ({
    triggerAttackRelease: vi.fn(),
    dispose: vi.fn(),
    toDestination: vi.fn().mockReturnThis(),
  });

  const createPartInstanceMock = () => ({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn(),
    dispose: vi.fn(),
  });

  const createSequenceInstanceMock = () => ({
    start: vi.fn(),
    stop: vi.fn(),
    dispose: vi.fn(),
  });

  return {
    getTransport: vi.fn(() => transportMock),
    Synth: vi.fn(() => createSynthInstanceMock()),
    PolySynth: vi.fn(() => createSynthInstanceMock()),
    MembraneSynth: vi.fn(() => createSynthInstanceMock()),
    Part: vi.fn(() => createPartInstanceMock()),
    Sequence: vi.fn(() => createSequenceInstanceMock()),
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

  it('should enable and disable metronome', async () => {
    await service.setMetronomeEnabled(true);
    const mockSequenceInstance = vi.mocked(Tone.Sequence).mock.results[0].value;
    expect(mockSequenceInstance.start).toHaveBeenCalled();
    await service.setMetronomeEnabled(false);
    expect(mockSequenceInstance.stop).toHaveBeenCalled();
  });

  it('should play C4 when playNote(60) is called', async () => {
    await service.playNote(60);
    expect(Tone.Frequency).toHaveBeenCalledWith(60, 'midi');
    // It should trigger attack release on the internal synth
    const mockPolySynthInstance = vi.mocked(Tone.PolySynth).mock.results[0].value;
    expect(mockPolySynthInstance.triggerAttackRelease).toHaveBeenCalledWith('C4', '8n');
  });

  it('should release resources when dispose is called', () => {
    service.dispose();
    const transport = Tone.getTransport();
    expect(transport.stop).toHaveBeenCalled();
    expect(transport.cancel).toHaveBeenCalled();

    // Check if dispose is called on synths
    const mockPolySynthInstance = vi.mocked(Tone.PolySynth).mock.results[0].value;
    expect(mockPolySynthInstance.dispose).toHaveBeenCalled();

    const mockCorrectSynthInstance = vi.mocked(Tone.Synth).mock.results[0].value;
    expect(mockCorrectSynthInstance.dispose).toHaveBeenCalled();
  });

  it('should play correct and incorrect sounds', async () => {
    await service.playCorrectSound();
    const mockCorrectSynthInstance = vi.mocked(Tone.Synth).mock.results[0].value;
    expect(mockCorrectSynthInstance.triggerAttackRelease).toHaveBeenCalledWith('C5', '8n');

    await service.playIncorrectSound();
    const mockIncorrectSynthInstance = vi.mocked(Tone.Synth).mock.results[1].value;
    expect(mockIncorrectSynthInstance.triggerAttackRelease).toHaveBeenCalledWith('G#3', '8n');
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
