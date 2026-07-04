import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
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

  it('updates BPM input with validation', () => {
    render(<Toolbar />);
    const input = screen.getByTestId('tempo-input') as HTMLInputElement;

    // Valid input
    fireEvent.change(input, { target: { value: '150' } });
    fireEvent.blur(input);
    expect(usePracticeStore.getState().bpm).toBe(150);

    // Below min limit
    fireEvent.change(input, { target: { value: '10' } });
    fireEvent.blur(input);
    expect(usePracticeStore.getState().bpm).toBe(20);

    // Above max limit
    fireEvent.change(input, { target: { value: '500' } });
    fireEvent.blur(input);
    expect(usePracticeStore.getState().bpm).toBe(400);
  });

  it('resets BPM to the score-derived originalBpm when the Reset button is clicked', () => {
    usePracticeStore.setState({ bpm: 140, originalBpm: 90 });
    render(<Toolbar />);

    fireEvent.click(screen.getByText('Reset'));

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
