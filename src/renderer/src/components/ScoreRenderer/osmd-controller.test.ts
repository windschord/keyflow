import { describe, it, expect, vi } from 'vitest';
import { OSMDController } from './osmd-controller';

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

    const map = controller.buildNoteIdMap();
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

describe('OSMDController setGrayedOutNotes (REQ-002-007, note単位グレーアウト TASK-048)', () => {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function makeContainerWithSvg(): { container: HTMLDivElement; svg: SVGSVGElement } {
    const container = document.createElement('div');
    const svg = document.createElementNS(SVG_NS, 'svg') as unknown as SVGSVGElement;
    container.appendChild(svg);
    return { container, svg };
  }

  it('adds a semi-transparent veil at each grayed-out noteId coordinate (not a whole-part/system rectangle)', () => {
    const { container, svg } = makeContainerWithSvg();
    const controller = new OSMDController(container);
    // @ts-expect-error test mock access to private note coordinate map
    controller.noteIdToSvgCoord = new Map([
      ['P1-M1-N0', { x: 10, y: 20 }],
      ['P1-M1-N1', { x: 30, y: 20 }],
      ['P1-M1-N2', { x: 10, y: 120 }],
    ]);

    // 1パート2段譜想定: N2のみ（下段=左手）をグレーアウトする。
    controller.setGrayedOutNotes(new Set(['P1-M1-N2']));

    const layer = svg.querySelector('#note-grayout-layer');
    expect(layer).not.toBeNull();
    const rects = layer?.querySelectorAll('rect');
    expect(rects?.length).toBe(1);
    expect(rects?.[0].getAttribute('data-note-id')).toBe('P1-M1-N2');
    // N0/N1 (グレーアウト対象外) にはベールが掛からない。
    expect(layer?.querySelector('rect[data-note-id="P1-M1-N0"]')).toBeNull();
  });

  it('replaces the previous grayout state entirely when called again (idempotent set-based)', () => {
    const { container, svg } = makeContainerWithSvg();
    const controller = new OSMDController(container);
    // @ts-expect-error test mock access to private note coordinate map
    controller.noteIdToSvgCoord = new Map([
      ['P1-M1-N0', { x: 10, y: 20 }],
      ['P1-M1-N1', { x: 30, y: 20 }],
    ]);

    controller.setGrayedOutNotes(new Set(['P1-M1-N0']));
    expect(svg.querySelectorAll('#note-grayout-layer rect').length).toBe(1);

    controller.setGrayedOutNotes(new Set(['P1-M1-N1']));
    const layer = svg.querySelector('#note-grayout-layer');
    expect(layer?.querySelectorAll('rect').length).toBe(1);
    expect(layer?.querySelector('rect[data-note-id="P1-M1-N1"]')).not.toBeNull();
    expect(layer?.querySelector('rect[data-note-id="P1-M1-N0"]')).toBeNull();
  });

  it('removes the grayout layer entirely when passed an empty set', () => {
    const { container, svg } = makeContainerWithSvg();
    const controller = new OSMDController(container);
    // @ts-expect-error test mock access to private note coordinate map
    controller.noteIdToSvgCoord = new Map([['P1-M1-N0', { x: 10, y: 20 }]]);

    controller.setGrayedOutNotes(new Set(['P1-M1-N0']));
    expect(svg.querySelector('#note-grayout-layer')).not.toBeNull();

    controller.setGrayedOutNotes(new Set());
    expect(svg.querySelector('#note-grayout-layer')).toBeNull();
  });

  it('ignores noteIds that have no known coordinate yet', () => {
    const { container, svg } = makeContainerWithSvg();
    const controller = new OSMDController(container);
    // @ts-expect-error test mock access to private note coordinate map
    controller.noteIdToSvgCoord = new Map([['P1-M1-N0', { x: 10, y: 20 }]]);

    controller.setGrayedOutNotes(new Set(['P1-M1-N0', 'P1-M9-N9']));

    const layer = svg.querySelector('#note-grayout-layer');
    expect(layer?.querySelectorAll('rect').length).toBe(1);
  });

  it('does nothing when there is no svg to draw onto', () => {
    const container = document.createElement('div');
    const controller = new OSMDController(container);
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

    expect(() =>
      container.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    ).not.toThrow();
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

    container.dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    );

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

    container.dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    );

    expect(onNoteContextMenu).not.toHaveBeenCalled();
  });
});
