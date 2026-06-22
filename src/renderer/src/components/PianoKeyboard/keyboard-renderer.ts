import { PracticeMode, Note, Annotation } from '../../types';
import { getNotePosition, KEY_COLORS, MIDI_MIN, MIDI_MAX } from './key-layout';

interface RenderOptions {
  ctx: CanvasRenderingContext2D;
  expectedNotes: Note[];
  pressedKeys: Set<number>;
  incorrectKeys: Set<number>;
  annotations: Annotation[];
  practiceMode: PracticeMode;
}

export function renderKeyboard({
  ctx,
  expectedNotes,
  pressedKeys,
  incorrectKeys,
  annotations,
  practiceMode,
}: RenderOptions) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  const whiteKeys: number[] = [];
  const blackKeys: number[] = [];

  for (let midi = MIDI_MIN; midi <= MIDI_MAX; midi++) {
    const pos = getNotePosition(midi);
    if (pos.isBlack) {
      blackKeys.push(midi);
    } else {
      whiteKeys.push(midi);
    }
  }

  const drawKey = (midiNumber: number, isBlack: boolean) => {
    const pos = getNotePosition(midiNumber);
    const expectedNote = expectedNotes.find((n) => n.midiNumber === midiNumber);
    const isPressed = pressedKeys.has(midiNumber);
    const isIncorrect = incorrectKeys.has(midiNumber);

    let fillColor = isBlack ? KEY_COLORS.black.normal : KEY_COLORS.white.normal;

    if (isIncorrect) {
      fillColor = isBlack ? KEY_COLORS.black.incorrect : KEY_COLORS.white.incorrect;
    } else if (isPressed) {
      fillColor = isBlack ? KEY_COLORS.black.correct : KEY_COLORS.white.correct;
    } else if (expectedNote) {
      // Dummy implementation for hand based guid color
      const isRightHand = true;
      fillColor = isBlack
        ? isRightHand
          ? KEY_COLORS.black.guidRight
          : KEY_COLORS.black.guidLeft
        : isRightHand
          ? KEY_COLORS.white.guidRight
          : KEY_COLORS.white.guidLeft;
    }

    ctx.fillStyle = fillColor;
    ctx.fillRect(pos.x, pos.y, pos.width, pos.height);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(pos.x, pos.y, pos.width, pos.height);
  };

  // Draw white keys first
  whiteKeys.forEach((midi) => drawKey(midi, false));

  // Draw black keys on top
  blackKeys.forEach((midi) => drawKey(midi, true));
}
