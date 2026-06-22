export const WHITE_KEY_WIDTH = 24;
export const WHITE_KEY_HEIGHT = 120;
export const BLACK_KEY_WIDTH = 14;
export const BLACK_KEY_HEIGHT = 75;
export const MIDI_MIN = 21;  // A0
export const MIDI_MAX = 108; // C8

export const KEY_COLORS = {
  white: {
    normal: '#FFFFFF',
    guidRight: '#5B9BD5',
    guidLeft: '#70AD47',
    correct: '#FFD966',
    incorrect: '#FF6B6B'
  },
  black: {
    normal: '#1A1A1A',
    guidRight: '#3A6A9E',
    guidLeft: '#4A7A30',
    correct: '#CCA028',
    incorrect: '#CC3333'
  },
};

const isBlackKey = (midiNumber: number): boolean => {
  const noteInOctave = midiNumber % 12;
  return [1, 3, 6, 8, 10].includes(noteInOctave);
};

export function getNotePosition(midiNumber: number): {
  x: number; y: number; width: number; height: number; isBlack: boolean;
} {
  if (midiNumber < MIDI_MIN || midiNumber > MIDI_MAX) {
    throw new Error(`MIDI number ${midiNumber} out of range`);
  }

  const isBlack = isBlackKey(midiNumber);

  // Calculate white key index from MIDI_MIN (A0)
  let whiteKeyIndex = 0;
  for (let m = MIDI_MIN; m < midiNumber; m++) {
    if (!isBlackKey(m)) {
      whiteKeyIndex++;
    }
  }

  let x = whiteKeyIndex * WHITE_KEY_WIDTH;

  if (isBlack) {
    // Black keys are offset between white keys
    // Adjust slightly based on which black key it is
    const noteInOctave = midiNumber % 12;
    let offsetRatio = 0.5; // default center

    // C#, D#
    if (noteInOctave === 1) offsetRatio = 0.4;
    else if (noteInOctave === 3) offsetRatio = 0.6;
    // F#, G#, A#
    else if (noteInOctave === 6) offsetRatio = 0.3;
    else if (noteInOctave === 8) offsetRatio = 0.5;
    else if (noteInOctave === 10) offsetRatio = 0.7;

    x = whiteKeyIndex * WHITE_KEY_WIDTH - (BLACK_KEY_WIDTH * offsetRatio);
  }

  return {
    x,
    y: 0,
    width: isBlack ? BLACK_KEY_WIDTH : WHITE_KEY_WIDTH,
    height: isBlack ? BLACK_KEY_HEIGHT : WHITE_KEY_HEIGHT,
    isBlack,
  };
}
