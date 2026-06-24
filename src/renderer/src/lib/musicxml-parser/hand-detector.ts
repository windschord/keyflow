export function detectHand(
  partName: string | undefined,
  clefSign: string | undefined,
  partIndex: number
): 'right' | 'left' {
  if (partName) {
    const lowerName = partName.toLowerCase();
    if (
      lowerName.includes('right') ||
      lowerName.includes('右') ||
      lowerName.includes('soprano') ||
      lowerName.includes('treble')
    ) {
      return 'right';
    }
    if (lowerName.includes('left') || lowerName.includes('左') || lowerName.includes('bass')) {
      return 'left';
    }
  }

  if (clefSign === 'G') {
    return 'right';
  }
  if (clefSign === 'F') {
    return 'left';
  }

  return partIndex === 0 ? 'right' : 'left';
}
