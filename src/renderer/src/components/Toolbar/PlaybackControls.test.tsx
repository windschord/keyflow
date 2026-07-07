import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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
    usePracticeStore.setState({ playbackState: 'stopped', voiceLoading: false });
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

  // TASK-073: 再生音色（grand-piano等）のロード待ち（REQ-013-003）。
  describe('REQ-013-003: 音色ロード中の再生コントロール', () => {
    it('disables the play button and shows a loading label while voiceLoading is true', () => {
      usePracticeStore.setState({ voiceLoading: true });
      render(<PlaybackControls audioEngine={createAudioEngineMock()} />);

      const playButton = screen.getByTestId('playback-play');
      expect(playButton).toBeDisabled();
      expect(playButton).toHaveTextContent('読込中...');
      expect(playButton).toHaveAttribute('title', '音色を読み込み中です');
    });

    it('does not call playAccompaniment when clicking the play button while voiceLoading is true', () => {
      usePracticeStore.setState({ voiceLoading: true });
      const audioEngine = createAudioEngineMock();
      render(<PlaybackControls audioEngine={audioEngine} />);

      fireEvent.click(screen.getByTestId('playback-play'));

      expect(audioEngine.playAccompaniment).not.toHaveBeenCalled();
      expect(usePracticeStore.getState().playbackState).toBe('stopped');
    });

    it('re-enables the play button with the normal label once voiceLoading becomes false', () => {
      usePracticeStore.setState({ voiceLoading: false });
      render(<PlaybackControls audioEngine={createAudioEngineMock()} />);

      const playButton = screen.getByTestId('playback-play');
      expect(playButton).not.toBeDisabled();
      expect(playButton).toHaveTextContent('再生');
    });

    it('waits for audioEngine.playAccompaniment() to resolve before flipping playbackState to playing', async () => {
      let resolvePlay: () => void = () => {};
      const playPromise = new Promise<void>((resolve) => {
        resolvePlay = resolve;
      });
      const audioEngine = {
        ...createAudioEngineMock(),
        playAccompaniment: vi.fn().mockReturnValue(playPromise),
      };
      render(<PlaybackControls audioEngine={audioEngine} />);

      fireEvent.click(screen.getByTestId('playback-play'));

      await waitFor(() => expect(audioEngine.playAccompaniment).toHaveBeenCalledTimes(1));
      expect(usePracticeStore.getState().playbackState).toBe('stopped');

      await act(async () => {
        resolvePlay();
        await playPromise;
      });

      expect(usePracticeStore.getState().playbackState).toBe('playing');
    });
  });

  describe('REQ-010-002: 楽譜未読込時の再生コントロール無効化', () => {
    it('disables play/pause/stop and shows a reason tooltip when score is null', () => {
      const audioEngine = createAudioEngineMock();
      render(<PlaybackControls audioEngine={audioEngine} score={null} />);

      const playButton = screen.getByTestId('playback-play');
      const pauseButton = screen.getByTestId('playback-pause');
      const stopButton = screen.getByTestId('playback-stop');

      expect(playButton).toBeDisabled();
      expect(pauseButton).toBeDisabled();
      expect(stopButton).toBeDisabled();
      expect(playButton).toHaveAttribute('title', '楽譜を開くと再生できます');
      expect(pauseButton).toHaveAttribute('title', '楽譜を開くと再生できます');
      expect(stopButton).toHaveAttribute('title', '楽譜を開くと再生できます');
    });

    it('does not call playAccompaniment when clicking the disabled play button without a score', () => {
      const audioEngine = createAudioEngineMock();
      render(<PlaybackControls audioEngine={audioEngine} score={null} />);

      fireEvent.click(screen.getByTestId('playback-play'));

      expect(audioEngine.playAccompaniment).not.toHaveBeenCalled();
      expect(usePracticeStore.getState().playbackState).toBe('stopped');
    });

    it('enables play button with the normal tooltip once a score is provided', () => {
      const audioEngine = createAudioEngineMock();
      const mockScore = { parts: [], measures: [] } as unknown as import('../../types').Score;
      render(<PlaybackControls audioEngine={audioEngine} score={mockScore} />);

      const playButton = screen.getByTestId('playback-play');
      expect(playButton).not.toBeDisabled();
      expect(playButton).toHaveAttribute('title', '再生 (Space)');
    });

    it('does not disable the play button when the score prop is omitted (backward compatible default)', () => {
      const audioEngine = createAudioEngineMock();
      render(<PlaybackControls audioEngine={audioEngine} />);

      expect(screen.getByTestId('playback-play')).not.toBeDisabled();
    });
  });
});
