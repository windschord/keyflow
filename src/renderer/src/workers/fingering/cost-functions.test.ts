import { describe, it, expect } from 'vitest';
import type { Note } from '../../types';
import type { HandSettings } from './types';
import {
  spanCost,
  weakFingerCost,
  thumbOnBlackCost,
  thumbPassingCost,
  fiveOnBlackCost,
} from './cost-functions';

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

  // REQ-009-A03: エンジンは親指くぐりと指越えの遷移コストを評価しなければならない。
  // 出典: docs/sdd/design/components/fingering-engine.md のコスト項目
  // 'THUMB_PASSING'（親指くぐり・指越えのコスト）。上行時の親指→人差し指/中指
  // （くぐり）と下行時の人差し指/中指→親指（指越え）にコストが発生することを
  // 要件の記述どおりに検証する（非発生時はコスト0であること、方向・指の組み合わせが
  // 一致しない場合はコストが評価されないことも合わせて確認する）。
  describe('thumbPassingCost (REQ-009-A03)', () => {
    it('上行時に親指(1)から人差し指(2)へ渡る「親指くぐり」でコストが発生する', () => {
      const n1 = makeNote('n1', 60);
      const n2 = makeNote('n2', 62); // 上行（差=2）
      expect(thumbPassingCost(1, 2, n1, n2)).toBeGreaterThan(0);
    });

    it('上行時に親指(1)から中指(3)へ渡る「親指くぐり」でもコストが発生する', () => {
      const n1 = makeNote('n1', 60);
      const n2 = makeNote('n2', 64); // 上行（差=4）
      expect(thumbPassingCost(1, 3, n1, n2)).toBeGreaterThan(0);
    });

    it('下行時に人差し指(2)から親指(1)へ渡る「指越え」でコストが発生する', () => {
      const n1 = makeNote('n1', 62);
      const n2 = makeNote('n2', 60); // 下行（差=-2）
      expect(thumbPassingCost(2, 1, n1, n2)).toBeGreaterThan(0);
    });

    it('下行時に中指(3)から親指(1)へ渡る「指越え」でもコストが発生する', () => {
      const n1 = makeNote('n1', 64);
      const n2 = makeNote('n2', 60); // 下行（差=-4）
      expect(thumbPassingCost(3, 1, n1, n2)).toBeGreaterThan(0);
    });

    it('上行時でも親指くぐりに該当しない指の組み合わせ（1→4）はコスト0', () => {
      const n1 = makeNote('n1', 60);
      const n2 = makeNote('n2', 62);
      expect(thumbPassingCost(1, 4, n1, n2)).toBe(0);
    });

    it('下行時でも指越えに該当しない指の組み合わせ（4→1）はコスト0', () => {
      const n1 = makeNote('n1', 62);
      const n2 = makeNote('n2', 60);
      expect(thumbPassingCost(4, 1, n1, n2)).toBe(0);
    });

    it('同音（差=0、上行でも下行でもない）はコスト0', () => {
      const n1 = makeNote('n1', 60);
      const n2 = makeNote('n2', 60);
      expect(thumbPassingCost(1, 2, n1, n2)).toBe(0);
      expect(thumbPassingCost(2, 1, n1, n2)).toBe(0);
    });
  });

  // REQ-009-A04: エンジンは黒鍵への4・5指の使用を避けるよう重み付けしなければならない。
  // 出典: docs/sdd/design/components/fingering-engine.md のコスト項目
  // 'FIVE_ON_BLACK'（黒鍵に小指を置くペナルティ）。fiveOnBlackCostは小指(5)が黒鍵に
  // 乗るケースにペナルティを課すことを検証する（白鍵に乗る場合・小指以外の指の場合は
  // コスト0であること）。
  describe('fiveOnBlackCost (REQ-009-A04)', () => {
    it('小指(5)がC#4(61、黒鍵)に乗るとコストが発生する', () => {
      const n1 = makeNote('n1', 61);
      expect(fiveOnBlackCost(5, n1)).toBeGreaterThan(0);
    });

    it('小指(5)がC4(60、白鍵)に乗る場合はコスト0', () => {
      const n1 = makeNote('n1', 60);
      expect(fiveOnBlackCost(5, n1)).toBe(0);
    });

    it('黒鍵(61)でも小指以外の指（例: 親指1）はコスト0', () => {
      const n1 = makeNote('n1', 61);
      expect(fiveOnBlackCost(1, n1)).toBe(0);
    });
  });
});
