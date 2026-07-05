import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, render as renderPlain } from '@testing-library/react';
import React from 'react';
import { renderWithStrictMode as render } from '../../tests/test-utils';
import { ScoreRenderer } from './index';

// Mock OSMDController
const mockDrawLoopBracket = vi.fn();
const mockClearLoopBracket = vi.fn();
const mockSetGrayedOutNotes = vi.fn();
const mockHighlightNote = vi.fn();
const mockSetOnMeasureClick = vi.fn();
const mockSetOnNoteContextMenu = vi.fn();
const mockShowFingerings = vi.fn();
const mockClearFingerings = vi.fn();
const mockBuildNoteIdMap = vi.fn();
const mockDispose = vi.fn();
// デフォルトは即時解決（既存テストの前提を維持）。M4の再入テストのみ
// mockImplementationOnce で解決タイミングを個別に制御する。
const mockLoad = vi.fn().mockResolvedValue(undefined);

vi.mock('./osmd-controller', () => {
  return {
    OSMDController: vi.fn().mockImplementation(() => {
      return {
        load: mockLoad,
        moveCursor: vi.fn(),
        setGrayedOutNotes: mockSetGrayedOutNotes,
        drawLoopBracket: mockDrawLoopBracket,
        clearLoopBracket: mockClearLoopBracket,
        setZoom: vi.fn(),
        highlightNote: mockHighlightNote,
        setOnMeasureClick: mockSetOnMeasureClick,
        setOnNoteContextMenu: mockSetOnNoteContextMenu,
        buildNoteIdMap: mockBuildNoteIdMap,
        showFingerings: mockShowFingerings,
        clearFingerings: mockClearFingerings,
        dispose: mockDispose,
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
    mockSetGrayedOutNotes.mockClear();
    mockHighlightNote.mockClear();
    mockSetOnMeasureClick.mockClear();
    mockSetOnNoteContextMenu.mockClear();
    mockShowFingerings.mockClear();
    mockClearFingerings.mockClear();
    mockBuildNoteIdMap.mockClear();
    mockDispose.mockClear();
    mockLoad.mockClear();
    mockLoad.mockResolvedValue(undefined);
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

    await waitFor(() => expect(mockHighlightNote).toHaveBeenCalledWith('P1-M1-N0', 'correct'));

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

    await waitFor(() => expect(mockHighlightNote).toHaveBeenCalledWith('P1-M1-N0', 'expected'));
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

  it('grays out only the non-practicing hand notes (note-unit, TASK-048) for each practiceMode', async () => {
    // 1パート2段譜を想定: 同一partId('P1')でも、note.handでstaff1(right)/staff2(left)を区別する。
    const scoreWithNotes = {
      title: 'Test Score',
      parts: [{ id: 'P1', hand: 'right' }],
      measures: [
        {
          number: 1,
          startTick: 0,
          notes: [
            { id: 'P1-M1-N0', hand: 'right' },
            { id: 'P1-M1-N1', hand: 'left' },
          ],
        },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    // practiceMode="right": 左手音(N1)のみグレーアウト対象。
    const { rerender } = render(
      <ScoreRenderer
        score={scoreWithNotes}
        musicXmlContent="<score-partwise/>"
        currentNoteId={null}
        practiceMode="right"
        loopRange={null}
        zoom={1.0}
        onNoteClick={() => {}}
      />
    );

    await waitFor(() => expect(mockSetGrayedOutNotes).toHaveBeenCalledWith(new Set(['P1-M1-N1'])));

    mockSetGrayedOutNotes.mockClear();

    // practiceMode="left": 右手音(N0)のみグレーアウト対象。
    rerender(
      <ScoreRenderer
        score={scoreWithNotes}
        musicXmlContent="<score-partwise/>"
        currentNoteId={null}
        practiceMode="left"
        loopRange={null}
        zoom={1.0}
        onNoteClick={() => {}}
      />
    );

    await waitFor(() => expect(mockSetGrayedOutNotes).toHaveBeenCalledWith(new Set(['P1-M1-N0'])));

    mockSetGrayedOutNotes.mockClear();

    // practiceMode="both": グレーアウトなし（空集合）。
    rerender(
      <ScoreRenderer
        score={scoreWithNotes}
        musicXmlContent="<score-partwise/>"
        currentNoteId={null}
        practiceMode="both"
        loopRange={null}
        zoom={1.0}
        onNoteClick={() => {}}
      />
    );

    await waitFor(() => expect(mockSetGrayedOutNotes).toHaveBeenCalledWith(new Set()));
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

  it('ignores a stale load() completion when a newer load starts first (M4: OSMD load reentrancy)', async () => {
    // このテストのみ StrictMode 二重マウントによる load() 呼び出し回数のブレを避けるため、
    // 通常の render を使う（StrictModeでの再入耐性は他の全テストがStrictModeで
    // 通っていることで既に間接的に検証されている）。
    let resolveFirstLoad: (() => void) | undefined;
    mockLoad.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveFirstLoad = resolve;
        })
    );

    const { rerender } = renderPlain(
      <ScoreRenderer
        score={mockScore}
        musicXmlContent="<score-partwise/>first"
        currentNoteId={null}
        practiceMode="both"
        loopRange={null}
        zoom={1.0}
        onNoteClick={() => {}}
      />
    );

    await waitFor(() => expect(mockLoad).toHaveBeenCalledTimes(1));

    // 1回目がまだ未解決のうちに、2回目（新しい楽譜）のload effectを走らせる。
    // 2回目は即時解決するデフォルトのmockLoad実装を使う。
    rerender(
      <ScoreRenderer
        score={mockScore}
        musicXmlContent="<score-partwise/>second"
        currentNoteId={null}
        practiceMode="both"
        loopRange={null}
        zoom={1.0}
        onNoteClick={() => {}}
      />
    );

    await waitFor(() => expect(mockLoad).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mockBuildNoteIdMap).toHaveBeenCalledTimes(1));

    // 古い(1回目の)loadを今になって解決させる。cancelledフラグにより
    // その.then（setIsLoaded/buildNoteIdMap）は無視されるべきで、
    // buildNoteIdMapの呼び出し回数は2回目のload分の1回のままであること。
    resolveFirstLoad?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockBuildNoteIdMap).toHaveBeenCalledTimes(1);
  });

  it('calls OSMDController.dispose() on unmount (TASK-049: resource cleanup)', () => {
    const { unmount } = renderPlain(
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

    expect(mockDispose).not.toHaveBeenCalled();

    unmount();

    expect(mockDispose).toHaveBeenCalledTimes(1);
  });

  it('passes the parsed score to OSMDController.buildNoteIdMap once loading resolves (TASK-049: 照合ベースnoteIdマップ)', async () => {
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

    await waitFor(() => expect(mockBuildNoteIdMap).toHaveBeenCalledWith(mockScore));
  });
});
