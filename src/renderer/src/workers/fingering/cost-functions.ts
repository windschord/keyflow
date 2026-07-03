import type { Finger } from '../../types';
import type { Note } from '../../types';
import { getSpan } from './span-table';
import type { FingeringHand, HandSettings } from './types';

// スパン超過ペナルティ
export function spanCost(
  f1: Finger,
  f2: Finger,
  n1: Note,
  n2: Note,
  hand: FingeringHand,
  settings: HandSettings
): number {
  if (f1 === f2) {
    if (n1.midiNumber === n2.midiNumber) return 0;
    return Infinity;
  }

  const span = Math.abs(n2.midiNumber - n1.midiNumber);
  const { comfortable, max } = getSpan(f1, f2, hand, settings);

  if (span <= comfortable) {
    return 0;
  } else if (span <= max) {
    return span - comfortable;
  } else {
    // 実際には comfortable超でペナルティあり。
    // 仕様確認: spanCost = (span - comfortable) + (span - max) * 10 とするが、
    // テストケースに合わせると、C4(60)からA4(69)は差9、1-5ペアのcomfortable=7, max=14で
    // spanCost=9-7=2（comfortable超過分）となる。なので以下の式とする。
    // = (span - comfortable) + (span > max ? (span - max) * 10 : 0)
    // テストのコメントにある通り
    return span - comfortable + (span - max) * 10;
  }
}

// 薬指(4)または小指(5): +2、それ以外: 0
export function weakFingerCost(f: Finger): number {
  return f === 4 || f === 5 ? 2 : 0;
}

const isBlackKey = (midiNumber: number): boolean => {
  const mod = midiNumber % 12;
  return mod === 1 || mod === 3 || mod === 6 || mod === 8 || mod === 10;
};

// 親指 かつ 黒鍵: +4
export function thumbOnBlackCost(f: Finger, note: Note): number {
  return f === 1 && isBlackKey(note.midiNumber) ? 4 : 0;
}

// 小指 かつ黒鍵: +3
export function fiveOnBlackCost(f: Finger, note: Note): number {
  return f === 5 && isBlackKey(note.midiNumber) ? 3 : 0;
}

// 親指くぐり（上行時 親指から人差し指または中指）または指越え（下行時 人差し指または中指から親指）: +1
export function thumbPassingCost(f1: Finger, f2: Finger, n1: Note, n2: Note): number {
  const diff = n2.midiNumber - n1.midiNumber;
  if (diff > 0) {
    // 上行時
    if (f1 === 1 && (f2 === 2 || f2 === 3)) return 1;
  } else if (diff < 0) {
    // 下行時
    if ((f1 === 2 || f1 === 3) && f2 === 1) return 1;
  }
  return 0;
}

// |n2.midiNumber - n1.midiNumber| > 12: +3
export function largeJumpCost(n1: Note, n2: Note): number {
  return Math.abs(n2.midiNumber - n1.midiNumber) > 12 ? 3 : 0;
}

// 上記すべての合計
export function totalTransitionCost(
  f1: Finger,
  f2: Finger,
  n1: Note,
  n2: Note,
  hand: FingeringHand,
  settings: HandSettings
): number {
  return (
    spanCost(f1, f2, n1, n2, hand, settings) +
    weakFingerCost(f2) + // 遷移先の指のコストのみ加算する
    thumbOnBlackCost(f2, n2) +
    fiveOnBlackCost(f2, n2) +
    thumbPassingCost(f1, f2, n1, n2) +
    largeJumpCost(n1, n2)
  );
}
