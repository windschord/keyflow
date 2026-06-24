import { describe, it, expect } from 'vitest';
import { checkLoopBoundary } from './loop-manager';

describe('loop-manager', () => {
  it('returns loopStart when currentMeasure exceeds loopEnd and loop is enabled', () => {
    expect(checkLoopBoundary(3, 1, 2, true)).toBe(1);
  });

  it('returns currentMeasure when within bounds and loop is enabled', () => {
    expect(checkLoopBoundary(2, 1, 2, true)).toBe(2);
  });

  it('returns currentMeasure when loop is disabled even if exceeds loopEnd', () => {
    expect(checkLoopBoundary(3, 1, 2, false)).toBe(3);
  });
});
