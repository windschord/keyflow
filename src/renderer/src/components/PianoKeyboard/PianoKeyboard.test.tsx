import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { renderWithStrictMode as render } from '../../tests/test-utils';
import { PianoKeyboard } from './index';
import { getNotePosition, KEY_COLORS, KEYBOARD_PRESETS, countWhiteKeys } from './key-layout';
import { renderKeyboard } from './keyboard-renderer';
import type { Annotation, Hand, Note, KeyboardSize } from '../../types';

function createNote(midiNumber: number, id: string, partId = 'P1', hand?: Hand): Note {
  return {
    id,
    partId,
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
    hand,
  };
}

/**
 * fillRect呼び出し時点でのctx.fillStyleを記録するモックctxを作成する。
 * drawKeyは全88鍵を毎回描画するため、対象midi以外のキーも大量にfillRectされる。
 * 個々のキーの座標までは追跡せず、「特定の色が何回使われたか」で色分けを検証する。
 */
function createColorTrackingCtx(): {
  ctx: CanvasRenderingContext2D;
  fillStyles: string[];
} {
  const fillStyles: string[] = [];
  const ctx = {
    canvas: { width: 1248, height: 150 },
    clearRect: vi.fn(),
    fillRect: vi.fn(() => {
      fillStyles.push(ctx.fillStyle as string);
    }),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
  } as unknown as CanvasRenderingContext2D;
  return { ctx, fillStyles };
}

function createMockCtx() {
  return {
    canvas: { width: 1248, height: 150 },
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
  } as unknown as CanvasRenderingContext2D & { fillText: ReturnType<typeof vi.fn> };
}

describe('PianoKeyboard and KeyLayout', () => {
  beforeEach(() => {
    // Mock canvas context
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      canvas: { width: 1000, height: 150 },
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    })) as any;
  });

  it('renders canvas correctly', () => {
    render(
      <PianoKeyboard
        expectedNotes={[]}
        pressedKeys={new Set()}
        incorrectKeys={new Set()}
        annotations={[]}
        practiceMode="both"
        onKeyClick={() => {}}
        height={150}
      />
    );
    expect(screen.getByTestId('piano-canvas')).toBeInTheDocument();
  });

  it('calculates C4 (MIDI 60) position correctly', () => {
    const pos = getNotePosition(60);
    expect(pos.isBlack).toBe(false);
    expect(pos.width).toBe(24);
  });

  it('calculates C#4 (MIDI 61) position correctly', () => {
    const pos = getNotePosition(61);
    expect(pos.isBlack).toBe(true);
    expect(pos.width).toBe(14);
  });

  it('throws error for out of range MIDI numbers', () => {
    expect(() => getNotePosition(10)).toThrow();
    expect(() => getNotePosition(120)).toThrow();
  });
});

// TASK-056: 画面下キーボードの鍵盤数指定。canvas幅（totalWidth）は
// KEYBOARD_PRESETSの白鍵数から算出され、keyboardSize省略時は88鍵のまま
// （既存動作の後方互換）である。
describe('PianoKeyboard の鍵盤数プリセット（TASK-056）', () => {
  beforeEach(() => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      canvas: { width: 1000, height: 150 },
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      fillText: vi.fn(),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    })) as any;
  });

  const presetCases: Array<{ size: KeyboardSize; expectedWidth: number }> = [
    { size: 88, expectedWidth: 52 * 24 },
    { size: 76, expectedWidth: 45 * 24 },
    { size: 61, expectedWidth: 36 * 24 },
    { size: 49, expectedWidth: 29 * 24 },
  ];

  it.each(presetCases)(
    'keyboardSize=$size のとき、canvas幅は白鍵数×24pxになる（$expectedWidthpx）',
    ({ size, expectedWidth }) => {
      render(
        <PianoKeyboard
          expectedNotes={[]}
          pressedKeys={new Set()}
          incorrectKeys={new Set()}
          annotations={[]}
          practiceMode="both"
          onKeyClick={() => {}}
          height={150}
          keyboardSize={size}
        />
      );

      const canvas = screen.getByTestId('piano-canvas') as HTMLCanvasElement;
      expect(canvas.width).toBe(expectedWidth);
      expect(expectedWidth).toBe(
        countWhiteKeys(KEYBOARD_PRESETS[size].midiMin, KEYBOARD_PRESETS[size].midiMax) * 24
      );
    }
  );

  it('keyboardSizeを省略した場合は88鍵として扱われる（既存動作の後方互換）', () => {
    render(
      <PianoKeyboard
        expectedNotes={[]}
        pressedKeys={new Set()}
        incorrectKeys={new Set()}
        annotations={[]}
        practiceMode="both"
        onKeyClick={() => {}}
        height={150}
      />
    );

    const canvas = screen.getByTestId('piano-canvas') as HTMLCanvasElement;
    expect(canvas.width).toBe(52 * 24);
  });
});

// TASK-056: クリック座標→MIDI変換の整合（全プリセット）。
// getBoundingClientRectをleft=0/top=0にモックし、clientX/clientYをそのまま
// canvas内座標として扱えるようにする。
describe('PianoKeyboard のクリック座標→MIDI変換（全プリセット、TASK-056）', () => {
  beforeEach(() => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      canvas: { width: 1000, height: 150 },
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      fillText: vi.fn(),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    })) as any;
    HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(
      () =>
        ({
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          width: 0,
          height: 0,
          x: 0,
          y: 0,
          toJSON: () => {},
        }) as DOMRect
    );
  });

  const presetSizes: KeyboardSize[] = [88, 76, 61, 49];

  it.each(presetSizes)(
    'keyboardSize=%i のとき、範囲の先頭鍵（midiMin）をクリックするとonKeyClickにmidiMinが渡される',
    (size) => {
      const { midiMin, midiMax } = KEYBOARD_PRESETS[size];
      const onKeyClick = vi.fn();
      render(
        <PianoKeyboard
          expectedNotes={[]}
          pressedKeys={new Set()}
          incorrectKeys={new Set()}
          annotations={[]}
          practiceMode="both"
          onKeyClick={onKeyClick}
          height={150}
          keyboardSize={size}
        />
      );

      const canvas = screen.getByTestId('piano-canvas');
      const pos = getNotePosition(midiMin, midiMin, midiMax);
      fireEvent.click(canvas, { clientX: pos.x + pos.width / 2, clientY: pos.height / 2 });

      expect(onKeyClick).toHaveBeenCalledWith(midiMin);
    }
  );

  it.each(presetSizes)(
    'keyboardSize=%i のとき、範囲の末尾鍵（midiMax）をクリックするとonKeyClickにmidiMaxが渡される',
    (size) => {
      const { midiMin, midiMax } = KEYBOARD_PRESETS[size];
      const onKeyClick = vi.fn();
      render(
        <PianoKeyboard
          expectedNotes={[]}
          pressedKeys={new Set()}
          incorrectKeys={new Set()}
          annotations={[]}
          practiceMode="both"
          onKeyClick={onKeyClick}
          height={150}
          keyboardSize={size}
        />
      );

      const canvas = screen.getByTestId('piano-canvas');
      const pos = getNotePosition(midiMax, midiMin, midiMax);
      fireEvent.click(canvas, { clientX: pos.x + pos.width / 2, clientY: pos.height / 2 });

      expect(onKeyClick).toHaveBeenCalledWith(midiMax);
    }
  );
});

// TASK-056: 範囲外ノーツのインジケータ表示（コンポーネント経由。実際のuseEffectが
// renderKeyboardへ範囲外判定を渡していることを検証する結線テスト）。
describe('PianoKeyboard から renderKeyboard への範囲パラメータ伝搬（TASK-056）', () => {
  it('61鍵プリセット時、renderKeyboardへmidiMin=36/midiMax=96が渡される', () => {
    const fillText = vi.fn();
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      canvas: { width: 864, height: 150 },
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      fillText,
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    })) as any;

    const belowRangeNote: Note = {
      id: 'P1-M1-N0',
      partId: 'P1',
      measureNumber: 1,
      noteIndex: 0,
      pitch: { step: 'C', octave: 1 },
      midiNumber: 24, // 61鍵の範囲(36-96)より低い
      duration: 1,
      startTick: 0,
      durationTicks: 480,
      startSeconds: 0,
      durationSeconds: 0.5,
      voice: 1,
      isChord: false,
      isRest: false,
      staff: 1,
    };

    render(
      <PianoKeyboard
        expectedNotes={[belowRangeNote]}
        pressedKeys={new Set()}
        incorrectKeys={new Set()}
        annotations={[]}
        practiceMode="both"
        onKeyClick={() => {}}
        height={150}
        keyboardSize={61}
      />
    );

    // renderKeyboard内部のdrawOutOfRangeIndicatorsが左端の矢印を描画する
    // （PianoKeyboardが実際にmidiMin/midiMaxをrenderKeyboardへ渡している証拠）。
    expect(fillText).toHaveBeenCalledWith('◀', expect.any(Number), expect.any(Number));
  });
});

// TASK-058: 画面下キーボードのセンタリングと余白色の調整。
// コンテナ（keyboard-container）がcanvasを水平センタリングし、余白がヘッダーと
// 同色（#e0e0e0）で表示されることを検証する。
describe('PianoKeyboard コンテナのセンタリング・余白色（TASK-058）', () => {
  beforeEach(() => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      canvas: { width: 1000, height: 150 },
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      fillText: vi.fn(),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    })) as any;
  });

  it('コンテナはcanvasを水平センタリングする（display:flex + justifyContent: safe center）', () => {
    render(
      <PianoKeyboard
        expectedNotes={[]}
        pressedKeys={new Set()}
        incorrectKeys={new Set()}
        annotations={[]}
        practiceMode="both"
        onKeyClick={() => {}}
        height={150}
        keyboardSize={49}
      />
    );

    const container = screen.getByTestId('keyboard-container');
    expect(container.style.display).toBe('flex');
    expect(container.style.justifyContent).toBe('safe center');
  });

  it('コンテナの背景色はヘッダーバーと同じ#e0e0e0である', () => {
    render(
      <PianoKeyboard
        expectedNotes={[]}
        pressedKeys={new Set()}
        incorrectKeys={new Set()}
        annotations={[]}
        practiceMode="both"
        onKeyClick={() => {}}
        height={150}
      />
    );

    const container = screen.getByTestId('keyboard-container');
    expect(container.style.backgroundColor).toBe('rgb(224, 224, 224)'); // #e0e0e0
  });

  it('88鍵で横スクロールが必要な場合でも、コンテナは横スクロール可能なままである', () => {
    render(
      <PianoKeyboard
        expectedNotes={[]}
        pressedKeys={new Set()}
        incorrectKeys={new Set()}
        annotations={[]}
        practiceMode="both"
        onKeyClick={() => {}}
        height={150}
        keyboardSize={88}
      />
    );

    const container = screen.getByTestId('keyboard-container');
    expect(container.style.overflowX).toBe('auto');
  });
});

// TASK-058: センタリング後もクリック座標→MIDI変換が正しいことを担保する。
// getBoundingClientRectはcanvasのDOM上の実際の位置（センタリングによる
// オフセットを含む）を返す前提のため、rect.leftを0以外（狭いプリセットが
// センタリングされた状態を想定した値）にモックしても変換が崩れないことを検証する。
describe('PianoKeyboard センタリング状態でのクリック座標→MIDI変換（TASK-058）', () => {
  beforeEach(() => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      canvas: { width: 1000, height: 150 },
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      fillText: vi.fn(),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    })) as any;
  });

  const centeredOffsetLeft = 200; // センタリングにより生じるオフセットを想定した値

  it.each([76, 61, 49] as KeyboardSize[])(
    'keyboardSize=%i がセンタリングされた状態（rect.left=200）でも、先頭鍵（midiMin）クリックが正しく変換される',
    (size) => {
      HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(
        () =>
          ({
            left: centeredOffsetLeft,
            top: 0,
            right: 0,
            bottom: 0,
            width: 0,
            height: 0,
            x: centeredOffsetLeft,
            y: 0,
            toJSON: () => {},
          }) as DOMRect
      );

      const { midiMin, midiMax } = KEYBOARD_PRESETS[size];
      const onKeyClick = vi.fn();
      render(
        <PianoKeyboard
          expectedNotes={[]}
          pressedKeys={new Set()}
          incorrectKeys={new Set()}
          annotations={[]}
          practiceMode="both"
          onKeyClick={onKeyClick}
          height={150}
          keyboardSize={size}
        />
      );

      const canvas = screen.getByTestId('piano-canvas');
      const pos = getNotePosition(midiMin, midiMin, midiMax);
      fireEvent.click(canvas, {
        clientX: centeredOffsetLeft + pos.x + pos.width / 2,
        clientY: pos.height / 2,
      });

      expect(onKeyClick).toHaveBeenCalledWith(midiMin);
    }
  );
});

describe('鍵盤上の指番号描画（REQ-005-007 / TASK-037）', () => {
  it('現在の判定グループのノーツに指番号アノテーションがある場合、対応する鍵の上に指番号を描画する', () => {
    const ctx = createMockCtx();
    const note = createNote(60, 'P1-M1-N0');
    const annotations: Annotation[] = [
      { noteId: 'P1-M1-N0', fingerNumber: 3, isAISuggested: true, isApproved: true },
    ];

    renderKeyboard({
      ctx,
      expectedNotes: [note],
      pressedKeys: new Set(),
      incorrectKeys: new Set(),
      annotations,
      practiceMode: 'both',
    });

    const pos = getNotePosition(60);
    expect(ctx.fillText).toHaveBeenCalledTimes(1);
    const [text, x, y] = ctx.fillText.mock.calls[0];
    expect(text).toBe('3');
    // 白鍵の中央付近（鍵の幅の範囲内）に描画される
    expect(x).toBeGreaterThanOrEqual(pos.x);
    expect(x).toBeLessThanOrEqual(pos.x + pos.width);
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThanOrEqual(pos.height);
  });

  it('黒鍵のノーツにも指番号を描画する', () => {
    const ctx = createMockCtx();
    const note = createNote(61, 'P1-M1-N1');
    const annotations: Annotation[] = [
      { noteId: 'P1-M1-N1', fingerNumber: 2, isAISuggested: false, isApproved: true },
    ];

    renderKeyboard({
      ctx,
      expectedNotes: [note],
      pressedKeys: new Set(),
      incorrectKeys: new Set(),
      annotations,
      practiceMode: 'both',
    });

    const pos = getNotePosition(61);
    expect(ctx.fillText).toHaveBeenCalledTimes(1);
    const [text, x, y] = ctx.fillText.mock.calls[0];
    expect(text).toBe('2');
    expect(x).toBeGreaterThanOrEqual(pos.x);
    expect(x).toBeLessThanOrEqual(pos.x + pos.width);
    expect(y).toBeLessThanOrEqual(pos.height);
  });

  it('アノテーションのないノーツには指番号を描画しない', () => {
    const ctx = createMockCtx();
    const note = createNote(60, 'P1-M1-N0');

    renderKeyboard({
      ctx,
      expectedNotes: [note],
      pressedKeys: new Set(),
      incorrectKeys: new Set(),
      annotations: [],
      practiceMode: 'both',
    });

    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it('fingerNumberを持たないアノテーション（コメントのみ）は描画しない', () => {
    const ctx = createMockCtx();
    const note = createNote(60, 'P1-M1-N0');
    const annotations: Annotation[] = [
      { noteId: 'P1-M1-N0', comment: 'ゆっくり', isAISuggested: false, isApproved: true },
    ];

    renderKeyboard({
      ctx,
      expectedNotes: [note],
      pressedKeys: new Set(),
      incorrectKeys: new Set(),
      annotations,
      practiceMode: 'both',
    });

    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it('現在の判定グループに含まれない鍵には描画しない（annotationsにあってもexpectedNotesにないnoteId）', () => {
    const ctx = createMockCtx();
    const note = createNote(60, 'P1-M1-N0');
    const annotations: Annotation[] = [
      { noteId: 'P1-M2-N0', fingerNumber: 5, isAISuggested: true, isApproved: true },
    ];

    renderKeyboard({
      ctx,
      expectedNotes: [note],
      pressedKeys: new Set(),
      incorrectKeys: new Set(),
      annotations,
      practiceMode: 'both',
    });

    expect(ctx.fillText).not.toHaveBeenCalled();
  });
});

// TASK-057: PianoKeyboardがrenderKeyboardへsoundingNotesを実際に伝搬していることの
// 結線検証（音価に応じた再生中の鍵盤表示）。
describe('PianoKeyboard から renderKeyboard への soundingNotes 伝搬（TASK-057）', () => {
  it('soundingNotesプロパティで指定したMIDI番号の鍵がsounding色で描画される', () => {
    const { ctx, fillStyles } = createColorTrackingCtx();
    HTMLCanvasElement.prototype.getContext = vi.fn(
      () => ctx
    ) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    render(
      <PianoKeyboard
        expectedNotes={[]}
        pressedKeys={new Set()}
        incorrectKeys={new Set()}
        annotations={[]}
        practiceMode="both"
        onKeyClick={() => {}}
        height={150}
        soundingNotes={new Set([60])}
      />
    );

    // renderWithStrictMode（React 18 StrictMode）はeffectを二重実行するため、
    // 描画自体は複数回起きうる。ここでは「実際にsounding色で描画されたか」
    // （renderKeyboardへsoundingNotesが伝搬しているか）のみを検証する。
    expect(fillStyles).toContain(KEY_COLORS.white.sounding);
  });

  it('soundingNotesを省略した場合は既存動作のまま（発音中表示なし、後方互換）', () => {
    const { ctx, fillStyles } = createColorTrackingCtx();
    HTMLCanvasElement.prototype.getContext = vi.fn(
      () => ctx
    ) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    render(
      <PianoKeyboard
        expectedNotes={[]}
        pressedKeys={new Set()}
        incorrectKeys={new Set()}
        annotations={[]}
        practiceMode="both"
        onKeyClick={() => {}}
        height={150}
      />
    );

    expect(fillStyles).not.toContain(KEY_COLORS.white.sounding);
  });
});

describe('鍵盤ガイドの左右色分け（REQ-005-002 / TASK-041, note.hand基準はTASK-048）', () => {
  it('hand=rightの白鍵ノーツはguidRight色で描画される', () => {
    const { ctx, fillStyles } = createColorTrackingCtx();
    const note = createNote(60, 'P1-M1-N0', 'P1', 'right'); // C4 white key

    renderKeyboard({
      ctx,
      expectedNotes: [note],
      pressedKeys: new Set(),
      incorrectKeys: new Set(),
      annotations: [],
      practiceMode: 'both',
    });

    expect(fillStyles.filter((s) => s === KEY_COLORS.white.guidRight)).toHaveLength(1);
    expect(fillStyles).not.toContain(KEY_COLORS.white.guidLeft);
  });

  it('hand=rightの黒鍵ノーツはguidRight色で描画される', () => {
    const { ctx, fillStyles } = createColorTrackingCtx();
    const note = createNote(61, 'P1-M1-N1', 'P1', 'right'); // C#4 black key

    renderKeyboard({
      ctx,
      expectedNotes: [note],
      pressedKeys: new Set(),
      incorrectKeys: new Set(),
      annotations: [],
      practiceMode: 'both',
    });

    expect(fillStyles.filter((s) => s === KEY_COLORS.black.guidRight)).toHaveLength(1);
    expect(fillStyles).not.toContain(KEY_COLORS.black.guidLeft);
  });

  it('hand=leftの白鍵ノーツはguidLeft色で描画される', () => {
    const { ctx, fillStyles } = createColorTrackingCtx();
    const note = createNote(48, 'P2-M1-N0', 'P2', 'left'); // C3 white key

    renderKeyboard({
      ctx,
      expectedNotes: [note],
      pressedKeys: new Set(),
      incorrectKeys: new Set(),
      annotations: [],
      practiceMode: 'both',
    });

    expect(fillStyles.filter((s) => s === KEY_COLORS.white.guidLeft)).toHaveLength(1);
    expect(fillStyles).not.toContain(KEY_COLORS.white.guidRight);
  });

  it('handが未設定のノーツはフォールバックでguidLeft色になる', () => {
    const { ctx, fillStyles } = createColorTrackingCtx();
    const note = createNote(60, 'P9-M1-N0', 'P9'); // hand未指定

    renderKeyboard({
      ctx,
      expectedNotes: [note],
      pressedKeys: new Set(),
      incorrectKeys: new Set(),
      annotations: [],
      practiceMode: 'both',
    });

    expect(fillStyles.filter((s) => s === KEY_COLORS.white.guidLeft)).toHaveLength(1);
    expect(fillStyles).not.toContain(KEY_COLORS.white.guidRight);
  });

  it('1パート2段譜（同一partId）でも、staff2由来のhand=leftはguidLeft色になる（TASK-048）', () => {
    const { ctx, fillStyles } = createColorTrackingCtx();
    // 同一partId('P1')でも、上段(staff1)/下段(staff2)はnote.handで区別される。
    const upperStaffNote = createNote(60, 'P1-M1-N0', 'P1', 'right');
    const lowerStaffNote = createNote(48, 'P1-M1-N1', 'P1', 'left');

    renderKeyboard({
      ctx,
      expectedNotes: [upperStaffNote, lowerStaffNote],
      pressedKeys: new Set(),
      incorrectKeys: new Set(),
      annotations: [],
      practiceMode: 'both',
    });

    expect(fillStyles.filter((s) => s === KEY_COLORS.white.guidRight)).toHaveLength(1);
    expect(fillStyles.filter((s) => s === KEY_COLORS.white.guidLeft)).toHaveLength(1);
  });

  it('片手練習モード（right）でもhand=leftのノーツはguidLeft色のまま（practiceModeによる強制なし）', () => {
    const { ctx, fillStyles } = createColorTrackingCtx();
    const note = createNote(48, 'P2-M1-N0', 'P2', 'left');

    renderKeyboard({
      ctx,
      expectedNotes: [note],
      pressedKeys: new Set(),
      incorrectKeys: new Set(),
      annotations: [],
      practiceMode: 'right',
    });

    expect(fillStyles.filter((s) => s === KEY_COLORS.white.guidLeft)).toHaveLength(1);
    expect(fillStyles).not.toContain(KEY_COLORS.white.guidRight);
  });

  it('押鍵中（correct）の色がガイド色より優先される', () => {
    const { ctx, fillStyles } = createColorTrackingCtx();
    const note = createNote(60, 'P1-M1-N0', 'P1', 'right');

    renderKeyboard({
      ctx,
      expectedNotes: [note],
      pressedKeys: new Set([60]),
      incorrectKeys: new Set(),
      annotations: [],
      practiceMode: 'both',
    });

    expect(fillStyles.filter((s) => s === KEY_COLORS.white.correct)).toHaveLength(1);
    expect(fillStyles).not.toContain(KEY_COLORS.white.guidRight);
  });

  it('誤答（incorrect）の色がガイド色より優先される', () => {
    const { ctx, fillStyles } = createColorTrackingCtx();
    const note = createNote(60, 'P1-M1-N0', 'P1', 'right');

    renderKeyboard({
      ctx,
      expectedNotes: [note],
      pressedKeys: new Set(),
      incorrectKeys: new Set([60]),
      annotations: [],
      practiceMode: 'both',
    });

    expect(fillStyles.filter((s) => s === KEY_COLORS.white.incorrect)).toHaveLength(1);
    expect(fillStyles).not.toContain(KEY_COLORS.white.guidRight);
  });
});
