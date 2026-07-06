import { describe, it, expect, vi } from 'vitest';
import { renderKeyboard } from './keyboard-renderer';
import { KEYBOARD_PRESETS, getNotePosition, KEY_COLORS } from './key-layout';
import type { Note } from '../../types';

function createNote(midiNumber: number, id: string): Note {
  return {
    id,
    partId: 'P1',
    measureNumber: 1,
    noteIndex: 0,
    pitch: { step: 'C', octave: 4 },
    midiNumber,
    duration: 1,
    startTick: 0,
    durationTicks: 480,
    startSeconds: 0,
    durationSeconds: 0.5,
    voice: 1,
    isChord: false,
    isRest: false,
    staff: 1,
    hand: 'right',
  };
}

/**
 * fillRect呼び出し時点でのctx.fillStyleを記録するモックctx（PianoKeyboard.test.tsxの
 * createColorTrackingCtxと同型）。範囲外インジケータ（TASK-056）はcreateLinearGradient
 * を使うため、gradientオブジェクトのモックも用意する。
 */
function createMockCtx(canvasWidth = 864, canvasHeight = 150) {
  const gradient = { addColorStop: vi.fn() };
  const ctx = {
    canvas: { width: canvasWidth, height: canvasHeight },
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    createLinearGradient: vi.fn(() => gradient),
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
  } as unknown as CanvasRenderingContext2D & {
    fillText: ReturnType<typeof vi.fn>;
    fillRect: ReturnType<typeof vi.fn>;
    createLinearGradient: ReturnType<typeof vi.fn>;
  };
  return { ctx, gradient };
}

describe('renderKeyboard の範囲引数化（TASK-056、既定は88鍵で後方互換）', () => {
  it('midiMin/midiMax省略時は88鍵の範囲で描画される（既存動作の後方互換）', () => {
    const { ctx } = createMockCtx(1248);
    const note = createNote(60, 'P1-M1-N0');

    expect(() =>
      renderKeyboard({
        ctx,
        expectedNotes: [note],
        pressedKeys: new Set(),
        incorrectKeys: new Set(),
        annotations: [],
        practiceMode: 'both',
      })
    ).not.toThrow();
  });

  it('61鍵プリセット範囲で描画すると、範囲内のノーツは正しい座標に描画される（fillRectで範囲内キー数分呼ばれる）', () => {
    const { ctx } = createMockCtx(864);
    const { midiMin, midiMax } = KEYBOARD_PRESETS[61];
    const note = createNote(60, 'P1-M1-N0'); // C4、61鍵の範囲内(36-96)

    renderKeyboard({
      ctx,
      expectedNotes: [note],
      pressedKeys: new Set(),
      incorrectKeys: new Set(),
      annotations: [],
      practiceMode: 'both',
      midiMin,
      midiMax,
    });

    // 61鍵の範囲は61鍵分描画される（白鍵36+黒鍵25 = fillRect 61回、範囲外インジケータなし）
    expect(ctx.fillRect).toHaveBeenCalledTimes(61);
  });
});

describe('範囲外ノーツのインジケータ（TASK-056）', () => {
  it('expectedNotesが表示範囲より低い場合、鍵盤の左端にインジケータを描画する', () => {
    const { ctx, gradient } = createMockCtx(864);
    const { midiMin, midiMax } = KEYBOARD_PRESETS[61]; // 36-96
    const belowRangeNote = createNote(30, 'P1-M1-N0'); // 61鍵の範囲より低い

    renderKeyboard({
      ctx,
      expectedNotes: [belowRangeNote],
      pressedKeys: new Set(),
      incorrectKeys: new Set(),
      annotations: [],
      practiceMode: 'both',
      midiMin,
      midiMax,
    });

    expect(ctx.createLinearGradient).toHaveBeenCalledTimes(1);
    expect(gradient.addColorStop).toHaveBeenCalled();
    // 左端（x=0起点）に描画される
    const gradientArgs = ctx.createLinearGradient.mock.calls[0];
    expect(gradientArgs[0]).toBe(0);
    // 矢印（左方向）がfillTextで描画される
    expect(ctx.fillText).toHaveBeenCalledWith('◀', expect.any(Number), expect.any(Number));
  });

  it('expectedNotesが表示範囲より高い場合、鍵盤の右端にインジケータを描画する', () => {
    const { ctx, gradient } = createMockCtx(864);
    const { midiMin, midiMax } = KEYBOARD_PRESETS[61]; // 36-96
    const aboveRangeNote = createNote(100, 'P1-M1-N0'); // 61鍵の範囲より高い

    renderKeyboard({
      ctx,
      expectedNotes: [aboveRangeNote],
      pressedKeys: new Set(),
      incorrectKeys: new Set(),
      annotations: [],
      practiceMode: 'both',
      midiMin,
      midiMax,
    });

    expect(ctx.createLinearGradient).toHaveBeenCalledTimes(1);
    expect(gradient.addColorStop).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalledWith('▶', expect.any(Number), expect.any(Number));
  });

  it('範囲より低いノーツと高いノーツが両方ある場合、左右両方にインジケータを描画する', () => {
    const { ctx } = createMockCtx(864);
    const { midiMin, midiMax } = KEYBOARD_PRESETS[61];
    const belowRangeNote = createNote(30, 'P1-M1-N0');
    const aboveRangeNote = createNote(100, 'P1-M1-N1');

    renderKeyboard({
      ctx,
      expectedNotes: [belowRangeNote, aboveRangeNote],
      pressedKeys: new Set(),
      incorrectKeys: new Set(),
      annotations: [],
      practiceMode: 'both',
      midiMin,
      midiMax,
    });

    expect(ctx.createLinearGradient).toHaveBeenCalledTimes(2);
    expect(ctx.fillText).toHaveBeenCalledWith('◀', expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith('▶', expect.any(Number), expect.any(Number));
  });

  it('すべてのexpectedNotesが表示範囲内であれば、インジケータは描画されない', () => {
    const { ctx } = createMockCtx(864);
    const { midiMin, midiMax } = KEYBOARD_PRESETS[61];
    const inRangeNote = createNote(60, 'P1-M1-N0');

    renderKeyboard({
      ctx,
      expectedNotes: [inRangeNote],
      pressedKeys: new Set(),
      incorrectKeys: new Set(),
      annotations: [],
      practiceMode: 'both',
      midiMin,
      midiMax,
    });

    expect(ctx.createLinearGradient).not.toHaveBeenCalled();
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it('expectedNotesが空の場合はインジケータを描画しない', () => {
    const { ctx } = createMockCtx(864);
    const { midiMin, midiMax } = KEYBOARD_PRESETS[61];

    renderKeyboard({
      ctx,
      expectedNotes: [],
      pressedKeys: new Set(),
      incorrectKeys: new Set(),
      annotations: [],
      practiceMode: 'both',
      midiMin,
      midiMax,
    });

    expect(ctx.createLinearGradient).not.toHaveBeenCalled();
  });
});

/**
 * fillRect呼び出し時点でのctx.fillStyleを記録するモックctx
 * （PianoKeyboard.test.tsxのcreateColorTrackingCtxと同型）。
 */
function createColorTrackingCtx(
  canvasWidth = 864,
  canvasHeight = 150
): {
  ctx: CanvasRenderingContext2D;
  fillStyles: string[];
} {
  const fillStyles: string[] = [];
  const ctx = {
    canvas: { width: canvasWidth, height: canvasHeight },
    clearRect: vi.fn(),
    fillRect: vi.fn(() => {
      fillStyles.push(ctx.fillStyle as string);
    }),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
  } as unknown as CanvasRenderingContext2D;
  return { ctx, fillStyles };
}

describe('発音中ノーツの鍵盤表示（TASK-057: 再生中の鍵盤表示を音価に追随させる）', () => {
  it('soundingNotesに含まれるMIDI番号の鍵はsounding色で描画される（ガイド色より優先）', () => {
    const { ctx, fillStyles } = createColorTrackingCtx();
    const note = createNote(60, 'P1-M1-N0'); // hand='right' -> 通常はguidRight色になるはず

    renderKeyboard({
      ctx,
      expectedNotes: [note],
      pressedKeys: new Set(),
      incorrectKeys: new Set(),
      annotations: [],
      practiceMode: 'both',
      soundingNotes: new Set([60]),
    });

    expect(fillStyles.filter((s) => s === KEY_COLORS.white.sounding)).toHaveLength(1);
    expect(fillStyles).not.toContain(KEY_COLORS.white.guidRight);
  });

  it('soundingNotesにない鍵はガイド色のまま描画される（発音中表示が他の鍵に影響しない）', () => {
    const { ctx, fillStyles } = createColorTrackingCtx();
    const note = createNote(60, 'P1-M1-N0'); // C4 (guidRight対象)

    renderKeyboard({
      ctx,
      expectedNotes: [note],
      pressedKeys: new Set(),
      incorrectKeys: new Set(),
      annotations: [],
      practiceMode: 'both',
      soundingNotes: new Set([62]), // D4（60とは別の鍵）が発音中
    });

    // 60はガイド色のまま、62（ガイド対象外だが発音中）だけがsounding色になる。
    expect(fillStyles.filter((s) => s === KEY_COLORS.white.guidRight)).toHaveLength(1);
    expect(fillStyles.filter((s) => s === KEY_COLORS.white.sounding)).toHaveLength(1);
  });

  it('押鍵中（correct）の色がsounding色より優先される', () => {
    const { ctx, fillStyles } = createColorTrackingCtx();
    const note = createNote(60, 'P1-M1-N0');

    renderKeyboard({
      ctx,
      expectedNotes: [note],
      pressedKeys: new Set([60]),
      incorrectKeys: new Set(),
      annotations: [],
      practiceMode: 'both',
      soundingNotes: new Set([60]),
    });

    expect(fillStyles.filter((s) => s === KEY_COLORS.white.correct)).toHaveLength(1);
    expect(fillStyles).not.toContain(KEY_COLORS.white.sounding);
  });

  it('soundingNotes省略時は既存動作のまま（後方互換、発音中表示なし）', () => {
    const { ctx, fillStyles } = createColorTrackingCtx();
    const note = createNote(60, 'P1-M1-N0');

    renderKeyboard({
      ctx,
      expectedNotes: [note],
      pressedKeys: new Set(),
      incorrectKeys: new Set(),
      annotations: [],
      practiceMode: 'both',
    });

    expect(fillStyles).not.toContain(KEY_COLORS.white.sounding);
    expect(fillStyles.filter((s) => s === KEY_COLORS.white.guidRight)).toHaveLength(1);
  });

  it('黒鍵の発音中もsounding色（黒鍵用）で描画される', () => {
    const { ctx, fillStyles } = createColorTrackingCtx();
    const note = createNote(61, 'P1-M1-N0'); // C#4 black key

    renderKeyboard({
      ctx,
      expectedNotes: [note],
      pressedKeys: new Set(),
      incorrectKeys: new Set(),
      annotations: [],
      practiceMode: 'both',
      soundingNotes: new Set([61]),
    });

    expect(fillStyles.filter((s) => s === KEY_COLORS.black.sounding)).toHaveLength(1);
    expect(fillStyles).not.toContain(KEY_COLORS.black.guidRight);
  });

  it('ガイド対象（expectedNotes）でない鍵でも、soundingNotesに含まれていればsounding色で描画される', () => {
    // 練習モードの判定グループには含まれない（片手練習中の反対側パート等）が、
    // 再生では実際に鳴っているノーツも発音中表示の対象にする。
    const { ctx, fillStyles } = createColorTrackingCtx();

    renderKeyboard({
      ctx,
      expectedNotes: [],
      pressedKeys: new Set(),
      incorrectKeys: new Set(),
      annotations: [],
      practiceMode: 'both',
      soundingNotes: new Set([60]),
    });

    expect(fillStyles.filter((s) => s === KEY_COLORS.white.sounding)).toHaveLength(1);
  });
});

describe('鍵の座標とインジケータ位置の整合（TASK-056）', () => {
  it('鍵盤の描画対象は指定範囲のキーのみである（getNotePositionの範囲内呼び出しでエラーにならない）', () => {
    const { ctx } = createMockCtx(696);
    const { midiMin, midiMax } = KEYBOARD_PRESETS[49];
    const note = createNote(60, 'P1-M1-N0');

    renderKeyboard({
      ctx,
      expectedNotes: [note],
      pressedKeys: new Set(),
      incorrectKeys: new Set(),
      annotations: [],
      practiceMode: 'both',
      midiMin,
      midiMax,
    });

    expect(() => getNotePosition(midiMin, midiMin, midiMax)).not.toThrow();
    expect(() => getNotePosition(midiMax, midiMin, midiMax)).not.toThrow();
  });
});
