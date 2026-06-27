import { Note, Part, PracticeMode } from '../../types';

export function filterNotesByMode(
  notes: Note[],
  practiceMode: PracticeMode,
  parts: Part[]
): Note[] {
  if (practiceMode === 'both') return notes;

  const targetHand = practiceMode === 'right' ? 'right' : 'left';

  return notes.filter((note) => {
    const part = parts.find((p) => p.id === note.partId);
    return part && part.hand === targetHand;
  });
}

export function judgeChord(
  pressedKeys: Set<number>,
  expectedNotes: Note[]
): 'correct' | 'incorrect' | 'partial' {
  if (expectedNotes.length === 0) return 'incorrect';

  // Extract expected midi numbers
  const expectedMidis = new Set(expectedNotes.map((n) => n.midiNumber));

  let hasIncorrect = false;

  // Check all pressed keys
  pressedKeys.forEach((key) => {
    if (!expectedMidis.has(key)) {
      hasIncorrect = true;
    }
  });

  if (hasIncorrect) {
    return 'incorrect';
  }

  // Check if all expected keys are pressed
  let allExpectedPressed = true;
  expectedMidis.forEach((key) => {
    if (!pressedKeys.has(key)) {
      allExpectedPressed = false;
    }
  });

  if (allExpectedPressed) {
    return 'correct';
  }

  return 'partial';
}
