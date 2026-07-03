import { describe, it, expect } from 'vitest';
import type { Note } from '../../types';
import type { HandSettings } from './types';
import { spanCost, weakFingerCost, thumbOnBlackCost } from './cost-functions';

const makeNote = (id: string, midiNumber: number): Note => ({
  id,
  partId: 'P1',
  measureNumber: 1,
  noteIndex: 0,
  pitch: { step: 'C', octave: 4 },
  midiNumber,
  duration: 1,
  isChord: false,
  isRest: false,
});

const DEFAULT_SETTINGS: HandSettings = { maxSpanSemitones: 14, scaleFactorLeft: 1.0 };

describe('cost-functions', () => {
  it('C4(midiNumber=60)からD4(62)へ指1→2のspanCostが0（差=2、comfortable=2なので超過なし）', () => {
    const n1 = makeNote('n1', 60);
    const n2 = makeNote('n2', 62);
    expect(spanCost(1, 2, n1, n2, 'right', DEFAULT_SETTINGS)).toBe(0);
  });

  it('A4(69)まで指1→5のspanCostが 2（comfortable超過分）', () => {
    const n1 = makeNote('n1', 60);
    const n2 = makeNote('n2', 69); // C4 to A4 is 9 semitones
    expect(spanCost(1, 5, n1, n2, 'right', DEFAULT_SETTINGS)).toBe(2);
  });

  it('C4(60)からB4(71)へ指1→5のspanCostが>0（差=11、comfortable=7、spanCost=11-7=4）', () => {
    const n1 = makeNote('n1', 60);
    const n2 = makeNote('n2', 71); // C4 to B4 is 11 semitones
    expect(spanCost(1, 5, n1, n2, 'right', DEFAULT_SETTINGS)).toBe(4);
  });

  it('薬指(4)使用でweakFingerCostが2になる', () => {
    expect(weakFingerCost(4)).toBe(2);
    expect(weakFingerCost(1)).toBe(0);
  });

  it('C#4(midiNumber=61)に親指(1)を使うとthumbOnBlackCostが4になる（61%12=1 は黒鍵）', () => {
    const n1 = makeNote('n1', 61);
    expect(thumbOnBlackCost(1, n1)).toBe(4);
    expect(thumbOnBlackCost(2, n1)).toBe(0);
  });
});
