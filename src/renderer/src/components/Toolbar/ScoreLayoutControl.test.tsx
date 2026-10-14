import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ScoreLayoutControl } from './ScoreLayoutControl';
import { usePracticeStore } from '../../store';

const testWindow = window as unknown as {
  electronAPI?: {
    settings: {
      get: ReturnType<typeof vi.fn>;
      set: ReturnType<typeof vi.fn>;
      getRecentFiles: ReturnType<typeof vi.fn>;
    };
  };
};

describe('ScoreLayoutControl labels and behavior', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete testWindow.electronAPI;
    usePracticeStore.setState({ scoreLayout: 'vertical' });
  });

  it('shows both layout options and reflects the current store value', () => {
    render(<ScoreLayoutControl />);
    expect(screen.getByTestId('score-layout-toggle')).toBeInTheDocument();
    const vertical = screen.getByTestId('score-layout-vertical') as HTMLButtonElement;
    const horizontal = screen.getByTestId('score-layout-horizontal') as HTMLButtonElement;
    expect(vertical.textContent).toBe('Vertical');
    expect(horizontal.textContent).toBe('Horizontal');
  });

  it('switches the store scoreLayout when a button is clicked', () => {
    render(<ScoreLayoutControl />);
    fireEvent.click(screen.getByTestId('score-layout-horizontal'));
    expect(usePracticeStore.getState().scoreLayout).toBe('horizontal');
    fireEvent.click(screen.getByTestId('score-layout-vertical'));
    expect(usePracticeStore.getState().scoreLayout).toBe('vertical');
  });

  it('persists the selected layout to electron-store, merging with the existing ui settings', async () => {
    const getMock = vi.fn().mockResolvedValue({
      theme: 'light',
      language: 'ja',
      zoom: 1,
      pianoHeight: 120,
      volume: 80,
      showFingerings: true,
      scoreLayout: 'vertical',
    });
    const setMock = vi.fn().mockResolvedValue(undefined);
    testWindow.electronAPI = {
      settings: { get: getMock, set: setMock, getRecentFiles: vi.fn() },
    };

    render(<ScoreLayoutControl />);
    fireEvent.click(screen.getByTestId('score-layout-horizontal'));

    await vi.waitFor(() => expect(setMock).toHaveBeenCalled());
    expect(setMock).toHaveBeenCalledWith(
      'ui',
      expect.objectContaining({ theme: 'light', pianoHeight: 120, scoreLayout: 'horizontal' })
    );
  });

  it('does not throw when electronAPI is unavailable while switching', () => {
    render(<ScoreLayoutControl />);
    expect(() => fireEvent.click(screen.getByTestId('score-layout-horizontal'))).not.toThrow();
    expect(usePracticeStore.getState().scoreLayout).toBe('horizontal');
  });
});
