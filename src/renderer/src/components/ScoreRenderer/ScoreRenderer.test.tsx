import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { ScoreRenderer } from './index';

// Mock OSMDController
const mockDrawLoopBracket = vi.fn();
const mockClearLoopBracket = vi.fn();
const mockSetPartOpacity = vi.fn();
const mockHighlightNote = vi.fn();
const mockSetOnMeasureClick = vi.fn();
const mockSetOnNoteContextMenu = vi.fn();
const mockShowFingerings = vi.fn();
const mockClearFingerings = vi.fn();

vi.mock('./osmd-controller', () => {
  return {
    OSMDController: vi.fn().mockImplementation(() => {
      return {
        load: vi.fn().mockResolvedValue(undefined),
        moveCursor: vi.fn(),
        setPartOpacity: mockSetPartOpacity,
        drawLoopBracket: mockDrawLoopBracket,
        clearLoopBracket: mockClearLoopBracket,
        setZoom: vi.fn(),
        highlightNote: mockHighlightNote,
        setOnMeasureClick: mockSetOnMeasureClick,
        setOnNoteContextMenu: mockSetOnNoteContextMenu,
        buildNoteIdMap: vi.fn(),
        showFingerings: mockShowFingerings,
        clearFingerings: mockClearFingerings,
      };
    }),
  };
});

describe('ScoreRenderer', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockScore: any = { title: 'Test Score', parts: [] };

  beforeEach(() => {
    mockDrawLoopBracket.mockClear();
    mockClearLoopBracket.mockClear();
    mockSetPartOpacity.mockClear();
    mockHighlightNote.mockClear();
    mockSetOnMeasureClick.mockClear();
    mockSetOnNoteContextMenu.mockClear();
    mockShowFingerings.mockClear();
    mockClearFingerings.mockClear();
  });

  it('renders placeholder when score is null', () => {
    render(
      <ScoreRenderer
        score={null}
        musicXmlContent={null}
        currentNoteId={null}
        practiceMode="both"
        loopRange={null}
        zoom={1.0}
        onNoteClick={() => {}}
      />
    );
    expect(screen.getByTestId('placeholder')).toBeInTheDocument();
    expect(screen.getByText('楽譜ファイルを開いてください')).toBeInTheDocument();
  });

  it('renders container when score is provided', () => {
    render(
      <ScoreRenderer
        score={mockScore}
        musicXmlContent="<score-partwise/>"
        currentNoteId={null}
        practiceMode="both"
        loopRange={null}
        zoom={1.0}
        onNoteClick={() => {}}
      />
    );
    expect(screen.queryByTestId('placeholder')).not.toBeInTheDocument();
    expect(screen.getByTestId('osmd-container')).toBeInTheDocument();
  });

  it('has a single scroll container (outer div) and no nested scroll/height on the inner osmd-container', () => {
    render(
      <ScoreRenderer
        score={mockScore}
        musicXmlContent="<score-partwise/>"
        currentNoteId={null}
        practiceMode="both"
        loopRange={null}
        zoom={1.0}
        onNoteClick={() => {}}
      />
    );

    const osmdContainer = screen.getByTestId('osmd-container');
    const outerContainer = osmdContainer.parentElement as HTMLElement;

    // TASK-025: スクロールコンテナは外側divの1つに一本化する。
    expect(outerContainer.style.overflow).toBe('auto');
    // flexアイテムとして高さを確定させるため minHeight: 0 を維持する。
    expect(outerContainer.style.minHeight).toBe('0px');

    // 内側の osmd-container は独自のスクロール・固定高さを持たない
    // （二重スクロールコンテナの解消）。
    expect(osmdContainer.style.overflowY).toBe('');
    expect(osmdContainer.style.height).toBe('');
  });

  it('draws a loop bracket once the score is loaded and a loopRange is provided', async () => {
    render(
      <ScoreRenderer
        score={mockScore}
        musicXmlContent="<score-partwise/>"
        currentNoteId={null}
        practiceMode="both"
        loopRange={{ start: 2, end: 4 }}
        zoom={1.0}
        onNoteClick={() => {}}
      />
    );

    await waitFor(() => expect(mockDrawLoopBracket).toHaveBeenCalledWith(2, 4));
  });

  it('clears the loop bracket when loopRange becomes null', async () => {
    const { rerender } = render(
      <ScoreRenderer
        score={mockScore}
        musicXmlContent="<score-partwise/>"
        currentNoteId={null}
        practiceMode="both"
        loopRange={{ start: 1, end: 2 }}
        zoom={1.0}
        onNoteClick={() => {}}
      />
    );

    await waitFor(() => expect(mockDrawLoopBracket).toHaveBeenCalledWith(1, 2));

    rerender(
      <ScoreRenderer
        score={mockScore}
        musicXmlContent="<score-partwise/>"
        currentNoteId={null}
        practiceMode="both"
        loopRange={null}
        zoom={1.0}
        onNoteClick={() => {}}
      />
    );

    await waitFor(() => expect(mockClearLoopBracket).toHaveBeenCalled());
  });

  it('registers a measure-click handler that resolves the clicked measure number to a Note and calls onNoteClick (REQ-002-004)', async () => {
    const scoreWithMeasures = {
      title: 'Test Score',
      parts: [],
      measures: [
        { number: 1, startTick: 0, notes: [{ id: 'P1-M1-N0', measureNumber: 1 }] },
        { number: 2, startTick: 480, notes: [{ id: 'P1-M2-N0', measureNumber: 2 }] },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    const onNoteClick = vi.fn();

    render(
      <ScoreRenderer
        score={scoreWithMeasures}
        musicXmlContent="<score-partwise/>"
        currentNoteId={null}
        practiceMode="both"
        loopRange={null}
        zoom={1.0}
        onNoteClick={onNoteClick}
      />
    );

    await waitFor(() => expect(mockSetOnMeasureClick).toHaveBeenCalled());

    // Simulate the OSMDController resolving a click to measure 2.
    const registeredCallback = mockSetOnMeasureClick.mock.calls[
      mockSetOnMeasureClick.mock.calls.length - 1
    ][0] as (measureNumber: number) => void;
    registeredCallback(2);

    expect(onNoteClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'P1-M2-N0', measureNumber: 2 })
    );
  });

  it('propagates noteHighlights prop changes to OSMDController.highlightNote and reverts removed entries to expected (REQ-004-003/004)', async () => {
    const { rerender } = render(
      <ScoreRenderer
        score={mockScore}
        musicXmlContent="<score-partwise/>"
        currentNoteId={null}
        practiceMode="both"
        loopRange={null}
        zoom={1.0}
        onNoteClick={() => {}}
        noteHighlights={{ 'P1-M1-N0': 'correct' }}
      />
    );

    await waitFor(() =>
      expect(mockHighlightNote).toHaveBeenCalledWith('P1-M1-N0', 'correct')
    );

    mockHighlightNote.mockClear();

    rerender(
      <ScoreRenderer
        score={mockScore}
        musicXmlContent="<score-partwise/>"
        currentNoteId={null}
        practiceMode="both"
        loopRange={null}
        zoom={1.0}
        onNoteClick={() => {}}
        noteHighlights={{}}
      />
    );

    await waitFor(() =>
      expect(mockHighlightNote).toHaveBeenCalledWith('P1-M1-N0', 'expected')
    );
  });

  it('registers a note-contextmenu handler that forwards resolved noteId and screen coordinates (REQ-008-001)', async () => {
    const onNoteContextMenu = vi.fn();

    render(
      <ScoreRenderer
        score={mockScore}
        musicXmlContent="<score-partwise/>"
        currentNoteId={null}
        practiceMode="both"
        loopRange={null}
        zoom={1.0}
        onNoteClick={() => {}}
        onNoteContextMenu={onNoteContextMenu}
      />
    );

    await waitFor(() => expect(mockSetOnNoteContextMenu).toHaveBeenCalled());

    const registeredCallback = mockSetOnNoteContextMenu.mock.calls[
      mockSetOnNoteContextMenu.mock.calls.length - 1
    ][0] as (noteId: string, x: number, y: number) => void;
    registeredCallback('P1-M2-N0', 120, 240);

    expect(onNoteContextMenu).toHaveBeenCalledWith('P1-M2-N0', 120, 240);
  });

  it('unregisters the note-contextmenu handler on unmount', async () => {
    const onNoteContextMenu = vi.fn();

    const { unmount } = render(
      <ScoreRenderer
        score={mockScore}
        musicXmlContent="<score-partwise/>"
        currentNoteId={null}
        practiceMode="both"
        loopRange={null}
        zoom={1.0}
        onNoteClick={() => {}}
        onNoteContextMenu={onNoteContextMenu}
      />
    );

    await waitFor(() => expect(mockSetOnNoteContextMenu).toHaveBeenCalled());
    mockSetOnNoteContextMenu.mockClear();

    unmount();

    expect(mockSetOnNoteContextMenu).toHaveBeenCalledWith(null);
  });

  it('renders fingerings using the real isApproved value from annotation data instead of a fixed false (osmd-controller.ts:454 dead branch)', async () => {
    render(
      <ScoreRenderer
        score={mockScore}
        musicXmlContent="<score-partwise/>"
        currentNoteId={null}
        practiceMode="both"
        loopRange={null}
        zoom={1.0}
        onNoteClick={() => {}}
        annotations={[
          { noteId: 'P1-M1-N0', fingerNumber: 3, isAISuggested: false, isApproved: true },
          { noteId: 'P1-M2-N0', fingerNumber: 2, isAISuggested: true, isApproved: false },
          // Annotations without a fingerNumber (comment-only) must not be passed to showFingerings.
          { noteId: 'P1-M3-N0', comment: 'メモのみ', isAISuggested: false, isApproved: false },
        ]}
      />
    );

    await waitFor(() =>
      expect(mockShowFingerings).toHaveBeenCalledWith([
        { noteId: 'P1-M1-N0', finger: 3, isApproved: true },
        { noteId: 'P1-M2-N0', finger: 2, isApproved: false },
      ])
    );
  });

  it('clears fingerings when no annotation has a fingerNumber', async () => {
    render(
      <ScoreRenderer
        score={mockScore}
        musicXmlContent="<score-partwise/>"
        currentNoteId={null}
        practiceMode="both"
        loopRange={null}
        zoom={1.0}
        onNoteClick={() => {}}
        annotations={[{ noteId: 'P1-M1-N0', isAISuggested: false, isApproved: false }]}
      />
    );

    await waitFor(() => expect(mockClearFingerings).toHaveBeenCalled());
    expect(mockShowFingerings).not.toHaveBeenCalled();
  });
});
