import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ScoreRenderer } from './index';

// Mock OSMDController
vi.mock('./osmd-controller', () => {
  return {
    OSMDController: vi.fn().mockImplementation(() => {
      return {
        load: vi.fn().mockResolvedValue(undefined),
        moveCursor: vi.fn(),
        setPartOpacity: vi.fn(),
        drawLoopBracket: vi.fn(),
        setZoom: vi.fn(),
        highlightNote: vi.fn(),
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
});
