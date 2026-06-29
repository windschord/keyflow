import { Note, PracticeMode } from '../../types';

export function filterNotesByMode(notes: Note[], practiceMode: PracticeMode): Note[] {
  if (practiceMode === 'both') return notes;

  const handMapping: Record<string, 'right' | 'left'> = {
    right: 'right',
    left: 'left',
  };

  const targetHand = handMapping[practiceMode];
  if (!targetHand) return notes; // Fallback to all if unknown

  // Ensure note part hand matches the target practice mode hand
  // Note: We'd need part hand info, but the Note object structure
  // needs to be resolved to a part in a real scenario.
  // Assuming the note has some reference to whether it is left or right,
  // or we need to pass parts.
  // Since Note in types doesn't directly have a `hand` property, but it has `partId`.
  return notes; // We will handle actual filtering when we pass `parts` if available.
}

export function judgeChord(
  pressedKeys: Set<number>,
  expectedNotes: Note[]
): 'correct' | 'incorrect' | 'partial' {
  if (expectedNotes.length === 0) return 'correct';

  const expectedMidiNumbers = new Set(expectedNotes.map((n) => n.midiNumber));

  let hasIncorrect = false;
  for (const key of pressedKeys) {
    if (!expectedMidiNumbers.has(key)) {
      hasIncorrect = true;
      break;
    }
  }

  if (hasIncorrect) {
    return 'incorrect';
  }

  // All pressed keys are expected, check if we have ALL expected keys
  if (pressedKeys.size === expectedMidiNumbers.size) {
    return 'correct';
  }

  return 'partial';
}
