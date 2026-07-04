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
        buildNoteIdMap: vi.fn(),
        showFingerings: vi.fn(),
        clearFingerings: vi.fn(),
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
});
