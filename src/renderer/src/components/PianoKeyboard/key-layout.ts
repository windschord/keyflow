import { KeyboardSize } from '../../types';

export const WHITE_KEY_WIDTH = 24;
export const WHITE_KEY_HEIGHT = 120;
export const BLACK_KEY_WIDTH = 14;
export const BLACK_KEY_HEIGHT = 75;
// 既定（88鍵）の表示範囲。過去バージョンとの後方互換のため、getNotePosition等の
// 範囲引数の既定値として残す（TASK-056でプリセット引数化する以前の唯一の値だった）。
export const MIDI_MIN = 21; // A0
export const MIDI_MAX = 108; // C8

export interface KeyboardRange {
  midiMin: number;
  midiMax: number;
}

/**
 * 画面下鍵盤の鍵盤数プリセット（TASK-056、2026-07-06 ユーザー要望）。
 * 一般的な電子キーボード/ポータブルキーボード製品でよく採用されている鍵盤範囲を
 * 参考に採用した値である。
 * - 88鍵: A0(21)〜C8(108)（フルサイズピアノ）
 * - 76鍵: E1(28)〜G7(103)
 * - 61鍵: C2(36)〜C7(96)
 * - 49鍵: C2(36)〜C6(84)
 * メーカー・モデルによっては同じ鍵盤数でも実際の音域が微妙に異なる製品がある
 * （例: 61鍵でもC1〜C6を採用する機種等）。ユーザーの手元の機種と一致しない場合は、
 * このテーブルの値を実機に合わせて調整すればよい。
 */
export const KEYBOARD_PRESETS: Record<KeyboardSize, KeyboardRange> = {
  88: { midiMin: MIDI_MIN, midiMax: MIDI_MAX },
  76: { midiMin: 28, midiMax: 103 },
  61: { midiMin: 36, midiMax: 96 },
  49: { midiMin: 36, midiMax: 84 },
};

export const KEY_COLORS = {
  white: {
    normal: '#FFFFFF',
    guidRight: '#5B9BD5',
    guidLeft: '#70AD47',
    correct: '#FFD966',
    incorrect: '#FF6B6B',
  },
  black: {
    normal: '#1A1A1A',
    guidRight: '#3A6A9E',
    guidLeft: '#4A7A30',
    correct: '#CCA028',
    incorrect: '#CC3333',
  },
};

const isBlackKey = (midiNumber: number): boolean => {
  const noteInOctave = midiNumber % 12;
  return [1, 3, 6, 8, 10].includes(noteInOctave);
};

/**
 * 指定範囲（プリセット、TASK-056）内の白鍵数を数える。PianoKeyboardのcanvas幅
 * （`totalWidth = countWhiteKeys(...) * WHITE_KEY_WIDTH`）の算出に使う。
 */
export function countWhiteKeys(midiMin: number, midiMax: number): number {
  let count = 0;
  for (let m = midiMin; m <= midiMax; m++) {
    if (!isBlackKey(m)) {
      count++;
    }
  }
  return count;
}

export function getNotePosition(
  midiNumber: number,
  midiMin: number = MIDI_MIN,
  midiMax: number = MIDI_MAX
): {
  x: number;
  y: number;
  width: number;
  height: number;
  isBlack: boolean;
} {
  if (midiNumber < midiMin || midiNumber > midiMax) {
    throw new Error(`MIDI number ${midiNumber} out of range`);
  }

  const isBlack = isBlackKey(midiNumber);

  // Calculate white key index from the range's lower bound (TASK-056: 既定は
  // MIDI_MIN=A0だが、鍵盤数プリセットごとの下限から数える)。
  let whiteKeyIndex = 0;
  for (let m = midiMin; m < midiNumber; m++) {
    if (!isBlackKey(m)) {
      whiteKeyIndex++;
    }
  }

  let x = whiteKeyIndex * WHITE_KEY_WIDTH;

  if (isBlack) {
    // Black keys are offset between white keys
    // Adjust slightly based on which black key it is
    const noteInOctave = midiNumber % 12;
    let offsetRatio = 0.5; // default center

    // C#, D#
    if (noteInOctave === 1) offsetRatio = 0.4;
    else if (noteInOctave === 3) offsetRatio = 0.6;
    // F#, G#, A#
    else if (noteInOctave === 6) offsetRatio = 0.3;
    else if (noteInOctave === 8) offsetRatio = 0.5;
    else if (noteInOctave === 10) offsetRatio = 0.7;

    x = whiteKeyIndex * WHITE_KEY_WIDTH - BLACK_KEY_WIDTH * offsetRatio;
  }

  return {
    x,
    y: 0,
    width: isBlack ? BLACK_KEY_WIDTH : WHITE_KEY_WIDTH,
    height: isBlack ? BLACK_KEY_HEIGHT : WHITE_KEY_HEIGHT,
    isBlack,
  };
}
