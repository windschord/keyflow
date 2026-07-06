import { PracticeMode, Note, Annotation } from '../../types';
import { getNotePosition, KEY_COLORS, MIDI_MIN, MIDI_MAX } from './key-layout';

interface RenderOptions {
  ctx: CanvasRenderingContext2D;
  expectedNotes: Note[];
  pressedKeys: Set<number>;
  incorrectKeys: Set<number>;
  annotations: Annotation[];
  practiceMode: PracticeMode;
  /**
   * 表示範囲（鍵盤数プリセット、TASK-056）。未指定時は既定の88鍵
   * （MIDI_MIN=21〜MIDI_MAX=108）で描画する（既存動作の後方互換）。
   */
  midiMin?: number;
  midiMax?: number;
}

// 範囲外ノーツのインジケータ（TASK-056）の見た目のパラメータ。
const OUT_OF_RANGE_INDICATOR_WIDTH = 20;
const OUT_OF_RANGE_INDICATOR_COLOR_NEAR = 'rgba(220, 38, 38, 0.6)';
const OUT_OF_RANGE_INDICATOR_COLOR_FAR = 'rgba(220, 38, 38, 0)';
const OUT_OF_RANGE_ARROW_COLOR = '#DC2626';

/**
 * ガイド対象ノーツ（expectedNotes）が現在の表示範囲（midiMin〜midiMax）より低い/
 * 高い場合、鍵盤の左/右端に端のグラデーション＋矢印のインジケータを描画する
 * （TASK-056）。表示だけの制約であり、practice-engineの判定ロジック
 * （expectedNotes自体・正誤判定）には一切影響しない。
 */
function drawOutOfRangeIndicators(
  ctx: CanvasRenderingContext2D,
  expectedNotes: Note[],
  midiMin: number,
  midiMax: number
): void {
  const hasBelowRange = expectedNotes.some((note) => note.midiNumber < midiMin);
  const hasAboveRange = expectedNotes.some((note) => note.midiNumber > midiMax);

  if (!hasBelowRange && !hasAboveRange) {
    return;
  }

  const canvasWidth = ctx.canvas.width;
  const canvasHeight = ctx.canvas.height;

  const drawEdge = (side: 'left' | 'right'): void => {
    const nearX = side === 'left' ? 0 : canvasWidth;
    const farX =
      side === 'left' ? OUT_OF_RANGE_INDICATOR_WIDTH : canvasWidth - OUT_OF_RANGE_INDICATOR_WIDTH;
    const rectX = side === 'left' ? 0 : canvasWidth - OUT_OF_RANGE_INDICATOR_WIDTH;

    const gradient = ctx.createLinearGradient(nearX, 0, farX, 0);
    gradient.addColorStop(0, OUT_OF_RANGE_INDICATOR_COLOR_NEAR);
    gradient.addColorStop(1, OUT_OF_RANGE_INDICATOR_COLOR_FAR);

    ctx.fillStyle = gradient;
    ctx.fillRect(rectX, 0, OUT_OF_RANGE_INDICATOR_WIDTH, canvasHeight);

    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = OUT_OF_RANGE_ARROW_COLOR;
    ctx.fillText(
      side === 'left' ? '◀' : '▶',
      rectX + OUT_OF_RANGE_INDICATOR_WIDTH / 2,
      canvasHeight / 2
    );
  };

  if (hasBelowRange) {
    drawEdge('left');
  }
  if (hasAboveRange) {
    drawEdge('right');
  }
}

export function renderKeyboard({
  ctx,
  expectedNotes,
  pressedKeys,
  incorrectKeys,
  annotations,
  midiMin = MIDI_MIN,
  midiMax = MIDI_MAX,
}: RenderOptions) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  const whiteKeys: number[] = [];
  const blackKeys: number[] = [];

  for (let midi = midiMin; midi <= midiMax; midi++) {
    const pos = getNotePosition(midi, midiMin, midiMax);
    if (pos.isBlack) {
      blackKeys.push(midi);
    } else {
      whiteKeys.push(midi);
    }
  }

  const drawKey = (midiNumber: number, isBlack: boolean) => {
    const pos = getNotePosition(midiNumber, midiMin, midiMax);
    const expectedNote = expectedNotes.find((n) => n.midiNumber === midiNumber);
    const isPressed = pressedKeys.has(midiNumber);
    const isIncorrect = incorrectKeys.has(midiNumber);

    let fillColor = isBlack ? KEY_COLORS.black.normal : KEY_COLORS.white.normal;

    if (isIncorrect) {
      fillColor = isBlack ? KEY_COLORS.black.incorrect : KEY_COLORS.white.incorrect;
    } else if (isPressed) {
      fillColor = isBlack ? KEY_COLORS.black.correct : KEY_COLORS.white.correct;
    } else if (expectedNote) {
      // REQ-005-002: 右手=青系、左手=緑系。パート単位のPart.handではなく、
      // parser算出済みのNote.hand（TASK-048）に基づいて判定する。1パート2段譜でも
      // 段（手）ごとに正しく色分けできる。片手練習モードでもexpectedNotes
      // 自体が対象パートにフィルタ済みのため、practiceModeによる強制はしない。
      // hand未指定のノートは左手色にフォールバックする。
      const isRightHand = expectedNote.hand === 'right';
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

  // TASK-056: 表示範囲外のガイド対象ノーツがあれば端にインジケータを描画する。
  drawOutOfRangeIndicators(ctx, expectedNotes, midiMin, midiMax);
}
