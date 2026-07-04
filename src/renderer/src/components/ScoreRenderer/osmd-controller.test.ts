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
