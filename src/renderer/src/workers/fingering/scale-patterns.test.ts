import { describe, it, expect } from 'vitest';
import type { Note } from '../../types';
import { detectScalePattern, applyScalePattern } from './scale-patterns';

const makeNote = (id: string, midiNumber: number): Note => ({
  id,
  partId: 'P1',
  measureNumber: 1,
  noteIndex: 0,
  pitch: { step: 'C', octave: 4 },
  midiNumber,
  duration: 1,
  startTick: 0,
  durationTicks: 480,
  startSeconds: 0,
  durationSeconds: 0.5,
  voice: 1,
  isChord: false,
  isRest: false,
});

describe('scale-patterns', () => {
  it('Cメジャースケール上昇の音符列にパターンが検出される', () => {
    const cMajor = [60, 62, 64, 65, 67, 69, 71, 72].map((m, i) => makeNote(`n${i}`, m));
    expect(detectScalePattern(cMajor)?.key).toBe('C_MAJOR');
  });

  it('パターン検出後の右手運指が [1,2,3,1,2,3,4,5]', () => {
    const cMajor = [60, 62, 64, 65, 67, 69, 71, 72].map((m, i) => makeNote(`n${i}`, m));
    const assignments = applyScalePattern(cMajor, 'right');
    expect(assignments).not.toBeNull();
    const fingers = assignments!.map((a) => a.finger);
    expect(fingers).toEqual([1, 2, 3, 1, 2, 3, 4, 5]);
  });

  it('オクターブが違っても同じパターンが検出される（C3→C4）', () => {
    const cMajorC3 = [48, 50, 52, 53, 55, 57, 59, 60].map((m, i) => makeNote(`n${i}`, m));
    expect(detectScalePattern(cMajorC3)?.key).toBe('C_MAJOR');
  });

  it('非スケール音符列にはnullを返す', () => {
    // 8 notes but not a scale (e.g., C Major but with an unexpected note)
    const notScale = [60, 61, 63, 65, 67, 69, 71, 72].map((m, i) => makeNote(`n${i}`, m));
    expect(detectScalePattern(notScale)).toBeNull();
  });
});
