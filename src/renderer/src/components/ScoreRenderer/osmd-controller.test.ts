import { describe, it, expect, vi } from 'vitest';
import { OSMDController, computeFingeringCoords } from './osmd-controller';
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
    measures: measures.map(({ number, noteIds }) => ({
      number,
      startTick: 0,
      notes: noteIds.map(
        (id, noteIndex): Note => ({
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
        })
      ),
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
    // Since currentIteratorIndex is 0 after buildNoteIdMap reset, moveCursor needs to call next() twice (0->1->2)
    // With incremental navigation, moveCursor should NOT call reset() again
    controller.moveCursor('P1-M2-N0');

    expect(mockCursor.show).toHaveBeenCalled();
    expect(mockCursor.reset).toHaveBeenCalledTimes(2); // Still 2 (from buildNoteIdMap only, not from moveCursor)
    expect(mockCursor.next).toHaveBeenCalledTimes(7); // 5 for buildNoteIdMap, 2 for moveCursor (incremental from 0 to 2)
    expect(mockScrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
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

    const layer = svg.querySelector('#loop-bracket-layer');
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

    expect(svg.querySelectorAll('#loop-bracket-layer').length).toBe(1);
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
    expect(svg.querySelector('#loop-bracket-layer')).not.toBeNull();

    controller.clearLoopBracket();
    expect(svg.querySelector('#loop-bracket-layer')).toBeNull();
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

    const layer = svg.querySelector('#note-highlight-layer');
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
    expect(svg.querySelector('#note-highlight-layer')).not.toBeNull();

    controller.highlightNote('P1-M1-N0', 'expected');
    expect(svg.querySelector('#note-highlight-layer')).toBeNull();
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

    const layer = svg.querySelector('#note-highlight-layer');
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

  it('invokes the registered measure-click callback with the measure number of the nearest note when the container is clicked', () => {
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

    const onMeasureClick = vi.fn();
    controller.setOnMeasureClick(onMeasureClick);

    container.dispatchEvent(new MouseEvent('click', { clientX: 5, clientY: 5, bubbles: true }));

    expect(onMeasureClick).toHaveBeenCalledWith(3);
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

  it('skips notes it cannot resolve and logs a warning instead of guessing (誤対応を作らない)', () => {
    const score: Score = {
      title: 'Unmatched',
      parts: [{ id: 'P1', name: 'Piano', hand: 'right', clef: 'treble' }],
      tempo: 120,
      ticksPerQuarter: 480,
      tempoMap: [{ tick: 0, bpm: 120 }],
      timeSignature: { beats: 4, beatType: 4 },
      keySignature: 0,
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
            // score上に存在しない音高(D4=midi62)なので照合できない。
            return [{ Notes: [makeOsmdNote({ staffId: 1, absTimestamp: 0, halfTone: 50 })] }];
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

    expect(map.size).toBe(0);
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

    const texts = Array.from(svg.querySelectorAll('#fingering-layer text'));
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

    const texts = Array.from(svg.querySelectorAll('#fingering-layer text'));
    expect(texts).toHaveLength(2);

    for (const text of texts) {
      // 小さすぎて読めない問題（旧: 8px）の再発防止
      expect(Number(text.getAttribute('font-size'))).toBeGreaterThanOrEqual(11);
      expect(text.getAttribute('font-weight')).toBe('bold');
      // 五線・符幹に重なっても読めるよう白フチ（paint-order: stroke）を付ける
      expect(text.getAttribute('stroke')).toBe('#ffffff');
      expect(text.getAttribute('paint-order')).toBe('stroke');
    }

    // 未承認（提案中）でも薄い水色（旧: #93c5fd）ではなく濃色で描画される
    const suggested = texts.find((t) => t.textContent === '2')!;
    expect(suggested.getAttribute('fill')).toBe('#1d4ed8');
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

  it('re-renders, rebuilds the noteId map, and reapplies overlays (in that order) after a debounced resize (200-300ms)', () => {
    vi.useFakeTimers();
    const ro = installFakeResizeObserver();

    try {
      const container = document.createElement('div');
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
        measures: [],
      };
      // lastScoreを設定するため、一度素通しで呼んでおく（cursor==nullのため即return）。
      controller.buildNoteIdMap(score);

      const buildSpy = vi.spyOn(controller, 'buildNoteIdMap');
      const reapplySpy = vi.spyOn(
        controller as unknown as { reapplyOverlays: () => void },
        'reapplyOverlays'
      );

      const callback = ro.getCallback();
      expect(callback).toBeDefined();
      callback?.();

      // デバウンス中は何も実行されない。
      expect(mockRender).not.toHaveBeenCalled();
      expect(buildSpy).not.toHaveBeenCalled();
      expect(reapplySpy).not.toHaveBeenCalled();

      vi.advanceTimersByTime(249);
      expect(mockRender).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1); // 250ms経過
      expect(mockRender).toHaveBeenCalledTimes(1);
      expect(buildSpy).toHaveBeenCalledTimes(1);
      expect(reapplySpy).toHaveBeenCalledTimes(1);

      const renderOrder = mockRender.mock.invocationCallOrder[0];
      const buildOrder = buildSpy.mock.invocationCallOrder[0];
      const reapplyOrder = reapplySpy.mock.invocationCallOrder[0];
      expect(renderOrder).toBeLessThan(buildOrder);
      expect(buildOrder).toBeLessThan(reapplyOrder);
    } finally {
      ro.restore();
      vi.useRealTimers();
    }
  });

  it('does not run render multiple times when resize fires repeatedly within the debounce window', () => {
    vi.useFakeTimers();
    const ro = installFakeResizeObserver();

    try {
      const container = document.createElement('div');
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
      expect(mockRender).toHaveBeenCalledTimes(1);
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

describe('OSMDController setZoom rebuilds the noteId map before reapplying overlays (TASK-049)', () => {
  it('calls render, then buildNoteIdMap, then reapplyOverlays in that order', () => {
    const container = document.createElement('div');
    const controller = new OSMDController(container);
    const mockRender = vi.fn();
    // @ts-expect-error test mock access
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
      measures: [],
    };
    controller.buildNoteIdMap(score); // lastScoreを設定しておく

    const buildSpy = vi.spyOn(controller, 'buildNoteIdMap');
    const reapplySpy = vi.spyOn(
      controller as unknown as { reapplyOverlays: () => void },
      'reapplyOverlays'
    );

    controller.setZoom(1.5);

    expect(mockRender).toHaveBeenCalledTimes(1);
    expect(buildSpy).toHaveBeenCalledTimes(1);
    expect(reapplySpy).toHaveBeenCalledTimes(1);
    expect(buildSpy.mock.invocationCallOrder[0]).toBeLessThan(
      reapplySpy.mock.invocationCallOrder[0]
    );
    // @ts-expect-error test access to private osmd field
    expect(controller.osmd.zoom).toBe(1.5);
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
