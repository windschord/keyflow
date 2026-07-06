import { describe, it, expect } from 'vitest';
import {
  MIDI_MIN,
  MIDI_MAX,
  WHITE_KEY_WIDTH,
  KEYBOARD_PRESETS,
  countWhiteKeys,
  getNotePosition,
} from './key-layout';

// TASK-056: 画面下キーボードの鍵盤数指定。
// プリセット範囲は一般的な電子キーボード/ポータブルキーボード製品を参考に
// 採用した値であり、実機の鍵盤範囲がこれと異なる場合は KEYBOARD_PRESETS の
// 値を調整することで対応できる（key-layout.ts のコメント参照）。
describe('KEYBOARD_PRESETS（TASK-056）', () => {
  it('88鍵はA0(21)〜C8(108)である（既定・後方互換）', () => {
    expect(KEYBOARD_PRESETS[88]).toEqual({ midiMin: 21, midiMax: 108 });
    expect(KEYBOARD_PRESETS[88].midiMin).toBe(MIDI_MIN);
    expect(KEYBOARD_PRESETS[88].midiMax).toBe(MIDI_MAX);
  });

  it('76鍵はE1(28)〜G7(103)である', () => {
    expect(KEYBOARD_PRESETS[76]).toEqual({ midiMin: 28, midiMax: 103 });
  });

  it('61鍵はC2(36)〜C7(96)である', () => {
    expect(KEYBOARD_PRESETS[61]).toEqual({ midiMin: 36, midiMax: 96 });
  });

  it('49鍵はC2(36)〜C6(84)である', () => {
    expect(KEYBOARD_PRESETS[49]).toEqual({ midiMin: 36, midiMax: 84 });
  });
});

describe('countWhiteKeys（TASK-056）', () => {
  it('88鍵プリセットの白鍵数は52である', () => {
    const { midiMin, midiMax } = KEYBOARD_PRESETS[88];
    expect(countWhiteKeys(midiMin, midiMax)).toBe(52);
  });

  it('76鍵プリセットの白鍵数は45である', () => {
    const { midiMin, midiMax } = KEYBOARD_PRESETS[76];
    expect(countWhiteKeys(midiMin, midiMax)).toBe(45);
  });

  it('61鍵プリセットの白鍵数は36である', () => {
    const { midiMin, midiMax } = KEYBOARD_PRESETS[61];
    expect(countWhiteKeys(midiMin, midiMax)).toBe(36);
  });

  it('49鍵プリセットの白鍵数は29である', () => {
    const { midiMin, midiMax } = KEYBOARD_PRESETS[49];
    expect(countWhiteKeys(midiMin, midiMax)).toBe(29);
  });
});

describe('getNotePosition の範囲引数化（TASK-056、既定は88鍵で後方互換）', () => {
  it('引数省略時は88鍵の範囲でMIDI_MIN未満/MIDI_MAX超をエラーにする（既存動作の後方互換）', () => {
    expect(() => getNotePosition(MIDI_MIN - 1)).toThrow();
    expect(() => getNotePosition(MIDI_MAX + 1)).toThrow();
    expect(() => getNotePosition(MIDI_MIN)).not.toThrow();
    expect(() => getNotePosition(MIDI_MAX)).not.toThrow();
  });

  it('61鍵プリセットの範囲外（MIDI 35, 97）はエラーになる', () => {
    const { midiMin, midiMax } = KEYBOARD_PRESETS[61];
    expect(() => getNotePosition(35, midiMin, midiMax)).toThrow();
    expect(() => getNotePosition(97, midiMin, midiMax)).toThrow();
  });

  it('61鍵プリセットの範囲境界（MIDI 36, 96）はエラーにならない', () => {
    const { midiMin, midiMax } = KEYBOARD_PRESETS[61];
    expect(() => getNotePosition(36, midiMin, midiMax)).not.toThrow();
    expect(() => getNotePosition(96, midiMin, midiMax)).not.toThrow();
  });

  it('61鍵プリセットの先頭鍵（C2=36）はx=0に配置される', () => {
    const { midiMin, midiMax } = KEYBOARD_PRESETS[61];
    const pos = getNotePosition(36, midiMin, midiMax);
    expect(pos.x).toBe(0);
  });

  it('49鍵プリセットの先頭鍵（C2=36）はx=0に配置される（61鍵とはmidiMinが同じだが独立して計算される）', () => {
    const { midiMin, midiMax } = KEYBOARD_PRESETS[49];
    const pos = getNotePosition(36, midiMin, midiMax);
    expect(pos.x).toBe(0);
  });

  it('76鍵プリセットの最後の白鍵（G7=103）は末尾に配置される（白鍵45個の右端）', () => {
    const { midiMin, midiMax } = KEYBOARD_PRESETS[76];
    const pos = getNotePosition(103, midiMin, midiMax);
    expect(pos.isBlack).toBe(false);
    expect(pos.x).toBe(44 * WHITE_KEY_WIDTH);
  });

  it('88鍵プリセットで計算した座標は引数省略時と一致する（後方互換の確認）', () => {
    const withArgs = getNotePosition(60, MIDI_MIN, MIDI_MAX);
    const withoutArgs = getNotePosition(60);
    expect(withArgs).toEqual(withoutArgs);
  });
});
