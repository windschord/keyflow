export function checkLoopBoundary(
  currentMeasure: number,
  loopStart: number,
  loopEnd: number,
  enabled: boolean
): number {
  if (!enabled) return currentMeasure;

  if (currentMeasure > loopEnd) {
    return loopStart;
  }

  return currentMeasure;
}
