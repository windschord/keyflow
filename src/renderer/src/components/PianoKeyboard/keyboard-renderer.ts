import { PracticeMode, Note, Annotation, Part, Hand } from '../../types';
import { getNotePosition, KEY_COLORS, MIDI_MIN, MIDI_MAX } from './key-layout';

interface RenderOptions {
  ctx: CanvasRenderingContext2D;
  expectedNotes: Note[];
  pressedKeys: Set<number>;
  incorrectKeys: Set<number>;
  annotations: Annotation[];
  practiceMode: PracticeMode;
  /**
   * parser算出済みのScore.parts（Part.hand、REQ-001-003）。
   * expectedNote.partId → Part.hand を引いて右手/左手のガイド色（REQ-005-002）を
   * 決定するために使用する。partIdがpartsに存在しない場合は左手色にフォールバックする。
   * 未指定時は空配列扱い（全て左手色フォールバック）。
   */
  parts?: Part[];
}

export function renderKeyboard({
  ctx,
  expectedNotes,
  pressedKeys,
  incorrectKeys,
  annotations,
  parts = [],
}: RenderOptions) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  const handByPartId = new Map<string, Hand>(parts.map((part) => [part.id, part.hand]));

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
      // REQ-005-002: 右手=青系、左手=緑系。partIdの文字列ヒューリスティックではなく
      // parser算出済みのPart.handに基づいて判定する。片手練習モードでもexpectedNotes
      // 自体が対象パートにフィルタ済みのため、practiceModeによる強制はしない。
      // 手情報が引けないpartId（マップに未登録）は左手色にフォールバックする。
      const isRightHand = handByPartId.get(expectedNote.partId) === 'right';
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

    // 鍵盤上の指番号表示（REQ-005-007）。
    // 現在の判定グループ（expectedNotes）のノーツに指番号アノテーションが
    // ある場合のみ、該当する鍵の下部中央に描画する。
    if (expectedNote) {
      const annotation = annotations.find(
        (a) => a.noteId === expectedNote.id && a.fingerNumber !== undefined
      );
      if (annotation?.fingerNumber !== undefined) {
        ctx.font = `bold ${isBlack ? 11 : 13}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = isBlack ? '#FFFFFF' : '#1A1A1A';
        ctx.fillText(
          String(annotation.fingerNumber),
          pos.x + pos.width / 2,
          pos.y + pos.height - 6
        );
      }
    }
  };

  // Draw white keys first
  whiteKeys.forEach((midi) => drawKey(midi, false));

  // Draw black keys on top
  blackKeys.forEach((midi) => drawKey(midi, true));
}
