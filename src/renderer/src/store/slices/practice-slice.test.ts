import { describe, it, expect, vi } from 'vitest';
import { createPracticeSlice } from './practice-slice';

describe('createPracticeSlice initial state', () => {
  it('provides loopStart/loopEnd defaults that satisfy the start < end validation used by LoopControl', () => {
    const set = vi.fn();
    const get = vi.fn();
    // sliceは第3引数（StoreApi）を使用しないため空オブジェクトで足りる（`any`禁止ルールに従う）
    const api = {} as Parameters<typeof createPracticeSlice>[2];
    const slice = createPracticeSlice(set, get, api);

    expect(slice.loopStart).toBeLessThan(slice.loopEnd);
  });
});

describe('createPracticeSlice statsの初期値汚染防止（CodeRabbit指摘: モジュール定数initialStatsの直接参照回帰）', () => {
  it('スライスを複数回生成しても、あるインスタンスのstatsを書き換えた影響が次のインスタンスに残らない', () => {
    const set1 = vi.fn();
    const get1 = vi.fn();
    // sliceは第3引数（StoreApi）を使用しないため空オブジェクトで足りる（`any`禁止ルールに従う）
    const api1 = {} as Parameters<typeof createPracticeSlice>[2];
    const slice1 = createPracticeSlice(set1, get1, api1);

    // practice-engineのhandleNoteOnが行うような、stats内部フィールドへの直接変更を模倣する。
    // stats: initialStats のように初期値がモジュール定数への直接参照のままだと、
    // このミューテーションが定数自体を汚染し、以降に生成される全スライスへ波及する。
    slice1.stats.correctNotes = 999;
    slice1.stats.totalNotes = 999;
    slice1.stats.accuracy = 1;

    const set2 = vi.fn();
    const get2 = vi.fn();
    const api2 = {} as Parameters<typeof createPracticeSlice>[2];
    const slice2 = createPracticeSlice(set2, get2, api2);

    expect(slice2.stats.correctNotes).toBe(0);
    expect(slice2.stats.totalNotes).toBe(0);
    expect(slice2.stats.accuracy).toBe(0);
  });
});

describe('createPracticeSlice setErrorMode', () => {
  it('updates errorMode in the store when called (TASK-040)', () => {
    let state: { errorMode: string } = { errorMode: 'wait' };
    const set = vi.fn((updater) => {
      const partial = typeof updater === 'function' ? updater(state) : updater;
      state = { ...state, ...partial };
    });
    const get = vi.fn(() => state);
    // sliceは第3引数（StoreApi）を使用しないため空オブジェクトで足りる（`any`禁止ルールに従う）
    const api = {} as Parameters<typeof createPracticeSlice>[2];
    const slice = createPracticeSlice(set, get, api);

    expect(slice.errorMode).toBe('wait');

    slice.setErrorMode('pass');

    expect(set).toHaveBeenCalledWith({ errorMode: 'pass' });
    expect(state.errorMode).toBe('pass');
  });
});
