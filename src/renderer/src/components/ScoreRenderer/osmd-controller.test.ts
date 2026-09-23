import { describe, it, expect, vi } from 'vitest';
import { OSMDController, computeFingeringCoords } from './osmd-controller';
import type { ScoreMapCache } from './osmd-controller';
import type { Score, Note } from '../../types';

/**
 * テスト用の最小限のScoreを組み立てるヘルパー。
 * 指定した小節ごとのnoteId配列から、midiNumber=12・staff=1・isRest=falseで
 * 統一されたNoteリストを生成する。
 * OSMDカーソルのモックNote `{}` はhalfTone未設定＝0のため、
 * midiNumber = halfTone(0) + 12 = 12 と評価されることに合わせている。
 */
function makeScore(measures: Array<{ number: number; noteIds: string[] }>): Score {
  return {
    title: 'Test Score',
    parts: [{ id: 'P1', name: 'Piano', hand: 'right', clef: 'treble' }],
    tempo: 120,
    ticksPerQuarter: 480,
    tempoMap: [{ tick: 0, bpm: 120 }],
    timeSignature: { beats: 4, beatType: 4 },
    keySignature: 0,
    pedalSpans: [],
    measures: measures.map(({ number, noteIds }) => ({
      number,
      startTick: 0,
      notes: noteIds.map((id, noteIndex): Note => ({
        id,
        partId: 'P1',
        measureNumber: number,
        noteIndex,
        pitch: { step: 'C', octave: 4 },
        midiNumber: 12,
        duration: 1,
        startTick: 0,
        durationTicks: 480,
        startSeconds: 0,
        durationSeconds: 0,
        voice: 1,
        isChord: false,
        isRest: false,
        staff: 1,
      })),
    })),
  };
}

describe('OSMDController moveCursor and buildNoteIdMap', () => {
  it('moves cursor to target note based on iteratorIndex map', () => {
    const mockScrollIntoView = vi.fn();
    let iteratorIdx = 0;
    const mockCursor = {
      Hidden: true,
      show: vi.fn(),
      hide: vi.fn(),
      reset: vi.fn().mockImplementation(() => {
        iteratorIdx = 0;
        mockCursor.Iterator.EndReached = false;
      }),
      next: vi.fn().mockImplementation(() => {
        iteratorIdx++;
        mockCursor.Iterator.EndReached = iteratorIdx >= 5;
      }),
      cursorElement: {
        scrollIntoView: mockScrollIntoView,
        style: { cssText: '' },
        // mock 没有 closest，走 scrollCursorIntoView 的回退路径（无动画）
        getBoundingClientRect: () =>
          ({ left: 0, top: 0, right: 4, bottom: 40, width: 4, height: 40 }) as DOMRect,
      },
      get Iterator() {
        return {
          CurrentMeasureIndex: Math.floor(iteratorIdx / 2),
          EndReached: iteratorIdx >= 5,
          get CurrentVoiceEntries() {
            return [
              {
                Notes: [{}],
                ParentVoice: {
                  Parent: {
                    IdString: 'P1',
                  },
                },
              },
            ];
          },
        };
      },
    };

    const controller = new OSMDController(document.createElement('div'));
    // @ts-expect-error test mock access
    controller.loaded = true;
    // @ts-expect-error test mock access
    controller.osmd = { cursor: mockCursor };

    // 5イテレータステップ: 小節1に2音、小節2に2音、小節3に1音（moveCursorの
    // インクリメンタル移動を検証するテストの前提を維持する）。
    const score = makeScore([
      { number: 1, noteIds: ['P1-M1-N0', 'P1-M1-N1'] },
      { number: 2, noteIds: ['P1-M2-N0', 'P1-M2-N1'] },
      { number: 3, noteIds: ['P1-M3-N0'] },
    ]);

    const map = controller.buildNoteIdMap(score);
    expect(map.size).toBe(5); // 0 to 4 steps before EndReached = true

    // After buildNoteIdMap, cursor was reset twice (once at start, once at end)
    // so iteratorIdx is back to 0 and currentIteratorIndex is 0
    expect(iteratorIdx).toBe(0); // reset() at end of buildNoteIdMap sets iteratorIdx to 0
    expect(mockCursor.reset).toHaveBeenCalledTimes(2); // Once at start and once at end of buildNoteIdMap

    // Let's test moveCursor to note P1-M2-N0 which should be at iteratorIndex = 2
    // because measure 0 is steps 0,1. measure 1 is steps 2,3.
    // buildNoteIdMap で iteratorIndexToCursorStyle に cssText がキャッシュされているため、
    // moveCursor は O(1) の高速パス（cssText 復元）を使用し next() を呼ばない。
    controller.moveCursor('P1-M2-N0');

    expect(mockCursor.show).toHaveBeenCalled();
    expect(mockCursor.reset).toHaveBeenCalledTimes(2); // buildNoteIdMap の開始・終了のみ
    expect(mockCursor.next).toHaveBeenCalledTimes(5); // buildNoteIdMap の 5 回のみ（moveCursor は高速パス）
    // mock には closest がなく scroll コンテナが見つからないため、回退パス
    // （behavior:'auto' の scrollIntoView）が呼ばれる。smooth ではなく無アニメーション。
    expect(mockScrollIntoView).toHaveBeenCalledWith({
      behavior: 'auto',
      block: 'nearest',
      inline: 'nearest',
    });
  });

  it('跨页跳转时先把 cursorElement 移动到目标页面的 div 下再应用坐标样式（分页 bug 修复）', () => {
    // 模拟分页模式：容器下有两个页面 div（osmdCanvasPage1 / osmdCanvasPage2）
    const container = document.createElement('div');
    const page1 = document.createElement('div');
    page1.id = 'osmdCanvasPage1';
    const page2 = document.createElement('div');
    page2.id = 'osmdCanvasPage2';
    container.appendChild(page1);
    container.appendChild(page2);

    // cursorElement 当前挂在第 1 页（旧页面）
    const cursorEl = document.createElement('img');
    page1.appendChild(cursorEl);

    const mockCursor = {
      Hidden: false,
      show: vi.fn(),
      hide: vi.fn(),
      reset: vi.fn(),
      next: vi.fn(),
      cursorElement: cursorEl,
      Iterator: { CurrentMeasureIndex: 1, EndReached: true, CurrentVoiceEntries: [] },
    };

    const controller = new OSMDController(container);
    // @ts-expect-error test mock access
    controller.loaded = true;
    // @ts-expect-error test mock access
    controller.osmd = { cursor: mockCursor };
    // @ts-expect-error test mock access
    controller.noteIdToCursorState = new Map([['P1-M13-N0', { iteratorIndex: 12 }]]);
    // @ts-expect-error test mock access
    controller.iteratorIndexToCursorStyle = new Map([[12, 'left: 100px; top: 500px;']]);
    // 目标音符在第 2 页（pageIndex=1）
    // @ts-expect-error test mock access
    controller.noteIdToSvgCoord = new Map([
      ['P1-M13-N0', { x: 100, y: 500, pageIndex: 1 }],
    ]);

    controller.moveCursor('P1-M13-N0');

    // O(1) 高速路径：不调用 next()，但 cursorElement 应被 reparent 到第 2 页
    expect(mockCursor.next).not.toHaveBeenCalled();
    expect(cursorEl.parentElement).toBe(page2);
    expect(cursorEl.style.cssText).toBe('left: 100px; top: 500px;');
  });
});

/** 给元素安装 mock 的 getBoundingClientRect（jsdom 默认全 0，需显式指定）。 */
function installRect(
  el: Element,
  rect: { left: number; top: number; width: number; height: number }
): void {
  Object.defineProperty(el, 'getBoundingClientRect', {
    configurable: true,
    value: () =>
      ({
        left: rect.left,
        top: rect.top,
        right: rect.left + rect.width,
        bottom: rect.top + rect.height,
        width: rect.width,
        height: rect.height,
        x: rect.left,
        y: rect.top,
        toJSON: () => ({}),
      }) as DOMRect,
  });
}

/**
 * 构建与真实 DOM 一致的结构：
 * scroll container (data-testid="score-scroll-container") > osmd-container > 页面 div > cursorElement
 * 用于验证 scrollCursorIntoView 的自定义即时定位逻辑。
 */
function buildScrollContext(opts: {
  scroller: { left: number; top: number; width: number; height: number };
  pageWidth: number;
  cursorRect: { left: number; top: number; width: number; height: number };
}): { controller: OSMDController; scrollContainer: HTMLDivElement } {
  const scrollContainer = document.createElement('div');
  scrollContainer.setAttribute('data-testid', 'score-scroll-container');
  scrollContainer.scrollLeft = 0;
  scrollContainer.scrollTop = 0;
  installRect(scrollContainer, opts.scroller);

  const osmdContainer = document.createElement('div');
  scrollContainer.appendChild(osmdContainer);

  const page = document.createElement('div');
  page.id = 'osmdCanvasPage1';
  osmdContainer.appendChild(page);
  installRect(page, { left: 0, top: 0, width: opts.pageWidth, height: 1123 });

  const cursorEl = document.createElement('img');
  page.appendChild(cursorEl);
  installRect(cursorEl, opts.cursorRect);

  const controller = new OSMDController(osmdContainer);
  // @ts-expect-error test mock access
  controller.loaded = true;
  // @ts-expect-error test mock access
  controller.osmd = { cursor: { cursorElement: cursorEl } };
  return { controller, scrollContainer };
}

describe('OSMDController scrollCursorIntoView (instant cursor focusing)', () => {
  it('整行可整屏显示时，光标超出右边缘则瞬间定位到视口左 1/3（无 smooth 动画）', () => {
    const { controller, scrollContainer } = buildScrollContext({
      scroller: { left: 0, top: 0, width: 800, height: 600 },
      pageWidth: 794, // ≤ 视口宽 800 → 整行可整屏显示
      cursorRect: { left: 900, top: 100, width: 4, height: 40 }, // 右边缘超出
    });
    // @ts-expect-error test access to private method
    controller.scrollCursorIntoView();

    // 光标定位到左 1/3：targetLeft = 800/3，scrollLeft += 900 - 800/3
    expect(scrollContainer.scrollLeft).toBeCloseTo(900 - 800 / 3, 5);
    // 垂直方向光标在视口内，不滚动
    expect(scrollContainer.scrollTop).toBe(0);
  });

  it('整行超过屏幕长度时，光标超出右边缘则瞬间定位到屏幕最右边', () => {
    const { controller, scrollContainer } = buildScrollContext({
      scroller: { left: 0, top: 0, width: 800, height: 600 },
      pageWidth: 1000, // > 视口宽 800 → 整行超屏
      cursorRect: { left: 900, top: 100, width: 4, height: 40 },
    });
    // @ts-expect-error test access to private method
    controller.scrollCursorIntoView();

    // 光标贴屏幕最右边：targetLeft = 800 - 4(光标宽) - 8(边距) = 788
    expect(scrollContainer.scrollLeft).toBeCloseTo(900 - (800 - 4 - 8), 5);
  });

  it('光标完全在视口内时不滚动', () => {
    const { controller, scrollContainer } = buildScrollContext({
      scroller: { left: 0, top: 0, width: 800, height: 600 },
      pageWidth: 794,
      cursorRect: { left: 300, top: 200, width: 4, height: 40 },
    });
    // @ts-expect-error test access to private method
    controller.scrollCursorIntoView();

    expect(scrollContainer.scrollLeft).toBe(0);
    expect(scrollContainer.scrollTop).toBe(0);
  });

  it('光标超出视口顶部时瞬间定位到视口上 1/4', () => {
    const { controller, scrollContainer } = buildScrollContext({
      scroller: { left: 0, top: 0, width: 800, height: 600 },
      pageWidth: 794,
      cursorRect: { left: 100, top: -50, width: 4, height: 40 }, // 顶部超出
    });
    // @ts-expect-error test access to private method
    controller.scrollCursorIntoView();

    // 水平方向光标在视口内，不滚动
    expect(scrollContainer.scrollLeft).toBe(0);
    // targetTop = 600/4 = 150，scrollTop += -50 - 150 = -200
    expect(scrollContainer.scrollTop).toBe(-200);
  });
});

describe('OSMDController drawLoopBracket / clearLoopBracket', () => {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  it('draws a rectangle covering the notes within the given measure range', () => {
    const container = document.createElement('div');
    const svg = document.createElementNS(SVG_NS, 'svg');
    container.appendChild(svg);

    const controller = new OSMDController(container);
    // @ts-expect-error test mock access to private note coordinate map
    controller.noteIdToSvgCoord = new Map([
      ['P1-M1-N0', { x: 10, y: 20 }],
      ['P1-M2-N0', { x: 30, y: 20 }],
      ['P1-M3-N0', { x: 90, y: 20 }],
    ]);

    controller.drawLoopBracket(1, 2);

    const layer = svg.querySelector('[id^="loop-bracket-layer"]');
    expect(layer).not.toBeNull();
    const rect = layer?.querySelector('rect');
    expect(rect).not.toBeNull();

    // The rect should span measures 1-2 (x=10..30) and not extend as far as measure 3 (x=90).
    const x = parseFloat(rect!.getAttribute('x') || '0');
    const width = parseFloat(rect!.getAttribute('width') || '0');
    expect(x).toBeLessThan(90);
    expect(x + width).toBeLessThan(90);
  });

  it('replaces a previously drawn loop bracket when called again', () => {
    const container = document.createElement('div');
    const svg = document.createElementNS(SVG_NS, 'svg');
    container.appendChild(svg);

    const controller = new OSMDController(container);
    // @ts-expect-error test mock access to private note coordinate map
    controller.noteIdToSvgCoord = new Map([
      ['P1-M1-N0', { x: 10, y: 20 }],
      ['P1-M2-N0', { x: 30, y: 20 }],
    ]);

    controller.drawLoopBracket(1, 2);
    controller.drawLoopBracket(1, 2);

    expect(svg.querySelectorAll('[id^="loop-bracket-layer"]').length).toBe(1);
  });

  it('does nothing when there is no svg to draw onto', () => {
    const controller = new OSMDController(document.createElement('div'));
    expect(() => controller.drawLoopBracket(1, 2)).not.toThrow();
  });

  it('removes the loop bracket layer when cleared', () => {
    const container = document.createElement('div');
    const svg = document.createElementNS(SVG_NS, 'svg');
    container.appendChild(svg);

    const controller = new OSMDController(container);
    // @ts-expect-error test mock access to private note coordinate map
    controller.noteIdToSvgCoord = new Map([['P1-M1-N0', { x: 10, y: 20 }]]);

    controller.drawLoopBracket(1, 1);
    expect(svg.querySelector('[id^="loop-bracket-layer"]')).not.toBeNull();

    controller.clearLoopBracket();
    expect(svg.querySelector('[id^="loop-bracket-layer"]')).toBeNull();
  });
});

describe('OSMDController setGrayedOutNotes (REQ-002-007, note単位グレーアウト TASK-048/060: 音符自体の減光)', () => {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function makeContainerWithSvg(): { container: HTMLDivElement; svg: SVGSVGElement } {
    const container = document.createElement('div');
    const svg = document.createElementNS(SVG_NS, 'svg') as unknown as SVGSVGElement;
    container.appendChild(svg);
    return { container, svg };
  }

  /**
   * `GraphicalNote.getSVGGElement()` を持つスタブを作る。実際にはVexFlowGraphicalNote
   * のインスタンスが渡ってくるが、テストでは構造的型（duck typing）で十分。
   */
  function makeGraphicalNoteStub(
    svgElement: SVGGElement | undefined,
    options?: { throwOnGet?: boolean }
  ): { getSVGGElement: () => SVGGElement | undefined } {
    return {
      getSVGGElement: vi.fn(() => {
        if (options?.throwOnGet) throw new Error('getSVGGElement failed');
        return svgElement;
      }),
    };
  }

  function makeSvgGElement(): SVGGElement {
    return document.createElementNS(SVG_NS, 'g') as unknown as SVGGElement;
  }

  it('dims the SVG element of the graphical note for each grayed-out noteId (not a whole-part/system rectangle)', () => {
    const { container } = makeContainerWithSvg();
    const controller = new OSMDController(container);
    const elN0 = makeSvgGElement();
    const elN1 = makeSvgGElement();
    const elN2 = makeSvgGElement();
    // @ts-expect-error test mock access to private noteId->GraphicalNote map
    controller.noteIdToGraphicalNote = new Map([
      ['P1-M1-N0', makeGraphicalNoteStub(elN0)],
      ['P1-M1-N1', makeGraphicalNoteStub(elN1)],
      ['P1-M1-N2', makeGraphicalNoteStub(elN2)],
    ]);

    // 1パート2段譜想定: N2のみ（下段=左手）をグレーアウトする。
    controller.setGrayedOutNotes(new Set(['P1-M1-N2']), 0.4);

    expect(elN2.style.opacity).toBe('0.4');
    // N0/N1 (グレーアウト対象外) は減光されない。
    expect(elN0.style.opacity).toBe('');
    expect(elN1.style.opacity).toBe('');
  });

  it('never creates the legacy white-veil rectangle layer (#note-grayout-layer)', () => {
    const { container, svg } = makeContainerWithSvg();
    const controller = new OSMDController(container);
    // @ts-expect-error test mock access to private noteId->GraphicalNote map
    controller.noteIdToGraphicalNote = new Map([
      ['P1-M1-N0', makeGraphicalNoteStub(makeSvgGElement())],
    ]);

    controller.setGrayedOutNotes(new Set(['P1-M1-N0']));
    expect(svg.querySelector('#note-grayout-layer')).toBeNull();

    controller.setGrayedOutNotes(new Set());
    expect(svg.querySelector('#note-grayout-layer')).toBeNull();
  });

  it('replaces the previous grayout state entirely when called again (idempotent set-based)', () => {
    const { container } = makeContainerWithSvg();
    const controller = new OSMDController(container);
    const elN0 = makeSvgGElement();
    const elN1 = makeSvgGElement();
    // @ts-expect-error test mock access to private noteId->GraphicalNote map
    controller.noteIdToGraphicalNote = new Map([
      ['P1-M1-N0', makeGraphicalNoteStub(elN0)],
      ['P1-M1-N1', makeGraphicalNoteStub(elN1)],
    ]);

    controller.setGrayedOutNotes(new Set(['P1-M1-N0']));
    expect(elN0.style.opacity).toBe('0.5');

    controller.setGrayedOutNotes(new Set(['P1-M1-N1']));
    // N0 は復元され、N1 に新たに減光が適用される。
    expect(elN0.style.opacity).toBe('');
    expect(elN1.style.opacity).toBe('0.5');
  });

  it('restores all dimmed elements to their original opacity when passed an empty set', () => {
    const { container } = makeContainerWithSvg();
    const controller = new OSMDController(container);
    const el = makeSvgGElement();
    el.style.opacity = '0.9'; // 元々明示的なopacityが設定されているケースも復元できることを確認する
    // @ts-expect-error test mock access to private noteId->GraphicalNote map
    controller.noteIdToGraphicalNote = new Map([['P1-M1-N0', makeGraphicalNoteStub(el)]]);

    controller.setGrayedOutNotes(new Set(['P1-M1-N0']));
    expect(el.style.opacity).toBe('0.5');

    controller.setGrayedOutNotes(new Set());
    expect(el.style.opacity).toBe('0.9');
  });

  it('ignores noteIds that have no known GraphicalNote yet', () => {
    const { container } = makeContainerWithSvg();
    const controller = new OSMDController(container);
    const el = makeSvgGElement();
    // @ts-expect-error test mock access to private noteId->GraphicalNote map
    controller.noteIdToGraphicalNote = new Map([['P1-M1-N0', makeGraphicalNoteStub(el)]]);

    expect(() => controller.setGrayedOutNotes(new Set(['P1-M1-N0', 'P1-M9-N9']))).not.toThrow();
    expect(el.style.opacity).toBe('0.5');
  });

  it('skips a note when getSVGGElement() throws, and still dims the remaining notes', () => {
    const { container } = makeContainerWithSvg();
    const controller = new OSMDController(container);
    const elOk = makeSvgGElement();
    const throwingStub = makeGraphicalNoteStub(undefined, { throwOnGet: true });
    // @ts-expect-error test mock access to private noteId->GraphicalNote map
    controller.noteIdToGraphicalNote = new Map([
      ['P1-M1-N0', throwingStub],
      ['P1-M1-N1', makeGraphicalNoteStub(elOk)],
    ]);

    expect(() => controller.setGrayedOutNotes(new Set(['P1-M1-N0', 'P1-M1-N1']))).not.toThrow();
    expect(throwingStub.getSVGGElement).toHaveBeenCalled();
    expect(elOk.style.opacity).toBe('0.5');
  });

  it('skips a note when getSVGGElement() returns undefined', () => {
    const { container } = makeContainerWithSvg();
    const controller = new OSMDController(container);
    // @ts-expect-error test mock access to private noteId->GraphicalNote map
    controller.noteIdToGraphicalNote = new Map([['P1-M1-N0', makeGraphicalNoteStub(undefined)]]);

    expect(() => controller.setGrayedOutNotes(new Set(['P1-M1-N0']))).not.toThrow();
  });

  it('does nothing when there is no svg/graphical note resolved yet', () => {
    const container = document.createElement('div');
    const controller = new OSMDController(container);
    expect(() => controller.setGrayedOutNotes(new Set(['P1-M1-N0']))).not.toThrow();
  });

  // TASK-081: 和音（複数noteIdが同一のSVG要素を共有するケース）でグレーアウトの
  // 復元が破綻し、モード切替のたびに減光が残留・累積する回帰を防止するテスト。
  it('restores a chord element to its original opacity when multiple noteIds share the same SVG element', () => {
    const { container } = makeContainerWithSvg();
    const controller = new OSMDController(container);
    const chordEl = makeSvgGElement();
    // @ts-expect-error test mock access to private noteId->GraphicalNote map
    controller.noteIdToGraphicalNote = new Map([
      ['P1-M1-N2', makeGraphicalNoteStub(chordEl)],
      ['P1-M1-N3', makeGraphicalNoteStub(chordEl)],
    ]);

    controller.setGrayedOutNotes(new Set(['P1-M1-N2', 'P1-M1-N3']));
    expect(chordEl.style.opacity).toBe('0.5');

    // 解除後、共有要素のopacityは減光前の値（空文字）へ完全に戻る想定である。
    // noteId単位管理の旧実装では2件目の処理時に'0.5'を元値として誤記録するため、
    // ここで'0.5'が残留していた（TASK-081の再現バグ）。
    controller.setGrayedOutNotes(new Set());
    expect(chordEl.style.opacity).toBe('');
  });

  it('does not accumulate residual dimming on a shared chord element across repeated hand-mode toggles', () => {
    const { container } = makeContainerWithSvg();
    const controller = new OSMDController(container);
    const chordEl = makeSvgGElement(); // 左手側の和音（N2/N3が同一要素を共有）
    const rightEl = makeSvgGElement(); // 右手側の単音
    // @ts-expect-error test mock access to private noteId->GraphicalNote map
    controller.noteIdToGraphicalNote = new Map([
      ['P1-M1-N0', makeGraphicalNoteStub(rightEl)],
      ['P1-M1-N2', makeGraphicalNoteStub(chordEl)],
      ['P1-M1-N3', makeGraphicalNoteStub(chordEl)],
    ]);

    // both → 左手選択（右手のみ減光） → both → 右手選択（左手和音のみ減光） → both
    controller.setGrayedOutNotes(new Set());
    expect(rightEl.style.opacity).toBe('');
    expect(chordEl.style.opacity).toBe('');

    controller.setGrayedOutNotes(new Set(['P1-M1-N0']));
    expect(rightEl.style.opacity).toBe('0.5');
    expect(chordEl.style.opacity).toBe('');

    controller.setGrayedOutNotes(new Set());
    expect(rightEl.style.opacity).toBe('');
    expect(chordEl.style.opacity).toBe('');

    controller.setGrayedOutNotes(new Set(['P1-M1-N2', 'P1-M1-N3']));
    expect(chordEl.style.opacity).toBe('0.5');
    expect(rightEl.style.opacity).toBe('');

    controller.setGrayedOutNotes(new Set());
    expect(chordEl.style.opacity).toBe('');
    expect(rightEl.style.opacity).toBe('');
  });

  it('preserves a chord element pre-existing explicit opacity across repeated grayout apply/restore cycles', () => {
    const { container } = makeContainerWithSvg();
    const controller = new OSMDController(container);
    const chordEl = makeSvgGElement();
    chordEl.style.opacity = '0.9'; // 元々明示的なopacityが設定されているケースも保全されることを確認する
    // @ts-expect-error test mock access to private noteId->GraphicalNote map
    controller.noteIdToGraphicalNote = new Map([
      ['P1-M1-N2', makeGraphicalNoteStub(chordEl)],
      ['P1-M1-N3', makeGraphicalNoteStub(chordEl)],
    ]);

    controller.setGrayedOutNotes(new Set(['P1-M1-N2', 'P1-M1-N3']));
    expect(chordEl.style.opacity).toBe('0.5');

    controller.setGrayedOutNotes(new Set());
    expect(chordEl.style.opacity).toBe('0.9');

    // 繰り返し適用・解除しても、元値が'0.5'へ劣化せず保全されることを確認する。
    controller.setGrayedOutNotes(new Set(['P1-M1-N2', 'P1-M1-N3']));
    expect(chordEl.style.opacity).toBe('0.5');
    controller.setGrayedOutNotes(new Set());
    expect(chordEl.style.opacity).toBe('0.9');
  });

  it('rebuilds noteIdToGraphicalNote from GraphicSheet after a cache hit (rebuildGrayoutNoteMap)', () => {
    const { container } = makeContainerWithSvg();
    const controller = new OSMDController(container);
    // @ts-expect-error test mock access
    controller.loaded = true;

    const svgEl = makeSvgGElement();
    const graphicalNote = {
      sourceNote: {
        halfTone: 0, // midiNumber = 0 + 12 = 12（makeScore の note と同じ）
        ParentStaffEntry: {
          ParentStaff: { Id: 1 }, // staff = 1
          AbsoluteTimestamp: { RealValue: 0 }, // absoluteTick = 0
        },
      },
      getSVGGElement: vi.fn(() => svgEl),
    };
    // @ts-expect-error test mock access
    controller.osmd = {
      GraphicSheet: {
        MusicPages: [
          {
            MusicSystems: [
              {
                graphicalMeasures: [
                  [
                    {
                      MeasureNumber: 1,
                      staffEntries: [{ graphicalVoiceEntries: [{ notes: [graphicalNote] }] }],
                    },
                  ],
                ],
              },
            ],
          },
        ],
      },
    };

    const score = makeScore([{ number: 1, noteIds: ['P1-M1-N0'] }]);
    // @ts-expect-error test mock access to private rebuild method
    controller.rebuildGrayoutNoteMap(score);

    // @ts-expect-error test mock access to private noteId->GraphicalNote map
    expect(controller.noteIdToGraphicalNote.get('P1-M1-N0')).toBe(graphicalNote);
  });

  it('applies grayout on the cache-hit path (applyCache → rebuild → dims the SVG element)', () => {
    const { container } = makeContainerWithSvg();
    const controller = new OSMDController(container);
    // @ts-expect-error test mock access
    controller.loaded = true;

    const svgEl = makeSvgGElement();
    const graphicalNote = {
      sourceNote: {
        halfTone: 0,
        ParentStaffEntry: {
          ParentStaff: { Id: 1 },
          AbsoluteTimestamp: { RealValue: 0 },
        },
      },
      getSVGGElement: vi.fn(() => svgEl),
    };
    // @ts-expect-error test mock access
    controller.osmd = {
      cursor: { Hidden: true },
      GraphicSheet: {
        MusicPages: [
          {
            MusicSystems: [
              {
                graphicalMeasures: [
                  [
                    {
                      MeasureNumber: 1,
                      staffEntries: [{ graphicalVoiceEntries: [{ notes: [graphicalNote] }] }],
                    },
                  ],
                ],
              },
            ],
          },
        ],
      },
    };

    const score = makeScore([{ number: 1, noteIds: ['P1-M1-N0'] }]);
    const cache: ScoreMapCache = {
      version: 2,
      pageFormat: 'A4_P',
      zoomBase: 1.0,
      noteIdToCursorState: { 'P1-M1-N0': { iteratorIndex: 0 } },
      noteIdToSvgCoord: { 'P1-M1-N0': { x: 0, y: 0, pageIndex: 0 } },
      iteratorIndexToCursorStyle: {},
    };

    expect(controller.applyCache(score, cache, 1.0)).toBe(true);

    controller.setGrayedOutNotes(new Set(['P1-M1-N0']), 0.5);
    expect(graphicalNote.getSVGGElement).toHaveBeenCalled();
    expect(svgEl.style.opacity).toBe('0.5');

    controller.setGrayedOutNotes(new Set());
    expect(svgEl.style.opacity).toBe('');
  });

  it('keeps applyCache working when GraphicSheet is absent (rebuild is a defensive no-op)', () => {
    const { container } = makeContainerWithSvg();
    const controller = new OSMDController(container);
    // @ts-expect-error test mock access
    controller.loaded = true;
    // @ts-expect-error test mock access
    controller.osmd = { cursor: { Hidden: true } };

    const score = makeScore([{ number: 1, noteIds: ['P1-M1-N0'] }]);
    const cache: ScoreMapCache = {
      version: 2,
      pageFormat: 'A4_P',
      zoomBase: 1.0,
      noteIdToCursorState: { 'P1-M1-N0': { iteratorIndex: 0 } },
      noteIdToSvgCoord: { 'P1-M1-N0': { x: 0, y: 0, pageIndex: 0 } },
      iteratorIndexToCursorStyle: {},
    };

    expect(() => controller.applyCache(score, cache, 1.0)).not.toThrow();
    expect(controller.applyCache(score, cache, 1.0)).toBe(true);
    // 灰化は単に何もしない（落ちない）
    expect(() => controller.setGrayedOutNotes(new Set(['P1-M1-N0']))).not.toThrow();
  });
});

describe('OSMDController buildNoteIdMap -> GraphicalNote resolution for grayout (TASK-060)', () => {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  it('resolves noteId -> GraphicalNote via GNotesUnderCursor + sourceNote identity, and grayout dims its SVG element', () => {
    // OSMD Note相当のダミーオブジェクト（GraphicalNote.sourceNoteとの同一性比較に使う）。
    const osmdNoteObj = {};
    const svgElement = document.createElementNS(SVG_NS, 'g') as unknown as SVGGElement;
    const graphicalNoteStub = {
      sourceNote: osmdNoteObj,
      getSVGGElement: vi.fn(() => svgElement),
    };

    let iteratorIdx = 0;
    const mockCursor = {
      Hidden: true,
      show: vi.fn(),
      hide: vi.fn(),
      reset: vi.fn().mockImplementation(() => {
        iteratorIdx = 0;
        mockCursor.Iterator.EndReached = false;
      }),
      next: vi.fn().mockImplementation(() => {
        iteratorIdx++;
        mockCursor.Iterator.EndReached = iteratorIdx >= 1;
      }),
      GNotesUnderCursor: vi.fn(() => [graphicalNoteStub]),
      get Iterator() {
        return {
          CurrentMeasureIndex: 0,
          EndReached: iteratorIdx >= 1,
          get CurrentVoiceEntries() {
            return [{ Notes: [osmdNoteObj] }];
          },
        };
      },
    };

    const controller = new OSMDController(document.createElement('div'));
    // @ts-expect-error test mock access
    controller.loaded = true;
    // @ts-expect-error test mock access
    controller.osmd = { cursor: mockCursor };

    const score = makeScore([{ number: 1, noteIds: ['P1-M1-N0'] }]);
    controller.buildNoteIdMap(score);

    expect(mockCursor.GNotesUnderCursor).toHaveBeenCalled();

    controller.setGrayedOutNotes(new Set(['P1-M1-N0']), 0.4);
    expect(graphicalNoteStub.getSVGGElement).toHaveBeenCalled();
    expect(svgElement.style.opacity).toBe('0.4');

    controller.setGrayedOutNotes(new Set());
    expect(svgElement.style.opacity).toBe('');
  });

  it('does not resolve a GraphicalNote when GNotesUnderCursor is unavailable on the mock cursor (defensive)', () => {
    let iteratorIdx = 0;
    const mockCursor = {
      Hidden: true,
      show: vi.fn(),
      hide: vi.fn(),
      reset: vi.fn().mockImplementation(() => {
        iteratorIdx = 0;
        mockCursor.Iterator.EndReached = false;
      }),
      next: vi.fn().mockImplementation(() => {
        iteratorIdx++;
        mockCursor.Iterator.EndReached = iteratorIdx >= 1;
      }),
      get Iterator() {
        return {
          CurrentMeasureIndex: 0,
          EndReached: iteratorIdx >= 1,
          get CurrentVoiceEntries() {
            return [{ Notes: [{}] }];
          },
        };
      },
    };

    const controller = new OSMDController(document.createElement('div'));
    // @ts-expect-error test mock access
    controller.loaded = true;
    // @ts-expect-error test mock access
    controller.osmd = { cursor: mockCursor };

    const score = makeScore([{ number: 1, noteIds: ['P1-M1-N0'] }]);
    expect(() => controller.buildNoteIdMap(score)).not.toThrow();

    // @ts-expect-error test mock access to private noteId->GraphicalNote map
    expect(controller.noteIdToGraphicalNote.size).toBe(0);
    expect(() => controller.setGrayedOutNotes(new Set(['P1-M1-N0']))).not.toThrow();
  });
});

describe('OSMDController highlightNote (REQ-004-003/004)', () => {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  it('draws a green highlight circle for a correct note', () => {
    const container = document.createElement('div');
    const svg = document.createElementNS(SVG_NS, 'svg');
    container.appendChild(svg);

    const controller = new OSMDController(container);
    // @ts-expect-error test mock access to private note coordinate map
    controller.noteIdToSvgCoord = new Map([['P1-M1-N0', { x: 10, y: 20 }]]);

    controller.highlightNote('P1-M1-N0', 'correct');

    const layer = svg.querySelector('[id^="note-highlight-layer"]');
    expect(layer).not.toBeNull();
    const circle = layer?.querySelector('circle[data-note-id="P1-M1-N0"]');
    expect(circle).not.toBeNull();
    expect(circle?.getAttribute('data-highlight-color')).toBe('correct');
  });

  it('draws a red highlight circle for an incorrect note', () => {
    const container = document.createElement('div');
    const svg = document.createElementNS(SVG_NS, 'svg');
    container.appendChild(svg);

    const controller = new OSMDController(container);
    // @ts-expect-error test mock access to private note coordinate map
    controller.noteIdToSvgCoord = new Map([['P1-M1-N0', { x: 10, y: 20 }]]);

    controller.highlightNote('P1-M1-N0', 'incorrect');

    const circle = svg.querySelector('circle[data-note-id="P1-M1-N0"]');
    expect(circle?.getAttribute('data-highlight-color')).toBe('incorrect');
  });

  it('removes the highlight when set back to expected', () => {
    const container = document.createElement('div');
    const svg = document.createElementNS(SVG_NS, 'svg');
    container.appendChild(svg);

    const controller = new OSMDController(container);
    // @ts-expect-error test mock access to private note coordinate map
    controller.noteIdToSvgCoord = new Map([['P1-M1-N0', { x: 10, y: 20 }]]);

    controller.highlightNote('P1-M1-N0', 'correct');
    expect(svg.querySelector('[id^="note-highlight-layer"]')).not.toBeNull();

    controller.highlightNote('P1-M1-N0', 'expected');
    expect(svg.querySelector('[id^="note-highlight-layer"]')).toBeNull();
  });

  it('supports highlighting multiple notes independently', () => {
    const container = document.createElement('div');
    const svg = document.createElementNS(SVG_NS, 'svg');
    container.appendChild(svg);

    const controller = new OSMDController(container);
    // @ts-expect-error test mock access to private note coordinate map
    controller.noteIdToSvgCoord = new Map([
      ['P1-M1-N0', { x: 10, y: 20 }],
      ['P2-M1-N0', { x: 10, y: 120 }],
    ]);

    controller.highlightNote('P1-M1-N0', 'correct');
    controller.highlightNote('P2-M1-N0', 'incorrect');

    const layer = svg.querySelector('[id^="note-highlight-layer"]');
    expect(layer?.querySelectorAll('circle').length).toBe(2);
  });

  it('does nothing when there is no svg to draw onto', () => {
    const container = document.createElement('div');
    const controller = new OSMDController(container);
    expect(() => controller.highlightNote('P1-M1-N0', 'correct')).not.toThrow();
  });
});

describe('OSMDController measure click resolution (REQ-002-004)', () => {
  it('findNearestNoteId returns the closest noteId to the given point', () => {
    const controller = new OSMDController(document.createElement('div'));
    // @ts-expect-error test mock access to private note coordinate map
    controller.noteIdToSvgCoord = new Map([
      ['P1-M1-N0', { x: 10, y: 20 }],
      ['P1-M2-N0', { x: 100, y: 20 }],
    ]);

    // @ts-expect-error test access to private method
    const nearest = controller.findNearestNoteId({ x: 95, y: 22 });
    expect(nearest).toBe('P1-M2-N0');
  });

  it('returns null when there are no notes mapped yet', () => {
    const controller = new OSMDController(document.createElement('div'));
    // @ts-expect-error test access to private method
    expect(controller.findNearestNoteId({ x: 0, y: 0 })).toBeNull();
  });

  it('invokes the registered measure-click callback when the click lands inside a measure rect (REQ-002-004)', () => {
    const container = document.createElement('div');
    const controller = new OSMDController(container);
    // 小节 3 的判定矩形（viewBox 坐标，第 1 页）
    // @ts-expect-error test mock access to private measure rect map
    controller.measureNumberToRect = new Map([
      [3, [{ x: 150, y: 5, width: 100, height: 40, pageIndex: 0 }]],
    ]);
    // Bypass real DOM geometry (jsdom does not implement SVG viewBox/getBoundingClientRect
    // meaningfully); stub the screen-to-SVG conversion to a fixed point inside the rect.
    // @ts-expect-error test override of private method
    controller.screenToSvgCoord = () => ({ x: 190, y: 22, pageIndex: 0 });

    const onMeasureClick = vi.fn();
    controller.setOnMeasureClick(onMeasureClick);

    container.dispatchEvent(new MouseEvent('click', { clientX: 5, clientY: 5, bubbles: true }));

    expect(onMeasureClick).toHaveBeenCalledWith(3);
  });

  it('does not invoke the callback when the click lands outside every measure rect (blank area)', () => {
    const container = document.createElement('div');
    const controller = new OSMDController(container);
    // @ts-expect-error test mock access to private measure rect map
    controller.measureNumberToRect = new Map([
      [3, [{ x: 150, y: 5, width: 100, height: 40, pageIndex: 0 }]],
    ]);
    // 点击点在小节 3 矩形之外（空白区域）
    // @ts-expect-error test override of private method
    controller.screenToSvgCoord = () => ({ x: 50, y: 300, pageIndex: 0 });

    const onMeasureClick = vi.fn();
    controller.setOnMeasureClick(onMeasureClick);

    container.dispatchEvent(new MouseEvent('click', { clientX: 5, clientY: 5, bubbles: true }));

    expect(onMeasureClick).not.toHaveBeenCalled();
  });

  it('does not match a measure rect on a different page', () => {
    const controller = new OSMDController(document.createElement('div'));
    // @ts-expect-error test mock access to private measure rect map
    controller.measureNumberToRect = new Map([
      [3, [{ x: 150, y: 5, width: 100, height: 40, pageIndex: 0 }]],
    ]);
    // 点击第 2 页（pageIndex=1）同坐标，不应命中第 1 页的小节 3
    // @ts-expect-error test access to private method
    expect(controller.findMeasureAtPoint({ x: 190, y: 22, pageIndex: 1 })).toBeNull();
    // @ts-expect-error test access to private method
    expect(controller.findMeasureAtPoint({ x: 190, y: 22, pageIndex: 0 })).toBe(3);
  });

  it('collects measure rects from GraphicSheet with units x10 -> viewBox coordinates', () => {
    const controller = new OSMDController(document.createElement('div'));
    const gm = {
      MeasureNumber: 1,
      PositionAndShape: {
        AbsolutePosition: { x: 10, y: 20 },
        Size: { width: 30, height: 0 },
      },
      StaffLines: [
        { PositionAndShape: { RelativePosition: { y: 0 } } },
        { PositionAndShape: { RelativePosition: { y: 4 } }, StaffHeight: 1 },
      ],
    };
    // @ts-expect-error test mock access to private osmd
    controller.osmd = {
      GraphicSheet: { MusicPages: [{ MusicSystems: [{ graphicalMeasures: [[gm]] }] }] },
    };
    // @ts-expect-error test access to private method
    controller.collectMeasureRects();
    // 内部单位 ×10：x=100, y=(20+0)*10=200, width=300, height=(4-0)*10=40。
    // 底线即 lastLine.relY（=StaffHeight=4），不再叠加 StaffHeight（否则向下多延伸一个谱表高度）。
    // @ts-expect-error test access to private map
    expect(controller.measureNumberToRect.get(1)).toEqual([
      { x: 100, y: 200, width: 300, height: 40, pageIndex: 0 },
    ]);
  });

  it('stores one rect per staff (treble/bass separately) so the gap between them is not clickable', () => {
    const controller = new OSMDController(document.createElement('div'));
    // 高音谱：顶线 relY=0、底线 relY=4（=StaffHeight，内部单位）
    const trebleGm = {
      MeasureNumber: 1,
      PositionAndShape: {
        AbsolutePosition: { x: 10, y: 20 },
        Size: { width: 30, height: 0 },
      },
      StaffLines: [
        { PositionAndShape: { RelativePosition: { y: 0 } } },
        { PositionAndShape: { RelativePosition: { y: 4 } } },
      ],
    };
    // 低音谱：abs.y 比高音谱大（在下方），谱线相对位置相同
    const bassGm = {
      MeasureNumber: 1,
      PositionAndShape: {
        AbsolutePosition: { x: 10, y: 60 },
        Size: { width: 30, height: 0 },
      },
      StaffLines: [
        { PositionAndShape: { RelativePosition: { y: 0 } } },
        { PositionAndShape: { RelativePosition: { y: 4 } } },
      ],
    };
    // @ts-expect-error test mock access to private osmd
    controller.osmd = {
      GraphicSheet: { MusicPages: [{ MusicSystems: [{ graphicalMeasures: [[trebleGm, bassGm]] }] }] },
    };
    // @ts-expect-error test access to private method
    controller.collectMeasureRects();

    // @ts-expect-error test access to private map
    expect(controller.measureNumberToRect.get(1)).toEqual([
      { x: 100, y: 200, width: 300, height: 40, pageIndex: 0 }, // 高音谱
      { x: 100, y: 600, width: 300, height: 40, pageIndex: 0 }, // 低音谱
    ]);
    // 高音谱与低音谱之间的空白（y=400）不应命中
    // @ts-expect-error test access to private method
    expect(controller.findMeasureAtPoint({ x: 150, y: 400, pageIndex: 0 })).toBeNull();
    // 高音谱内、低音谱内各自命中
    // @ts-expect-error test access to private method
    expect(controller.findMeasureAtPoint({ x: 150, y: 220, pageIndex: 0 })).toBe(1);
    // @ts-expect-error test access to private method
    expect(controller.findMeasureAtPoint({ x: 150, y: 620, pageIndex: 0 })).toBe(1);
  });

  it('does not invoke the callback when no callback is registered', () => {
    const container = document.createElement('div');
    const controller = new OSMDController(container);
    // @ts-expect-error test mock access to private note coordinate map
    controller.noteIdToSvgCoord = new Map([['P1-M1-N0', { x: 10, y: 20 }]]);
    // @ts-expect-error test override of private method
    controller.screenToSvgCoord = () => ({ x: 10, y: 20 });

    expect(() => container.dispatchEvent(new MouseEvent('click', { bubbles: true }))).not.toThrow();
  });

  it('swallows the next click after suppressNextClick (drag pan must not jump to a measure)', () => {
    const container = document.createElement('div');
    const controller = new OSMDController(container);
    // @ts-expect-error test mock access to private measure rect map
    controller.measureNumberToRect = new Map([
      [3, [{ x: 150, y: 5, width: 100, height: 40, pageIndex: 0 }]],
    ]);
    // @ts-expect-error test override of private method
    controller.screenToSvgCoord = () => ({ x: 190, y: 22, pageIndex: 0 });

    const onMeasureClick = vi.fn();
    controller.setOnMeasureClick(onMeasureClick);

    // 拖动乐谱后：suppressNextClick → 紧随 mouseup 派发的 click 被吞掉（不跳小节）
    controller.suppressNextClick();
    container.dispatchEvent(new MouseEvent('click', { clientX: 5, clientY: 5, bubbles: true }));
    expect(onMeasureClick).not.toHaveBeenCalled();

    // 抑制标志已消费：下一次正常点击恢复跳转
    container.dispatchEvent(new MouseEvent('click', { clientX: 5, clientY: 5, bubbles: true }));
    expect(onMeasureClick).toHaveBeenCalledTimes(1);
  });

  it('lets the suppression window expire so a stale flag does not swallow a later genuine click', () => {
    const container = document.createElement('div');
    const controller = new OSMDController(container);
    // @ts-expect-error test mock access to private measure rect map
    controller.measureNumberToRect = new Map([
      [3, [{ x: 150, y: 5, width: 100, height: 40, pageIndex: 0 }]],
    ]);
    // @ts-expect-error test override of private method
    controller.screenToSvgCoord = () => ({ x: 190, y: 22, pageIndex: 0 });

    const onMeasureClick = vi.fn();
    controller.setOnMeasureClick(onMeasureClick);

    // 模拟「鼠标在窗口外松开」等 click 未触发的边界情况：标志超过时间窗口后过期
    controller.suppressNextClick();
    // @ts-expect-error test access to private field
    controller.suppressClickUntil = Date.now() - 1000;

    container.dispatchEvent(new MouseEvent('click', { clientX: 5, clientY: 5, bubbles: true }));
    expect(onMeasureClick).toHaveBeenCalledWith(3);
  });
});

describe('OSMDController note context menu (REQ-008-001/003/006, REQ-009-005)', () => {
  it('resolves the nearest noteId on contextmenu and invokes the registered callback with screen coordinates', () => {
    const container = document.createElement('div');
    const controller = new OSMDController(container);
    // @ts-expect-error test mock access to private note coordinate map
    controller.noteIdToSvgCoord = new Map([
      ['P1-M1-N0', { x: 10, y: 20 }],
      ['P1-M3-N0', { x: 200, y: 20 }],
    ]);
    // Bypass real DOM geometry (jsdom does not implement SVG viewBox/getBoundingClientRect
    // meaningfully); stub the screen-to-SVG conversion to a fixed point near M3.
    // @ts-expect-error test override of private method
    controller.screenToSvgCoord = () => ({ x: 190, y: 22 });

    const onNoteContextMenu = vi.fn();
    controller.setOnNoteContextMenu(onNoteContextMenu);

    const event = new MouseEvent('contextmenu', {
      clientX: 300,
      clientY: 400,
      bubbles: true,
      cancelable: true,
    });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    container.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(onNoteContextMenu).toHaveBeenCalledWith('P1-M3-N0', 300, 400);
  });

  it('prevents the default browser context menu even when no callback is registered', () => {
    const container = document.createElement('div');
    new OSMDController(container);

    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    expect(() => container.dispatchEvent(event)).not.toThrow();
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('does not invoke the callback when no note is near the click position', () => {
    const container = document.createElement('div');
    const controller = new OSMDController(container);
    // @ts-expect-error test override of private method
    controller.screenToSvgCoord = () => null;

    const onNoteContextMenu = vi.fn();
    controller.setOnNoteContextMenu(onNoteContextMenu);

    container.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));

    expect(onNoteContextMenu).not.toHaveBeenCalled();
  });

  it('unregisters the callback when set to null', () => {
    const container = document.createElement('div');
    const controller = new OSMDController(container);
    // @ts-expect-error test mock access to private note coordinate map
    controller.noteIdToSvgCoord = new Map([['P1-M1-N0', { x: 10, y: 20 }]]);
    // @ts-expect-error test override of private method
    controller.screenToSvgCoord = () => ({ x: 10, y: 20 });

    const onNoteContextMenu = vi.fn();
    controller.setOnNoteContextMenu(onNoteContextMenu);
    controller.setOnNoteContextMenu(null);

    container.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));

    expect(onNoteContextMenu).not.toHaveBeenCalled();
  });
});

describe('OSMDController buildNoteIdMap 照合ベース採番 (TASK-049)', () => {
  /**
   * OSMDカーソルが返すNoteのモックを構成する。実際のOSMD Noteの構造的部分型
   * （isRest()メソッド、halfTone、ParentStaffEntry.ParentStaff.Id、
   * ParentStaffEntry.AbsoluteTimestamp.RealValue）に合わせる。
   */
  function makeOsmdNote(opts: {
    isRest?: boolean;
    halfTone?: number;
    staffId: number;
    absTimestamp: number;
  }): unknown {
    return {
      isRest: () => opts.isRest ?? false,
      halfTone: opts.halfTone,
      ParentStaffEntry: {
        ParentStaff: { Id: opts.staffId },
        AbsoluteTimestamp: { RealValue: opts.absTimestamp },
      },
    };
  }

  it('resolves noteIds by matching (measure, tick, midiNumber, staff) even when OSMD returns voice entries in an order different from the parser XML order (2段譜・多声部)', () => {
    // パーサ採番: 1パート2段譜（staves=2）。XML文書順は
    // staff1のC4(chord開始)→staff1のE4(chord構成音)→<backup>→staff2のC2。
    // よってパーサのnoteIdは P1-M1-N0=C4(staff1) / N1=E4(staff1) / N2=C2(staff2)。
    const score: Score = {
      title: 'Two-Stave',
      parts: [{ id: 'P1', name: 'Piano', hand: 'right', clef: 'treble' }],
      tempo: 120,
      ticksPerQuarter: 480,
      tempoMap: [{ tick: 0, bpm: 120 }],
      timeSignature: { beats: 4, beatType: 4 },
      keySignature: 0,
      pedalSpans: [],
      measures: [
        {
          number: 1,
          startTick: 0,
          notes: [
            {
              id: 'P1-M1-N0',
              partId: 'P1',
              measureNumber: 1,
              noteIndex: 0,
              pitch: { step: 'C', octave: 4 },
              midiNumber: 60,
              duration: 1,
              startTick: 0,
              durationTicks: 480,
              startSeconds: 0,
              durationSeconds: 0,
              voice: 1,
              isChord: false,
              isRest: false,
              staff: 1,
              hand: 'right',
            },
            {
              id: 'P1-M1-N1',
              partId: 'P1',
              measureNumber: 1,
              noteIndex: 1,
              pitch: { step: 'E', octave: 4 },
              midiNumber: 64,
              duration: 1,
              startTick: 0,
              durationTicks: 480,
              startSeconds: 0,
              durationSeconds: 0,
              voice: 1,
              isChord: true,
              isRest: false,
              staff: 1,
              hand: 'right',
            },
            {
              id: 'P1-M1-N2',
              partId: 'P1',
              measureNumber: 1,
              noteIndex: 0,
              pitch: { step: 'C', octave: 2 },
              midiNumber: 36,
              duration: 1,
              startTick: 0,
              durationTicks: 480,
              startSeconds: 0,
              durationSeconds: 0,
              voice: 2,
              isChord: false,
              isRest: false,
              staff: 2,
              hand: 'left',
            },
          ],
        },
      ],
    };

    // OSMDカーソル: 単一のイテレータステップ（tick=0）で、staff2(左手)のVoiceEntryを
    // staff1(右手・和音)より先に返す。パーサのXML順（staff1が先）とは逆順であり、
    // 旧実装（OSMDの走査順で連番を振り直す方式）ならP1-M1-N0が左手C2に、
    // P1-M1-N1/N2が右手のC4/E4に誤って対応してしまう状況を再現する。
    let idx = 0;
    const mockCursor = {
      Hidden: true,
      show: vi.fn(),
      hide: vi.fn(),
      reset: vi.fn(() => {
        idx = 0;
      }),
      next: vi.fn(() => {
        idx++;
      }),
      get Iterator() {
        return {
          CurrentMeasureIndex: 0,
          EndReached: idx >= 1,
          get CurrentVoiceEntries() {
            return [
              { Notes: [makeOsmdNote({ staffId: 2, absTimestamp: 0, halfTone: 24 })] }, // staff2 C2 (先に出現)
              {
                Notes: [
                  makeOsmdNote({ staffId: 1, absTimestamp: 0, halfTone: 48 }), // staff1 C4
                  makeOsmdNote({ staffId: 1, absTimestamp: 0, halfTone: 52 }), // staff1 E4 (chord)
                ],
              },
            ];
          },
        };
      },
    };

    const controller = new OSMDController(document.createElement('div'));
    // @ts-expect-error test mock access
    controller.loaded = true;
    // @ts-expect-error test mock access
    controller.osmd = { cursor: mockCursor };

    const map = controller.buildNoteIdMap(score);

    expect(map.size).toBe(3);
    expect(map.has('P1-M1-N0')).toBe(true); // C4 (staff1)
    expect(map.has('P1-M1-N1')).toBe(true); // E4 (staff1, chord)
    expect(map.has('P1-M1-N2')).toBe(true); // C2 (staff2)
  });

  it('fallback: notes that fail tick matching are paired by order (7連音などの累積誤差対策)', () => {
    const score: Score = {
      title: 'Unmatched',
      parts: [{ id: 'P1', name: 'Piano', hand: 'right', clef: 'treble' }],
      tempo: 120,
      ticksPerQuarter: 480,
      tempoMap: [{ tick: 0, bpm: 120 }],
      timeSignature: { beats: 4, beatType: 4 },
      keySignature: 0,
      pedalSpans: [],
      measures: [
        {
          number: 1,
          startTick: 0,
          notes: [
            {
              id: 'P1-M1-N0',
              partId: 'P1',
              measureNumber: 1,
              noteIndex: 0,
              pitch: { step: 'C', octave: 4 },
              midiNumber: 60,
              duration: 1,
              startTick: 0,
              durationTicks: 480,
              startSeconds: 0,
              durationSeconds: 0,
              voice: 1,
              isChord: false,
              isRest: false,
              staff: 1,
            },
            {
              id: 'P1-M1-N1',
              partId: 'P1',
              measureNumber: 1,
              noteIndex: 1,
              pitch: { step: 'D', octave: 4 },
              midiNumber: 62,
              duration: 1,
              startTick: 480,
              durationTicks: 480,
              startSeconds: 0,
              durationSeconds: 0,
              voice: 1,
              isChord: false,
              isRest: false,
              staff: 1,
            },
          ],
        },
      ],
    };

    // OSMD側のabsoluteTickがパーサ側startTickと大きくずれていても（TICK_MATCH_TOLERANCE超え）、
    // 順序が一致していれば順序ベース兜底で1:1対応付けされる。
    let idx = 0;
    const mockCursor = {
      Hidden: true,
      show: vi.fn(),
      hide: vi.fn(),
      reset: vi.fn(() => {
        idx = 0;
      }),
      next: vi.fn(() => {
        idx++;
      }),
      get Iterator() {
        return {
          CurrentMeasureIndex: 0,
          EndReached: idx >= 2,
          get CurrentVoiceEntries() {
            // tickがずれている（100ではなく10,000など）が、順序はscoreと一致している。
            const ticks = [10, 500];
            const halftones = [48, 50]; // C4, D4
            return [{ Notes: [makeOsmdNote({ staffId: 1, absTimestamp: ticks[idx] / 480 / 4, halfTone: halftones[idx] })] }];
          },
        };
      },
    };

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const controller = new OSMDController(document.createElement('div'));
    // @ts-expect-error test mock access
    controller.loaded = true;
    // @ts-expect-error test mock access
    controller.osmd = { cursor: mockCursor };

    const map = controller.buildNoteIdMap(score);

    // 順序ベース兜底で両方とも対応付けられる
    expect(map.size).toBe(2);
    expect(map.has('P1-M1-N0')).toBe(true);
    expect(map.has('P1-M1-N1')).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('skips notes that cannot be resolved even by order fallback and logs a warning (誤対応を作らない)', () => {
    const score: Score = {
      title: 'Unmatched',
      parts: [{ id: 'P1', name: 'Piano', hand: 'right', clef: 'treble' }],
      tempo: 120,
      ticksPerQuarter: 480,
      tempoMap: [{ tick: 0, bpm: 120 }],
      timeSignature: { beats: 4, beatType: 4 },
      keySignature: 0,
      pedalSpans: [],
      measures: [
        {
          number: 1,
          startTick: 0,
          notes: [
            {
              id: 'P1-M1-N0',
              partId: 'P1',
              measureNumber: 1,
              noteIndex: 0,
              pitch: { step: 'C', octave: 4 },
              midiNumber: 60,
              duration: 1,
              startTick: 0,
              durationTicks: 480,
              startSeconds: 0,
              durationSeconds: 0,
              voice: 1,
              isChord: false,
              isRest: false,
              staff: 1,
            },
          ],
        },
      ],
    };

    // OSMD側にscoreに存在しない余分な音（D5=midi74）を含める。
    // score小節1のcandidateは1つだけなので、兜底で対応付けられるのは1つまで。
    // 残った余剰エントリは対応付けられず警告される。
    let idx = 0;
    const mockCursor = {
      Hidden: true,
      show: vi.fn(),
      hide: vi.fn(),
      reset: vi.fn(() => {
        idx = 0;
      }),
      next: vi.fn(() => {
        idx++;
      }),
      get Iterator() {
        return {
          CurrentMeasureIndex: 0,
          EndReached: idx >= 1,
          get CurrentVoiceEntries() {
            // tickが大きくずれていて（TICK_MATCH_TOLERANCE超え）、音高もscoreと一致しない。
            // D4=midi62 と D5=midi74。score小節1のcandidate(C4)は1つだけ。
            return [
              { Notes: [makeOsmdNote({ staffId: 1, absTimestamp: 100 / 480 / 4, halfTone: 50 })] }, // D4
              { Notes: [makeOsmdNote({ staffId: 1, absTimestamp: 101 / 480 / 4, halfTone: 62 })] }, // D5
            ];
          },
        };
      },
    };

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const controller = new OSMDController(document.createElement('div'));
    // @ts-expect-error test mock access
    controller.loaded = true;
    // @ts-expect-error test mock access
    controller.osmd = { cursor: mockCursor };

    const map = controller.buildNoteIdMap(score);

    // 兜底でscore小節1のcandidate(C4)に1つだけ対応付けられる。
    // 残った余剰エントリ（もう1つ）は対応付けられず、警告が出る。
    expect(map.size).toBe(1);
    expect(map.has('P1-M1-N0')).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('OSMDController buildNoteIdMap 和音の符頭単位座標オフセット (TASK-050)', () => {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function makeOsmdNote(opts: {
    halfTone: number;
    staffId?: number;
    absTimestamp?: number;
  }): unknown {
    return {
      isRest: () => false,
      halfTone: opts.halfTone,
      ParentStaffEntry: {
        ParentStaff: { Id: opts.staffId ?? 1 },
        AbsoluteTimestamp: { RealValue: opts.absTimestamp ?? 0 },
      },
    };
  }

  function makeRectStub(rect: {
    left: number;
    top: number;
    width: number;
    height: number;
  }): DOMRect {
    return {
      ...rect,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      x: rect.left,
      y: rect.top,
      toJSON: () => rect,
    } as DOMRect;
  }

  it('和音（同一カーソル位置の複数構成音）の指番号描画座標が音高順に重ならず配置される', () => {
    const container = document.createElement('div');
    const svg = document.createElementNS(SVG_NS, 'svg');
    container.appendChild(svg);
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue(
      makeRectStub({ left: 0, top: 0, width: 500, height: 500 })
    );

    const cursorElement = {
      getBoundingClientRect: () => makeRectStub({ left: 50, top: 60, width: 10, height: 20 }),
      style: { cssText: '' },
    } as unknown as HTMLImageElement;

    let idx = 0;
    const mockCursor = {
      Hidden: true,
      show: vi.fn(),
      hide: vi.fn(),
      cursorElement,
      reset: vi.fn(() => {
        idx = 0;
      }),
      next: vi.fn(() => {
        idx++;
      }),
      get Iterator() {
        return {
          CurrentMeasureIndex: 0,
          EndReached: idx >= 1,
          get CurrentVoiceEntries() {
            return [
              {
                // MusicXML順(XML文書順)はC4(和音開始)→E4(chord)→G4(chord)。
                Notes: [
                  makeOsmdNote({ halfTone: 48 }), // C4
                  makeOsmdNote({ halfTone: 55 }), // G4
                  makeOsmdNote({ halfTone: 52 }), // E4
                ],
              },
            ];
          },
        };
      },
    };

    const controller = new OSMDController(container);
    // @ts-expect-error test mock access
    controller.loaded = true;
    // @ts-expect-error test mock access
    controller.osmd = { cursor: mockCursor };

    const score: Score = {
      title: 'Chord',
      parts: [{ id: 'P1', name: 'Piano', hand: 'right', clef: 'treble' }],
      tempo: 120,
      ticksPerQuarter: 480,
      tempoMap: [{ tick: 0, bpm: 120 }],
      timeSignature: { beats: 4, beatType: 4 },
      keySignature: 0,
      pedalSpans: [],
      measures: [
        {
          number: 1,
          startTick: 0,
          notes: [
            {
              id: 'P1-M1-N0',
              partId: 'P1',
              measureNumber: 1,
              noteIndex: 0,
              pitch: { step: 'C', octave: 4 },
              midiNumber: 60,
              duration: 1,
              startTick: 0,
              durationTicks: 480,
              startSeconds: 0,
              durationSeconds: 0.5,
              voice: 1,
              isChord: false,
              isRest: false,
              staff: 1,
            },
            {
              id: 'P1-M1-N1',
              partId: 'P1',
              measureNumber: 1,
              noteIndex: 1,
              pitch: { step: 'E', octave: 4 },
              midiNumber: 64,
              duration: 1,
              startTick: 0,
              durationTicks: 480,
              startSeconds: 0,
              durationSeconds: 0.5,
              voice: 1,
              isChord: true,
              isRest: false,
              staff: 1,
            },
            {
              id: 'P1-M1-N2',
              partId: 'P1',
              measureNumber: 1,
              noteIndex: 2,
              pitch: { step: 'G', octave: 4 },
              midiNumber: 67,
              duration: 1,
              startTick: 0,
              durationTicks: 480,
              startSeconds: 0,
              durationSeconds: 0.5,
              voice: 1,
              isChord: true,
              isRest: false,
              staff: 1,
            },
          ],
        },
      ],
    };

    controller.buildNoteIdMap(score);

    // @ts-expect-error test access to private coordinate map
    const coordMap: Map<string, { x: number; y: number }> = controller.noteIdToSvgCoord;
    const c0 = coordMap.get('P1-M1-N0'); // C4
    const c1 = coordMap.get('P1-M1-N1'); // E4
    const c2 = coordMap.get('P1-M1-N2'); // G4

    expect(c0).toBeDefined();
    expect(c1).toBeDefined();
    expect(c2).toBeDefined();

    // 同じ拍位置なのでx座標は共通のまま
    expect(c0!.x).toBe(c1!.x);
    expect(c1!.x).toBe(c2!.x);

    // y座標は3音とも互いに異なる(重ならない)
    expect(new Set([c0!.y, c1!.y, c2!.y]).size).toBe(3);

    // 音高が高いほど楽譜上で上(yが小さい)に描画される
    expect(c2!.y).toBeLessThan(c1!.y); // G4 > E4
    expect(c1!.y).toBeLessThan(c0!.y); // E4 > C4
  });

  it('renderFingeringLayerで和音構成音ごとに異なる座標へ指番号が描画される', () => {
    const container = document.createElement('div');
    const svg = document.createElementNS(SVG_NS, 'svg');
    container.appendChild(svg);

    const controller = new OSMDController(container);
    // @ts-expect-error test mock access to private note coordinate map
    controller.noteIdToSvgCoord = new Map([
      ['P1-M1-N0', { x: 10, y: 30 }],
      ['P1-M1-N1', { x: 10, y: 20 }],
      ['P1-M1-N2', { x: 10, y: 10 }],
    ]);

    controller.showFingerings([
      { noteId: 'P1-M1-N0', finger: 1, isApproved: true },
      { noteId: 'P1-M1-N1', finger: 3, isApproved: true },
      { noteId: 'P1-M1-N2', finger: 5, isApproved: true },
    ]);

    const texts = Array.from(svg.querySelectorAll('[id^="fingering-layer"] text'));
    expect(texts).toHaveLength(3);
    const positions = texts.map((t) => ({
      x: t.getAttribute('x'),
      y: t.getAttribute('y'),
      finger: t.textContent,
    }));
    const ys = new Set(positions.map((p) => p.y));
    expect(ys.size).toBe(3);
  });

  it('指番号は視認できる大きさ・濃い色・白フチで描画される（2026-07-05 実機フィードバック）', () => {
    const container = document.createElement('div');
    const svg = document.createElementNS(SVG_NS, 'svg');
    container.appendChild(svg);

    const controller = new OSMDController(container);
    // @ts-expect-error test mock access to private note coordinate map
    controller.noteIdToSvgCoord = new Map([
      ['P1-M1-N0', { x: 10, y: 30 }],
      ['P1-M1-N1', { x: 20, y: 30 }],
    ]);

    controller.showFingerings([
      { noteId: 'P1-M1-N0', finger: 2, isApproved: false },
      { noteId: 'P1-M1-N1', finger: 4, isApproved: true },
    ]);

    const texts = Array.from(svg.querySelectorAll('[id^="fingering-layer"] text'));
    expect(texts).toHaveLength(2);

    for (const text of texts) {
      // 小さすぎて読めない問題（旧: 8px）の再発防止
      expect(Number(text.getAttribute('font-size'))).toBeGreaterThanOrEqual(11);
      expect(text.getAttribute('font-weight')).toBe('bold');
      // 五線・符幹に重なっても読めるよう白フチ（paint-order: stroke）を付ける
      expect(text.getAttribute('stroke')).toBe('#ffffff');
      expect(text.getAttribute('paint-order')).toBe('stroke');
    }

    // 未承認（提案中）でも淡色ではなく濃色（中灰）で描画される
    const suggested = texts.find((t) => t.textContent === '2')!;
    expect(suggested.getAttribute('fill')).toBe('#52525b');
    // 承認済みは提案中と区別できる濃色
    const approved = texts.find((t) => t.textContent === '4')!;
    expect(approved.getAttribute('fill')).toBe('#15803d');
  });
});

describe('computeFingeringCoords（段別の指番号座標、2026-07-05 実機フィードバック）', () => {
  function makeNote(id: string, midiNumber: number, staff?: number): Note {
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
      ...(staff !== undefined ? { staff, hand: staff >= 2 ? 'left' : 'right' } : {}),
    } as Note;
  }

  const coord = { x: 100, y: 50, height: 80 };

  it('上段（staff1・右手）と下段（staff2・左手）の指番号が縦に分離される', () => {
    const notes = [
      makeNote('P1-M1-N0', 72, 1), // 右手 C5
      makeNote('P1-M1-N1', 76, 1), // 右手 E5
      makeNote('P1-M1-N2', 48, 2), // 左手 C3
      makeNote('P1-M1-N3', 52, 2), // 左手 E3
    ];

    const coords = computeFingeringCoords(notes, coord);

    // 上段はカーソル上端（y=50）周辺
    const upperYs = [coords.get('P1-M1-N0')!.y, coords.get('P1-M1-N1')!.y];
    for (const y of upperYs) {
      expect(Math.abs(y - coord.y)).toBeLessThanOrEqual(10);
    }
    // 下段はカーソル下端（y+height=130）より下
    const lowerYs = [coords.get('P1-M1-N2')!.y, coords.get('P1-M1-N3')!.y];
    for (const y of lowerYs) {
      expect(y).toBeGreaterThan(coord.y + coord.height);
    }
    // 上段グループと下段グループが混ざらない
    expect(Math.max(...upperYs)).toBeLessThan(Math.min(...lowerYs));
    // 同一段内でも重ならない
    expect(new Set(upperYs).size).toBe(2);
    expect(new Set(lowerYs).size).toBe(2);
  });

  it('上段のみの単音は従来どおりカーソル上端の座標になる', () => {
    const coords = computeFingeringCoords([makeNote('P1-M1-N0', 60, 1)], coord);
    expect(coords.get('P1-M1-N0')).toEqual({ x: coord.x, y: coord.y });
  });

  it('staff未指定のノーツは上段（右手側）として扱う（後方互換）', () => {
    const coords = computeFingeringCoords([makeNote('P1-M1-N0', 60)], coord);
    expect(coords.get('P1-M1-N0')).toEqual({ x: coord.x, y: coord.y });
  });

  it('下段の和音は音高降順（高い音が上）でカーソル下端の下に縦積みされる', () => {
    const notes = [
      makeNote('P1-M1-N0', 48, 2), // C3（低）
      makeNote('P1-M1-N1', 55, 2), // G3（高）
    ];

    const coords = computeFingeringCoords(notes, coord);
    const high = coords.get('P1-M1-N1')!;
    const low = coords.get('P1-M1-N0')!;
    expect(high.y).toBeGreaterThan(coord.y + coord.height);
    expect(low.y).toBeGreaterThan(high.y);
  });
});

describe('OSMDController resize handling (ResizeObserver, TASK-049)', () => {
  function installFakeResizeObserver(): {
    getCallback: () => (() => void) | undefined;
    disconnectMock: ReturnType<typeof vi.fn>;
    observeMock: ReturnType<typeof vi.fn>;
    restore: () => void;
  } {
    let callback: (() => void) | undefined;
    const disconnectMock = vi.fn();
    const observeMock = vi.fn();
    class FakeResizeObserver {
      constructor(cb: () => void) {
        callback = cb;
      }
      observe = observeMock;
      disconnect = disconnectMock;
    }
    const original = globalThis.ResizeObserver;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).ResizeObserver = FakeResizeObserver;
    return {
      getCallback: () => callback,
      disconnectMock,
      observeMock,
      restore: () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).ResizeObserver = original;
      },
    };
  }

  /**
   * jsdomのHTMLElementはレイアウト計算を行わずclientWidth/clientHeightが常に0のため、
   * TASK-106の不可視スキップガードを回避してリサイズ処理本体を検証するテストでは
   * コンテナに非0サイズを明示的に定義する。
   */
  function setContainerSize(container: HTMLDivElement, width: number, height: number): void {
    Object.defineProperty(container, 'clientWidth', { value: width, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: height, configurable: true });
  }

  it('does NOT re-render after a debounced resize in A4 fixed-width mode (layout is window-independent)', () => {
    vi.useFakeTimers();
    const ro = installFakeResizeObserver();

    try {
      const container = document.createElement('div');
      setContainerSize(container, 800, 600);
      const controller = new OSMDController(container);
      expect(ro.observeMock).toHaveBeenCalledWith(container);

      const mockRender = vi.fn();
      // @ts-expect-error test mock access to private osmd
      controller.osmd = { cursor: null, render: mockRender, zoom: 1 };
      // @ts-expect-error test mock access
      controller.loaded = true;

      const score: Score = {
        title: 'T',
        parts: [],
        tempo: 120,
        ticksPerQuarter: 480,
        tempoMap: [{ tick: 0, bpm: 120 }],
        timeSignature: { beats: 4, beatType: 4 },
        keySignature: 0,
        pedalSpans: [],
        measures: [],
      };
      // lastScoreを設定するため、一度素通しで呼んでおく（cursor==nullのため即return）。
      controller.buildNoteIdMap(score);

      const buildSpy = vi.spyOn(controller, 'buildNoteIdMap');

      const callback = ro.getCallback();
      expect(callback).toBeDefined();
      callback?.();

      // デバウンス中は何も実行されない。
      expect(mockRender).not.toHaveBeenCalled();

      vi.advanceTimersByTime(250); // 250ms経過
      // A4 固定幅モードでは resize による再レンダリングは行われない
      expect(mockRender).not.toHaveBeenCalled();
      expect(buildSpy).not.toHaveBeenCalled();
    } finally {
      ro.restore();
      vi.useRealTimers();
    }
  });

  it('does not run render when resize fires repeatedly within the debounce window (A4 fixed-width mode)', () => {
    vi.useFakeTimers();
    const ro = installFakeResizeObserver();

    try {
      const container = document.createElement('div');
      setContainerSize(container, 800, 600);
      const controller = new OSMDController(container);
      const mockRender = vi.fn();
      // @ts-expect-error test mock access
      controller.osmd = { cursor: null, render: mockRender, zoom: 1 };
      // @ts-expect-error test mock access
      controller.loaded = true;

      const callback = ro.getCallback();
      callback?.();
      vi.advanceTimersByTime(100);
      callback?.(); // タイマーがリセットされるはず
      vi.advanceTimersByTime(100);
      callback?.(); // 再度リセット
      vi.advanceTimersByTime(249);
      expect(mockRender).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      // A4 固定幅モードでは resize による再レンダリングは行われない
      expect(mockRender).not.toHaveBeenCalled();
    } finally {
      ro.restore();
      vi.useRealTimers();
    }
  });

  it('does nothing before load() completes (loaded=false)', () => {
    vi.useFakeTimers();
    const ro = installFakeResizeObserver();

    try {
      const container = document.createElement('div');
      const controller = new OSMDController(container);
      const mockRender = vi.fn();
      // @ts-expect-error test mock access
      controller.osmd = { cursor: null, render: mockRender, zoom: 1 };
      // loaded は既定でfalse

      const callback = ro.getCallback();
      callback?.();
      vi.advanceTimersByTime(1000);

      expect(mockRender).not.toHaveBeenCalled();
    } finally {
      ro.restore();
      vi.useRealTimers();
    }
  });
});

describe('OSMDController ライブラリ往復時の再レンダリング抑止 (TASK-106)', () => {
  function installFakeResizeObserver(): {
    getCallback: () => (() => void) | undefined;
    restore: () => void;
  } {
    let callback: (() => void) | undefined;
    class FakeResizeObserver {
      constructor(cb: () => void) {
        callback = cb;
      }
      observe = vi.fn();
      disconnect = vi.fn();
    }
    const original = globalThis.ResizeObserver;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).ResizeObserver = FakeResizeObserver;
    return {
      getCallback: () => callback,
      restore: () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).ResizeObserver = original;
      },
    };
  }

  function setContainerSize(container: HTMLDivElement, width: number, height: number): void {
    Object.defineProperty(container, 'clientWidth', { value: width, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: height, configurable: true });
  }

  it('コンテナが不可視（サイズ0）の間のリサイズ通知ではrenderが呼ばれない（SVGを破棄しない）', () => {
    vi.useFakeTimers();
    const ro = installFakeResizeObserver();

    try {
      const container = document.createElement('div');
      setContainerSize(container, 800, 600);
      const controller = new OSMDController(container);
      const mockRender = vi.fn();
      // @ts-expect-error test mock access
      controller.osmd = { cursor: null, render: mockRender, zoom: 1 };
      // @ts-expect-error test mock access
      controller.loaded = true;
      // @ts-expect-error test mock access to private rendered-size cache
      controller.lastRenderedWidth = 800;
      // @ts-expect-error test mock access to private rendered-size cache
      controller.lastRenderedHeight = 600;

      setContainerSize(container, 0, 0); // display:noneでの不可視化を模す
      ro.getCallback()?.();
      vi.advanceTimersByTime(250);

      expect(mockRender).not.toHaveBeenCalled();
    } finally {
      ro.restore();
      vi.useRealTimers();
    }
  });

  it('隠す→同一サイズで戻す往復ではrenderが呼ばれない（即時復帰）', () => {
    vi.useFakeTimers();
    const ro = installFakeResizeObserver();

    try {
      const container = document.createElement('div');
      setContainerSize(container, 800, 600);
      const controller = new OSMDController(container);
      const mockRender = vi.fn();
      // @ts-expect-error test mock access
      controller.osmd = { cursor: null, render: mockRender, zoom: 1 };
      // @ts-expect-error test mock access
      controller.loaded = true;
      // @ts-expect-error test mock access to private rendered-size cache
      controller.lastRenderedWidth = 800;
      // @ts-expect-error test mock access to private rendered-size cache
      controller.lastRenderedHeight = 600;

      // 同一サイズへの復帰通知（ライブラリ→楽譜へ戻る想定）。
      ro.getCallback()?.();
      vi.advanceTimersByTime(250);

      expect(mockRender).not.toHaveBeenCalled();
    } finally {
      ro.restore();
      vi.useRealTimers();
    }
  });

  it('描画時サイズと異なるサイズへの変化でもrenderは呼ばれない（A4固定幅モード）', () => {
    vi.useFakeTimers();
    const ro = installFakeResizeObserver();

    try {
      const container = document.createElement('div');
      setContainerSize(container, 800, 600);
      const controller = new OSMDController(container);
      const mockRender = vi.fn();
      // @ts-expect-error test mock access
      controller.osmd = { cursor: null, render: mockRender, zoom: 1 };
      // @ts-expect-error test mock access
      controller.loaded = true;
      // @ts-expect-error test mock access to private rendered-size cache
      controller.lastRenderedWidth = 800;
      // @ts-expect-error test mock access to private rendered-size cache
      controller.lastRenderedHeight = 600;

      setContainerSize(container, 1000, 600); // ウィンドウリサイズ等による実際のサイズ変化
      ro.getCallback()?.();
      vi.advanceTimersByTime(250);

      // A4 固定幅モードでは resize による再レンダリングは行われない
      expect(mockRender).not.toHaveBeenCalled();
    } finally {
      ro.restore();
      vi.useRealTimers();
    }
  });
});

describe('OSMDController dispose (TASK-049)', () => {
  it('disconnects the ResizeObserver and removes click/contextmenu listeners from the container', () => {
    let callback: (() => void) | undefined;
    const disconnectMock = vi.fn();
    const observeMock = vi.fn();
    class FakeResizeObserver {
      constructor(cb: () => void) {
        callback = cb;
      }
      observe = observeMock;
      disconnect = disconnectMock;
    }
    const original = globalThis.ResizeObserver;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).ResizeObserver = FakeResizeObserver;

    try {
      const container = document.createElement('div');
      const removeEventListenerSpy = vi.spyOn(container, 'removeEventListener');
      const controller = new OSMDController(container);
      expect(callback).toBeDefined();

      controller.dispose();

      expect(disconnectMock).toHaveBeenCalledTimes(1);
      expect(removeEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('contextmenu', expect.any(Function));
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).ResizeObserver = original;
    }
  });

  it('does not throw when a pending debounced resize fires after dispose (defensive no-op)', () => {
    vi.useFakeTimers();
    let callback: (() => void) | undefined;
    class FakeResizeObserver {
      constructor(cb: () => void) {
        callback = cb;
      }
      observe = vi.fn();
      disconnect = vi.fn();
    }
    const original = globalThis.ResizeObserver;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).ResizeObserver = FakeResizeObserver;

    try {
      const container = document.createElement('div');
      const controller = new OSMDController(container);
      const mockRender = vi.fn();
      // @ts-expect-error test mock access
      controller.osmd = { cursor: null, render: mockRender, zoom: 1 };
      // @ts-expect-error test mock access
      controller.loaded = true;

      callback?.();
      controller.dispose();

      expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
      expect(mockRender).not.toHaveBeenCalled();
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).ResizeObserver = original;
      vi.useRealTimers();
    }
  });

  it('does not throw when public methods are called after dispose', () => {
    const container = document.createElement('div');
    const controller = new OSMDController(container);

    controller.dispose();

    expect(() => controller.moveCursor('P1-M1-N0')).not.toThrow();
    expect(() => controller.highlightNote('P1-M1-N0', 'correct')).not.toThrow();
    expect(() => controller.setGrayedOutNotes(new Set())).not.toThrow();
  });

  it('restores dimmed grayout SVG elements to their original opacity on dispose (TASK-060)', () => {
    const container = document.createElement('div');
    const svg = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'svg'
    ) as unknown as SVGSVGElement;
    container.appendChild(svg);
    const controller = new OSMDController(container);
    const el = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'g'
    ) as unknown as SVGGElement;
    // @ts-expect-error test mock access to private noteId->GraphicalNote map
    controller.noteIdToGraphicalNote = new Map([['P1-M1-N0', { getSVGGElement: () => el }]]);

    controller.setGrayedOutNotes(new Set(['P1-M1-N0']));
    expect(el.style.opacity).toBe('0.5');

    controller.dispose();

    expect(el.style.opacity).toBe('');
  });
});

describe('OSMDController fingering edit mode', () => {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function makeControllerWithFingeringLayer(): {
    container: HTMLDivElement;
    controller: OSMDController;
    getTexts: () => Element[];
  } {
    const container = document.createElement('div');
    const svg = document.createElementNS(SVG_NS, 'svg');
    container.appendChild(svg);
    const controller = new OSMDController(container);
    // @ts-expect-error test mock access to private note coordinate map
    controller.noteIdToSvgCoord = new Map([
      ['P1-M1-N0', { x: 10, y: 30 }],
      ['P1-M1-N1', { x: 20, y: 30 }],
    ]);
    controller.showFingerings([
      { noteId: 'P1-M1-N0', finger: 2, isApproved: true },
      { noteId: 'P1-M1-N1', finger: 4, isApproved: false },
    ]);
    return {
      container,
      controller,
      getTexts: () => Array.from(svg.querySelectorAll('[id^="fingering-layer"] text')),
    };
  }

  it('renders fingering digits with data-note-id and keeps pointer-events: none by default', () => {
    const { getTexts } = makeControllerWithFingeringLayer();
    const texts = getTexts();
    expect(texts).toHaveLength(2);
    expect(texts[0].getAttribute('data-note-id')).toBe('P1-M1-N0');
    expect(texts[1].getAttribute('data-note-id')).toBe('P1-M1-N1');
    // 非编辑模式：数字不可点击（不拦截小节点击）
    expect(texts[0].getAttribute('pointer-events')).toBe('none');
  });

  it('switches digits to clickable when edit mode is turned on (re-renders existing layer)', () => {
    const { controller, getTexts } = makeControllerWithFingeringLayer();
    controller.setFingeringEditMode(true);
    for (const text of getTexts()) {
      expect(text.getAttribute('pointer-events')).toBe('auto');
    }
    // 关闭后恢复不可点击
    controller.setFingeringEditMode(false);
    for (const text of getTexts()) {
      expect(text.getAttribute('pointer-events')).toBe('none');
    }
  });

  it('clicking a fingering digit in edit mode invokes the callback and does not jump to a measure', () => {
    const { container, controller, getTexts } = makeControllerWithFingeringLayer();
    controller.setFingeringEditMode(true);

    const onFingeringClick = vi.fn();
    controller.setOnFingeringClick(onFingeringClick);
    const onMeasureClick = vi.fn();
    controller.setOnMeasureClick(onMeasureClick);

    const text = getTexts()[0];
    text.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 5, clientY: 5 }));

    expect(onFingeringClick).toHaveBeenCalledWith('P1-M1-N0', 5, 5);
    expect(onMeasureClick).not.toHaveBeenCalled();
  });

  it('does not invoke the fingering callback when edit mode is off', () => {
    const { container, controller, getTexts } = makeControllerWithFingeringLayer();
    const onFingeringClick = vi.fn();
    controller.setOnFingeringClick(onFingeringClick);

    const text = getTexts()[0];
    text.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 5, clientY: 5 }));

    expect(onFingeringClick).not.toHaveBeenCalled();
  });

  it('does not invoke the fingering callback when no callback is registered', () => {
    const { container, controller, getTexts } = makeControllerWithFingeringLayer();
    controller.setFingeringEditMode(true);

    const onMeasureClick = vi.fn();
    controller.setOnMeasureClick(onMeasureClick);

    const text = getTexts()[0];
    text.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 5, clientY: 5 }));

    // 无 onFingeringClick 注册时：编辑模式点击数字不应导致异常或小节跳转
    expect(onMeasureClick).not.toHaveBeenCalled();
  });
});
