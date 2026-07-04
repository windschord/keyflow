import { describe, it, expect, vi } from 'vitest';
import { createPracticeSlice } from './practice-slice';

describe('createPracticeSlice initial state', () => {
  it('provides loopStart/loopEnd defaults that satisfy the start < end validation used by LoopControl', () => {
    const set = vi.fn();
    const get = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = {} as any;
    const slice = createPracticeSlice(set, get, api);

    expect(slice.loopStart).toBeLessThan(slice.loopEnd);
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = {} as any;
    const slice = createPracticeSlice(set, get, api);

    expect(slice.errorMode).toBe('wait');

    slice.setErrorMode('pass');

    expect(set).toHaveBeenCalledWith({ errorMode: 'pass' });
    expect(state.errorMode).toBe('pass');
  });
});
