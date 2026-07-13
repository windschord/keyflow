import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { FingeringToggle } from './FingeringToggle';
import { usePracticeStore } from '../../store';

// TASK-055: 運指の一括表示/非表示トグル（ツールバー、日本語ラベル「運指」・
// ツールチップ・トグル状態の視覚表示付き、electron-storeへの永続化）。

const testWindow = window as unknown as {
  electronAPI?: {
    settings: {
      get: ReturnType<typeof vi.fn>;
      set: ReturnType<typeof vi.fn>;
      getRecentFiles: ReturnType<typeof vi.fn>;
    };
  };
};

describe('FingeringToggle labels and behavior', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete testWindow.electronAPI;
    usePracticeStore.setState({ language: 'ja', showFingerings: true });
  });

  it('shows a Japanese "運指" label', () => {
    render(<FingeringToggle />);
    expect(screen.getByText('運指')).toBeInTheDocument();
  });

  it('shows a tooltip explaining the toggle purpose', () => {
    render(<FingeringToggle />);
    const button = screen.getByTestId('fingering-toggle');
    expect(button.getAttribute('title')).toMatch(/運指/);
  });

  it('reflects the current store value via aria-pressed (visual toggle state)', () => {
    usePracticeStore.setState({ showFingerings: false });
    render(<FingeringToggle />);
    const button = screen.getByTestId('fingering-toggle');
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  // TASK-059: スイッチ型UIへの変更に伴い、状態文言「表示中」「非表示」で
  // ON/OFFを判別できることを検証する。
  it('shows "表示中" status text when showFingerings is true', () => {
    usePracticeStore.setState({ showFingerings: true });
    render(<FingeringToggle />);
    expect(screen.getByText('表示中')).toBeInTheDocument();
  });

  it('shows "非表示" status text when showFingerings is false', () => {
    usePracticeStore.setState({ showFingerings: false });
    render(<FingeringToggle />);
    expect(screen.getByText('非表示')).toBeInTheDocument();
  });

  it('switches the status text from "表示中" to "非表示" when clicked', () => {
    usePracticeStore.setState({ showFingerings: true });
    render(<FingeringToggle />);
    const button = screen.getByTestId('fingering-toggle');

    fireEvent.click(button);

    expect(screen.getByText('非表示')).toBeInTheDocument();
    expect(screen.queryByText('表示中')).not.toBeInTheDocument();
  });

  it('toggles setShowFingerings from true to false when clicked', () => {
    render(<FingeringToggle />);
    const button = screen.getByTestId('fingering-toggle');

    fireEvent.click(button);

    expect(usePracticeStore.getState().showFingerings).toBe(false);
  });

  it('toggles setShowFingerings from false back to true when clicked again', () => {
    usePracticeStore.setState({ showFingerings: false });
    render(<FingeringToggle />);
    const button = screen.getByTestId('fingering-toggle');

    fireEvent.click(button);

    expect(usePracticeStore.getState().showFingerings).toBe(true);
  });

  it('persists the new value to electron-store, merging with the existing ui settings', async () => {
    const getMock = vi.fn().mockResolvedValue({
      theme: 'light',
      language: 'ja',
      zoom: 1,
      pianoHeight: 120,
      volume: 80,
      showFingerings: true,
    });
    const setMock = vi.fn().mockResolvedValue(undefined);
    testWindow.electronAPI = {
      settings: { get: getMock, set: setMock, getRecentFiles: vi.fn() },
    };

    render(<FingeringToggle />);
    const button = screen.getByTestId('fingering-toggle');

    fireEvent.click(button);

    await vi.waitFor(() => expect(setMock).toHaveBeenCalled());
    expect(setMock).toHaveBeenCalledWith(
      'ui',
      expect.objectContaining({ theme: 'light', pianoHeight: 120, showFingerings: false })
    );
  });

  it('does not throw when electronAPI is unavailable while toggling', () => {
    render(<FingeringToggle />);
    const button = screen.getByTestId('fingering-toggle');

    expect(() => fireEvent.click(button)).not.toThrow();
    expect(usePracticeStore.getState().showFingerings).toBe(false);
  });

  describe('言語切り替え (TASK-097, US-016)', () => {
    it('shows English label and status text when the store language is "en"', () => {
      usePracticeStore.setState({ language: 'en', showFingerings: true });
      render(<FingeringToggle />);

      expect(screen.getByText('Fingering')).toBeInTheDocument();
      expect(screen.getByText('Shown')).toBeInTheDocument();
      expect(screen.getByTestId('fingering-toggle').getAttribute('title')).toBe(
        'Hide fingering numbers on the score and keyboard'
      );
    });
  });
});
