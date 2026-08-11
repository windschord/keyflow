import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import * as Tone from 'tone';
import {
  PlaybackControls,
  AUDIO_START_TIMEOUT_MS,
  PLAY_REQUEST_TIMEOUT_MS,
} from './PlaybackControls';
import { usePracticeStore } from '../../store';

// TASK-106: AudioContextが running にならない環境を再現できるよう、getContext().state を
// テストから差し替え可能にする（既定は正常系の 'running'）。
const mockToneContext: { state: AudioContextState } = { state: 'running' };

vi.mock('tone', () => ({
  start: vi.fn().mockResolvedValue(undefined),
  getContext: vi.fn(() => mockToneContext),
}));

// 型付きモック参照（`as unknown as Mock` のキャストを避ける）。
const mockedToneStart = vi.mocked(Tone.start);

describe('PlaybackControls', () => {
  const createAudioEngineMock = () => ({
    playAccompaniment: vi.fn(),
    pauseAccompaniment: vi.fn(),
    stopAccompaniment: vi.fn(),
  });

  beforeEach(() => {
    usePracticeStore.setState({ language: 'ja', playbackState: 'stopped', voiceLoading: false });
    mockToneContext.state = 'running';
    mockedToneStart.mockResolvedValue(undefined);
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.useRealTimers();
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

  /**
   * TASK-106: 再生開始経路の失敗を必ずユーザーへ提示する（再発防止）。
   *
   * 修正前は `Tone.start()` / `playAccompaniment()` の失敗や未決着が握り潰され、
   * クリックしても画面上は一切変化しなかった。
   * Win11 Portable版の「再生ボタンを押しても何も起きない」報告の直接原因である。
   * docs/sdd/troubleshooting/2026-08-11-portable-play-no-response/analysis.md
   */
  describe('TASK-106: 再生開始失敗時のエラー通知', () => {
    it('playAccompaniment()が失敗したらエラーダイアログを表示し、再生中にはしない', async () => {
      const audioEngine = {
        ...createAudioEngineMock(),
        playAccompaniment: vi.fn().mockRejectedValue(new Error('boom')),
      };
      render(<PlaybackControls audioEngine={audioEngine} />);

      fireEvent.click(screen.getByTestId('playback-play'));

      await waitFor(() =>
        expect(window.alert).toHaveBeenCalledWith(
          expect.stringContaining('再生を開始できませんでした')
        )
      );
      expect(usePracticeStore.getState().playbackState).toBe('stopped');
    });

    it('Tone.start()が失敗したらエラーダイアログを表示し、playAccompanimentを呼ばない', async () => {
      mockedToneStart.mockRejectedValue(new Error('resume failed'));
      const audioEngine = createAudioEngineMock();
      render(<PlaybackControls audioEngine={audioEngine} />);

      fireEvent.click(screen.getByTestId('playback-play'));

      await waitFor(() => expect(window.alert).toHaveBeenCalledTimes(1));
      expect(audioEngine.playAccompaniment).not.toHaveBeenCalled();
      expect(usePracticeStore.getState().playbackState).toBe('stopped');
    });

    it('AudioContextがrunningにならない場合はエラーダイアログを表示する（音声デバイスを開けない環境）', async () => {
      mockToneContext.state = 'suspended';
      const audioEngine = createAudioEngineMock();
      render(<PlaybackControls audioEngine={audioEngine} />);

      fireEvent.click(screen.getByTestId('playback-play'));

      await waitFor(() => expect(window.alert).toHaveBeenCalledTimes(1));
      expect(audioEngine.playAccompaniment).not.toHaveBeenCalled();
      expect(usePracticeStore.getState().playbackState).toBe('stopped');
    });

    it('Tone.start()が決着しない場合、上限時間の経過でエラーダイアログを表示する', async () => {
      vi.useFakeTimers();
      // 決着しないPromise（音声デバイスを開けないときのresume()の挙動）。
      mockedToneStart.mockReturnValue(new Promise<void>(() => {}));
      const audioEngine = createAudioEngineMock();
      render(<PlaybackControls audioEngine={audioEngine} />);

      fireEvent.click(screen.getByTestId('playback-play'));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(AUDIO_START_TIMEOUT_MS + 1);
      });

      expect(window.alert).toHaveBeenCalledTimes(1);
      expect(audioEngine.playAccompaniment).not.toHaveBeenCalled();
      expect(usePracticeStore.getState().playbackState).toBe('stopped');
    });

    it('playAccompaniment()が決着しない場合、上限時間の経過でエラーダイアログを表示する', async () => {
      vi.useFakeTimers();
      const audioEngine = {
        ...createAudioEngineMock(),
        playAccompaniment: vi.fn().mockReturnValue(new Promise<void>(() => {})),
      };
      render(<PlaybackControls audioEngine={audioEngine} />);

      fireEvent.click(screen.getByTestId('playback-play'));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(PLAY_REQUEST_TIMEOUT_MS + 1);
      });

      expect(window.alert).toHaveBeenCalledTimes(1);
      expect(usePracticeStore.getState().playbackState).toBe('stopped');
    });

    it('開始処理の実行中は再生ボタンを無効化し、連打しても要求は1件に制限される（CodeRabbit PR#77指摘）', async () => {
      let resolvePlay: () => void = () => {};
      const playPromise = new Promise<void>((resolve) => {
        resolvePlay = resolve;
      });
      const audioEngine = {
        ...createAudioEngineMock(),
        playAccompaniment: vi.fn().mockReturnValue(playPromise),
      };
      render(<PlaybackControls audioEngine={audioEngine} />);

      const playButton = screen.getByTestId('playback-play');
      fireEvent.click(playButton);

      await waitFor(() => expect(playButton).toBeDisabled());

      // 開始処理の完了前に連打しても、追加の要求は発行されない。
      fireEvent.click(playButton);
      fireEvent.keyDown(window, { code: 'Space' });

      await act(async () => {
        resolvePlay();
        await playPromise;
      });

      expect(audioEngine.playAccompaniment).toHaveBeenCalledTimes(1);
      expect(usePracticeStore.getState().playbackState).toBe('playing');
    });

    it('開始処理が失敗しても再生ボタンは再び押下可能になる', async () => {
      mockedToneStart.mockRejectedValueOnce(new Error('resume failed'));
      render(<PlaybackControls audioEngine={createAudioEngineMock()} />);

      const playButton = screen.getByTestId('playback-play');
      fireEvent.click(playButton);

      await waitFor(() => expect(window.alert).toHaveBeenCalledTimes(1));
      expect(playButton).not.toBeDisabled();
    });

    it('AudioContextがsuspendedへ戻ったら次の再生でTone.start()をやり直す（CodeRabbit PR#77指摘）', async () => {
      const audioEngine = createAudioEngineMock();
      render(<PlaybackControls audioEngine={audioEngine} />);

      const playButton = screen.getByTestId('playback-play');
      fireEvent.click(playButton);
      await waitFor(() => expect(usePracticeStore.getState().playbackState).toBe('playing'));
      expect(mockedToneStart).toHaveBeenCalledTimes(1);

      // 出力デバイスの切り替え等でAudioContextがsuspendedへ戻った状況を再現する。
      // 再生ボタンの再有効化（playbackState='stopped'）は再描画を伴うためactで包む。
      mockToneContext.state = 'suspended';
      await act(async () => {
        usePracticeStore.setState({ playbackState: 'stopped' });
      });

      fireEvent.click(screen.getByTestId('playback-play'));

      // 起動済みフラグだけで早期returnせず、再度Tone.start()を呼んで状態を検証する。
      await waitFor(() => expect(mockedToneStart).toHaveBeenCalledTimes(2));
      expect(window.alert).toHaveBeenCalledTimes(1);
      expect(usePracticeStore.getState().playbackState).toBe('stopped');
    });

    it('失敗後にもう一度クリックすると Tone.start() からやり直す', async () => {
      mockedToneStart.mockRejectedValueOnce(new Error('resume failed'));
      const audioEngine = createAudioEngineMock();
      render(<PlaybackControls audioEngine={audioEngine} />);

      fireEvent.click(screen.getByTestId('playback-play'));
      await waitFor(() => expect(window.alert).toHaveBeenCalledTimes(1));

      fireEvent.click(screen.getByTestId('playback-play'));

      await waitFor(() => expect(audioEngine.playAccompaniment).toHaveBeenCalledTimes(1));
      expect(Tone.start).toHaveBeenCalledTimes(2);
      expect(usePracticeStore.getState().playbackState).toBe('playing');
    });
  });

  describe('言語切り替え (TASK-097, US-016)', () => {
    it('shows English labels and tooltips when the store language is "en"', () => {
      usePracticeStore.setState({ language: 'en' });
      render(<PlaybackControls audioEngine={createAudioEngineMock()} />);

      const playButton = screen.getByTestId('playback-play');
      expect(playButton).toHaveTextContent('Play');
      expect(playButton).toHaveAttribute('title', 'Play (Space)');
      expect(screen.getByTestId('playback-pause')).toHaveTextContent('Pause');
      expect(screen.getByTestId('playback-stop')).toHaveTextContent('Stop');
    });
  });
});
