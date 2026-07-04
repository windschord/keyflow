import { describe, it, expect } from 'vitest';
import { computeFingering } from '../../workers/fingering/dp-solver';
import type { HandSettings } from '../../workers/fingering/types';
import type { Note } from '../../types';

const DEFAULT_SETTINGS: HandSettings = {
  maxSpanSemitones: 14,
  scaleFactorLeft: 1.0,
};

const C_MAJOR_SCALE_MIDI = [60, 62, 64, 65, 67, 69, 71, 72];

function generate800Notes(): Note[] {
  const notes: Note[] = [];
  for (let i = 0; i < 800; i++) {
    const scaleIndex = i % C_MAJOR_SCALE_MIDI.length;
    const octaveShift = Math.floor(i / C_MAJOR_SCALE_MIDI.length) % 3;
    const midiNumber = C_MAJOR_SCALE_MIDI[scaleIndex] + octaveShift * 12;
    notes.push({
      id: `P1-M${Math.floor(i / 4) + 1}-N${i % 4}`,
      partId: 'P1',
      measureNumber: Math.floor(i / 4) + 1,
      noteIndex: i,
      pitch: { step: 'C', octave: 4 + octaveShift },
      midiNumber: Math.min(midiNumber, 108),
      duration: 4,
      startTick: i * 1920,
      durationTicks: 1920,
      startSeconds: i * 4,
      durationSeconds: 4,
      voice: 1,
      isChord: false,
      isRest: false,
    });
  }
  return notes;
}

describe('運指計算パフォーマンステスト', () => {
  it('800音符の運指計算が2秒以内に完了する', () => {
    const notes = generate800Notes();
    const start = performance.now();
    const result = computeFingering(notes, 'right', DEFAULT_SETTINGS);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(2_000);
    expect(result.assignments).toHaveLength(800);
    expect(result.totalCost).toBeGreaterThanOrEqual(0);
  }, 5_000);

  it('空の音符列は空の運指結果を返す', () => {
    const result = computeFingering([], 'right', DEFAULT_SETTINGS);
    expect(result.assignments).toHaveLength(0);
    expect(result.totalCost).toBe(0);
  });

  it('単音の運指計算が即座に完了する', () => {
    const note: Note = {
      id: 'P1-M1-N0',
      partId: 'P1',
      measureNumber: 1,
      noteIndex: 0,
      pitch: { step: 'C', octave: 4 },
      midiNumber: 60,
      duration: 4,
      startTick: 0,
      durationTicks: 1920,
      startSeconds: 0,
      durationSeconds: 4,
      voice: 1,
      isChord: false,
      isRest: false,
    };
    const result = computeFingering([note], 'right', DEFAULT_SETTINGS);
    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0].finger).toBeGreaterThanOrEqual(1);
    expect(result.assignments[0].finger).toBeLessThanOrEqual(5);
  });
});
