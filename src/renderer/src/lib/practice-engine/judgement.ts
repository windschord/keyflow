import { Note, Part, PracticeMode } from '../../types';

export function filterNotesByMode(
  notes: Note[],
  practiceMode: PracticeMode,
  parts: Part[] = []
): Note[] {
  if (practiceMode === 'both') return notes;

  const targetHand = practiceMode === 'right' || practiceMode === 'left' ? practiceMode : null;
  if (!targetHand || parts.length === 0) return notes; // Fallback to all if unknown.

  const targetPartIds = new Set(
    parts.filter((part) => part.hand === targetHand).map((part) => part.id)
  );
  return notes.filter((note) => targetPartIds.has(note.partId));
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
