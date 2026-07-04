import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import * as Tone from 'tone';
import { PlaybackControls } from './PlaybackControls';
import { usePracticeStore } from '../../store';

vi.mock('tone', () => ({
  start: vi.fn().mockResolvedValue(undefined),
}));

describe('PlaybackControls', () => {
  const createAudioEngineMock = () => ({
    playAccompaniment: vi.fn(),
    pauseAccompaniment: vi.fn(),
    stopAccompaniment: vi.fn(),
  });

  beforeEach(() => {
    usePracticeStore.setState({ playbackState: 'stopped' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders play, pause, and stop buttons', () => {
    render(<PlaybackControls audioEngine={createAudioEngineMock()} />);

    expect(screen.getByTestId('playback-play')).toBeInTheDocument();
    expect(screen.getByTestId('playback-pause')).toBeInTheDocument();
    expect(screen.getByTestId('playback-stop')).toBeInTheDocument();
  });

  it('calls Tone.start() and audioEngine.playAccompaniment() on play button click', async () => {
    const audioEngine = createAudioEngineMock();
    render(<PlaybackControls audioEngine={audioEngine} />);

    fireEvent.click(screen.getByTestId('playback-play'));

    await waitFor(() => {
      expect(Tone.start).toHaveBeenCalledTimes(1);
      expect(audioEngine.playAccompaniment).toHaveBeenCalledTimes(1);
    });
    expect(usePracticeStore.getState().playbackState).toBe('playing');
  });

  it('does not call Tone.start() again on the second play after pause', async () => {
    const audioEngine = createAudioEngineMock();
    render(<PlaybackControls audioEngine={audioEngine} />);

    fireEvent.click(screen.getByTestId('playback-play'));
    await waitFor(() => expect(Tone.start).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByTestId('playback-pause'));
    expect(audioEngine.pauseAccompaniment).toHaveBeenCalledTimes(1);
    expect(usePracticeStore.getState().playbackState).toBe('paused');

    fireEvent.click(screen.getByTestId('playback-play'));
    await waitFor(() => expect(audioEngine.playAccompaniment).toHaveBeenCalledTimes(2));
    expect(Tone.start).toHaveBeenCalledTimes(1);
  });

  it('calls audioEngine.stopAccompaniment() and resets playbackState on stop button click', async () => {
    const audioEngine = createAudioEngineMock();
    render(<PlaybackControls audioEngine={audioEngine} />);

    fireEvent.click(screen.getByTestId('playback-play'));
    await waitFor(() => expect(usePracticeStore.getState().playbackState).toBe('playing'));

    fireEvent.click(screen.getByTestId('playback-stop'));
    expect(audioEngine.stopAccompaniment).toHaveBeenCalledTimes(1);
    expect(usePracticeStore.getState().playbackState).toBe('stopped');
  });

  it('toggles play/pause via the Space key', async () => {
    const audioEngine = createAudioEngineMock();
    render(<PlaybackControls audioEngine={audioEngine} />);

    fireEvent.keyDown(window, { code: 'Space' });
    await waitFor(() => expect(audioEngine.playAccompaniment).toHaveBeenCalledTimes(1));
    expect(usePracticeStore.getState().playbackState).toBe('playing');

    fireEvent.keyDown(window, { code: 'Space' });
    expect(audioEngine.pauseAccompaniment).toHaveBeenCalledTimes(1);
    expect(usePracticeStore.getState().playbackState).toBe('paused');
  });

  it('does not toggle when Space is pressed while an input/button/select is focused', () => {
    const audioEngine = createAudioEngineMock();
    render(<PlaybackControls audioEngine={audioEngine} />);

    const button = screen.getByTestId('playback-play');
    fireEvent.keyDown(button, { code: 'Space' });

    expect(audioEngine.playAccompaniment).not.toHaveBeenCalled();
  });

  it('does not throw when audioEngine is not provided', async () => {
    render(<PlaybackControls />);
    fireEvent.click(screen.getByTestId('playback-play'));
    await waitFor(() => expect(usePracticeStore.getState().playbackState).toBe('playing'));
  });
});
