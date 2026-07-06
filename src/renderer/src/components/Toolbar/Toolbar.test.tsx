import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { renderWithStrictMode as render } from '../../tests/test-utils';
import { Toolbar } from './index';
import { usePracticeStore } from '../../store';

vi.mock('tone', () => ({
  start: vi.fn().mockResolvedValue(undefined),
}));

describe('Toolbar UI', () => {
  beforeEach(() => {
    // Reset store before each test
    usePracticeStore.setState({
      practiceMode: 'both',
      bpm: 120,
      originalBpm: 120,
      loopStart: 1,
      loopEnd: 2,
      playbackState: 'stopped',
    });
  });

  it('changes practice mode via buttons', () => {
    render(<Toolbar />);
    const rightBtn = screen.getByTestId('mode-right');
    fireEvent.click(rightBtn);
    expect(usePracticeStore.getState().practiceMode).toBe('right');
  });

  it('updates BPM input with validation, clamped to originalBpm 20%-200% (REQ-006-003)', () => {
    // originalBpm=120（beforeEachで設定）のため、範囲は24（20%）〜240（200%）。
    render(<Toolbar />);
    const input = screen.getByTestId('tempo-input') as HTMLInputElement;

    // Valid input（範囲内）
    fireEvent.change(input, { target: { value: '150' } });
    fireEvent.blur(input);
    expect(usePracticeStore.getState().bpm).toBe(150);

    // Below min limit（originalBpm=120の20%=24未満）
    fireEvent.change(input, { target: { value: '10' } });
    fireEvent.blur(input);
    expect(usePracticeStore.getState().bpm).toBe(24);

    // Above max limit（originalBpm=120の200%=240超）
    fireEvent.change(input, { target: { value: '500' } });
    fireEvent.blur(input);
    expect(usePracticeStore.getState().bpm).toBe(240);
  });

  it('resets BPM to the score-derived originalBpm when the Reset button is clicked', () => {
    usePracticeStore.setState({ bpm: 140, originalBpm: 90 });
    render(<Toolbar />);

    fireEvent.click(screen.getByText('リセット'));

    expect(usePracticeStore.getState().bpm).toBe(90);
  });

  it('shows error when loop start >= end', () => {
    render(<Toolbar />);
    const startInput = screen.getByTestId('loop-start') as HTMLInputElement;
    const endInput = screen.getByTestId('loop-end') as HTMLInputElement;

    fireEvent.change(startInput, { target: { value: '5' } });
    fireEvent.change(endInput, { target: { value: '3' } });
    fireEvent.blur(endInput);

    expect(screen.getByText('開始 < 終了')).toBeInTheDocument();

    // Store should not be updated due to error
    expect(usePracticeStore.getState().loopStart).toBe(1);
    expect(usePracticeStore.getState().loopEnd).toBe(2);
  });

  it('changes practice mode via keyboard shortcuts', () => {
    render(<Toolbar />);

    fireEvent.keyDown(window, { key: 'R' });
    expect(usePracticeStore.getState().practiceMode).toBe('right');

    fireEvent.keyDown(window, { key: 'L' });
    expect(usePracticeStore.getState().practiceMode).toBe('left');
  });

  it('renders playback controls and forwards audioEngine to them', async () => {
    const audioEngine = {
      playAccompaniment: vi.fn(),
      pauseAccompaniment: vi.fn(),
      stopAccompaniment: vi.fn(),
    };
    render(<Toolbar audioEngine={audioEngine} />);

    fireEvent.click(screen.getByTestId('playback-play'));
    await waitFor(() => expect(audioEngine.playAccompaniment).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByTestId('playback-pause'));
    expect(audioEngine.pauseAccompaniment).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('playback-stop'));
    expect(audioEngine.stopAccompaniment).toHaveBeenCalledTimes(1);
  });

  it('changes the score zoom level via the ZoomControl select (REQ-002-006, TASK-045)', () => {
    usePracticeStore.setState({ zoom: 1.0 });
    render(<Toolbar />);

    const zoomSelect = screen.getByTestId('zoom-select') as HTMLSelectElement;
    fireEvent.change(zoomSelect, { target: { value: '4' } });

    expect(usePracticeStore.getState().zoom).toBe(4);
  });

  it('shows a Japanese tooltip/aria-label for the settings button', () => {
    render(<Toolbar />);
    const settingsButton = screen.getByLabelText('設定');
    expect(settingsButton.getAttribute('title')).toBe('設定');
  });

  it('toggles play/pause via Space key from within the Toolbar', async () => {
    const audioEngine = {
      playAccompaniment: vi.fn(),
      pauseAccompaniment: vi.fn(),
      stopAccompaniment: vi.fn(),
    };
    render(<Toolbar audioEngine={audioEngine} />);

    fireEvent.keyDown(window, { code: 'Space' });
    await waitFor(() => expect(audioEngine.playAccompaniment).toHaveBeenCalledTimes(1));

    fireEvent.keyDown(window, { code: 'Space' });
    expect(audioEngine.pauseAccompaniment).toHaveBeenCalledTimes(1);
  });
});
