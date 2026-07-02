import { describe, it, expect, vi } from 'vitest';
import { OSMDController } from './osmd-controller';

describe('OSMDController moveCursor and buildNoteIdMap', () => {
    it('moves cursor to target note based on iteratorIndex map', () => {
        const mockScrollIntoView = vi.fn();
        let iteratorIdx = 0;
        const mockCursor = {
            Hidden: true,
            show: vi.fn(),
            reset: vi.fn(),
            next: vi.fn().mockImplementation(() => {
                iteratorIdx++;
                mockCursor.iterator.EndReached = iteratorIdx >= 5;
            }),
            cursorElement: {
                scrollIntoView: mockScrollIntoView
            },
            iterator: {
                CurrentMeasureIndex: 0,
                EndReached: false,
                get CurrentVoiceEntries() {
                    return [{ Notes: [{}] }]; // One note per voice entry
                }
            }
        };

        const controller = new OSMDController(document.createElement('div'));
        // @ts-expect-error test mock access
        controller.loaded = true;
        // @ts-expect-error test mock access
        controller.osmd = { cursor: mockCursor };

        // Mocking the iterator stepping for buildNoteIdMap
        // We simulate that CurrentMeasureIndex increments every 2 steps
        Object.defineProperty(mockCursor.iterator, 'CurrentMeasureIndex', {
            get: () => Math.floor(iteratorIdx / 2)
        });

        const map = controller.buildNoteIdMap();
        expect(map.size).toBe(5); // 0 to 4 steps before EndReached = true

        // Let's test moveCursor to note P1-M2-N0 which should be at iteratorIndex = 2
        // because measure 0 is steps 0,1. measure 1 is steps 2,3.
        iteratorIdx = 0;
        mockCursor.iterator.EndReached = false;

        controller.moveCursor('P1-M2-N0');

        expect(mockCursor.show).toHaveBeenCalled();
        expect(mockCursor.reset).toHaveBeenCalled();
        expect(mockCursor.next).toHaveBeenCalledTimes(7); // 5 for buildNoteIdMap, 2 for moveCursor
        expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    });
});
