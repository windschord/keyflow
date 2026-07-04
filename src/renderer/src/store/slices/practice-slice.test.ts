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
