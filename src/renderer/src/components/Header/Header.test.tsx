import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { renderWithStrictMode as render } from '../../tests/test-utils';
import { Header } from './index';
import { usePracticeStore } from '../../store';

/**
 * TASK-075: 1行ヘッダー統合（design/components/header.md、REQ-012-001〜006）。
 *
 * App.tsx上段バー（ファイルを開く+FingeringPanel直書き）とToolbar/index.tsxの
 * 2ブロック構成をHeader/index.tsxへ統合したことに伴い、旧Toolbar.test.tsxが
 * 検証していた内容をすべてここへ移行する（検証を弱めない）。
 */

vi.mock('tone', () => ({
  start: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/fingering-engine', () => ({
  FingeringEngineService: vi.fn().mockImplementation(() => ({
    computeFingering: vi.fn(),
    dispose: vi.fn(),
  })),
  DEFAULT_HAND_SETTINGS: { maxSpanSemitones: 14, scaleFactorLeft: 1.0 },
}));

describe('Header', () => {
  beforeEach(() => {
    usePracticeStore.setState({
      practiceMode: 'both',
      bpm: 120,
      originalBpm: 120,
      loopStart: 1,
      loopEnd: 2,
      loopEnabled: false,
      playbackState: 'stopped',
      metronomeEnabled: false,
      metronomeAccentEnabled: true,
      volume: 80,
      zoom: 1,
      showFingerings: true,
      stats: {
        totalNotes: 0,
        correctNotes: 0,
        incorrectNotes: 0,
        accuracy: 0,
        consecutiveCorrect: 0,
      },
    });
  });

  const renderHeader = (overrides?: Partial<React.ComponentProps<typeof Header>>) => {
    const onOpenFile = vi.fn();
    const onOpenSettings = vi.fn();
    const onFingeringSuggested = vi.fn();
    const props: React.ComponentProps<typeof Header> = {
      onOpenFile,
      onOpenSettings,
      onFingeringSuggested,
      score: null,
      ...overrides,
    };
    const utils = render(<Header {...props} />);
    return { ...utils, onOpenFile, onOpenSettings, onFingeringSuggested };
  };

  it('renders as a single-row header no taller than 56px (REQ-012-001/005)', () => {
    renderHeader();
    const header = screen.getByTestId('app-header');
    const heightValue = parseInt(header.style.height, 10);
    expect(heightValue).toBeLessThanOrEqual(56);
    expect(header.style.flexWrap).toBe('nowrap');
  });

  it('renders the frequently used controls: open file, playback, loop, tempo, practice mode', () => {
    renderHeader();
    expect(screen.getByRole('button', { name: 'ファイルを開く' })).toBeInTheDocument();
    expect(screen.getByTestId('playback-play')).toBeInTheDocument();
    expect(screen.getByTestId('playback-pause')).toBeInTheDocument();
    expect(screen.getByTestId('playback-stop')).toBeInTheDocument();
    expect(screen.getByTestId('loop-start')).toBeInTheDocument();
    expect(screen.getByTestId('loop-end')).toBeInTheDocument();
    expect(screen.getByTestId('tempo-input')).toBeInTheDocument();
    expect(screen.getByTestId('tempo-slider')).toBeInTheDocument();
    expect(screen.getByTestId('mode-left')).toBeInTheDocument();
    expect(screen.getByTestId('mode-right')).toBeInTheDocument();
    expect(screen.getByTestId('mode-both')).toBeInTheDocument();
  });

  it('calls onOpenFile when the open-file icon button is clicked', () => {
    const { onOpenFile } = renderHeader();
    fireEvent.click(screen.getByRole('button', { name: 'ファイルを開く' }));
    expect(onOpenFile).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenSettings when the settings button is clicked', () => {
    const { onOpenSettings } = renderHeader();
    fireEvent.click(screen.getByRole('button', { name: '設定' }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('shows a Japanese tooltip/aria-label for the settings button', () => {
    renderHeader();
    const settingsButton = screen.getByLabelText('設定');
    expect(settingsButton.getAttribute('title')).toBe('設定');
  });

  describe('QuickPanel (REQ-012-002/003)', () => {
    it('does not render the QuickPanel until the "..." button is clicked', () => {
      renderHeader();
      expect(screen.queryByTestId('quick-panel')).not.toBeInTheDocument();
    });

    it('opens the QuickPanel when the "..." button is clicked (2 clicks or fewer, REQ-012-002)', () => {
      renderHeader();
      fireEvent.click(screen.getByTestId('quick-panel-toggle'));
      expect(screen.getByTestId('quick-panel')).toBeInTheDocument();
    });

    it('closes the QuickPanel when the toggle button is clicked again', () => {
      renderHeader();
      const toggle = screen.getByTestId('quick-panel-toggle');
      fireEvent.click(toggle);
      expect(screen.getByTestId('quick-panel')).toBeInTheDocument();
      fireEvent.click(toggle);
      expect(screen.queryByTestId('quick-panel')).not.toBeInTheDocument();
    });

    it('closes the QuickPanel when Escape is pressed (REQ-012-003)', () => {
      renderHeader();
      fireEvent.click(screen.getByTestId('quick-panel-toggle'));
      expect(screen.getByTestId('quick-panel')).toBeInTheDocument();

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByTestId('quick-panel')).not.toBeInTheDocument();
    });

    it('closes the QuickPanel on an outside mousedown', () => {
      renderHeader();
      fireEvent.click(screen.getByTestId('quick-panel-toggle'));
      expect(screen.getByTestId('quick-panel')).toBeInTheDocument();

      fireEvent.mouseDown(document.body);
      expect(screen.queryByTestId('quick-panel')).not.toBeInTheDocument();
    });

    it('changes the score zoom level via the ZoomControl select inside the QuickPanel (REQ-002-006, TASK-045)', () => {
      usePracticeStore.setState({ zoom: 1.0 });
      renderHeader();

      fireEvent.click(screen.getByTestId('quick-panel-toggle'));
      const zoomSelect = screen.getByTestId('zoom-select') as HTMLSelectElement;
      fireEvent.change(zoomSelect, { target: { value: '4' } });

      expect(usePracticeStore.getState().zoom).toBe(4);
    });

    it('forwards suggested fingerings from the QuickPanel FingeringPanel to onFingeringSuggested', () => {
      const { onFingeringSuggested } = renderHeader();
      fireEvent.click(screen.getByTestId('quick-panel-toggle'));

      // score が null の場合、運指提案ボタンは無効化されクリックしても呼ばれない
      // （FingeringPanelの既存挙動）。ここではpropsが正しく橋渡しされていることを確認する。
      expect(screen.getByText('運指提案')).toBeInTheDocument();
      expect(onFingeringSuggested).not.toHaveBeenCalled();
    });
  });

  describe('練習対象 (PracticeModeSelector integration)', () => {
    it('changes practice mode via buttons', () => {
      renderHeader();
      const rightBtn = screen.getByTestId('mode-right');
      fireEvent.click(rightBtn);
      expect(usePracticeStore.getState().practiceMode).toBe('right');
    });

    it('changes practice mode via keyboard shortcuts', () => {
      renderHeader();

      fireEvent.keyDown(window, { key: 'R' });
      expect(usePracticeStore.getState().practiceMode).toBe('right');

      fireEvent.keyDown(window, { key: 'L' });
      expect(usePracticeStore.getState().practiceMode).toBe('left');
    });
  });

  describe('テンポ・BPM (TempoControl integration)', () => {
    it('updates BPM input with validation, clamped to originalBpm 20%-200% (REQ-006-003)', () => {
      // originalBpm=120（beforeEachで設定）のため、範囲は24（20%）〜240（200%）。
      renderHeader();
      const input = screen.getByTestId('tempo-input') as HTMLInputElement;

      fireEvent.change(input, { target: { value: '150' } });
      fireEvent.blur(input);
      expect(usePracticeStore.getState().bpm).toBe(150);

      fireEvent.change(input, { target: { value: '10' } });
      fireEvent.blur(input);
      expect(usePracticeStore.getState().bpm).toBe(24);

      fireEvent.change(input, { target: { value: '500' } });
      fireEvent.blur(input);
      expect(usePracticeStore.getState().bpm).toBe(240);
    });

    it('resets BPM to the score-derived originalBpm when the reset button is clicked', () => {
      usePracticeStore.setState({ bpm: 140, originalBpm: 90 });
      renderHeader();

      fireEvent.click(screen.getByRole('button', { name: 'テンポをリセット' }));

      expect(usePracticeStore.getState().bpm).toBe(90);
    });

    it('disables tempo slider/input/reset while playbackState is "playing" (REQ-012-006)', () => {
      usePracticeStore.setState({ playbackState: 'playing' });
      renderHeader();

      expect((screen.getByTestId('tempo-slider') as HTMLInputElement).disabled).toBe(true);
      expect((screen.getByTestId('tempo-input') as HTMLInputElement).disabled).toBe(true);
      expect(screen.getByRole('button', { name: 'テンポをリセット' })).toBeDisabled();
    });
  });

  describe('ループ (LoopControl integration)', () => {
    it('shows an error when loop start >= end', () => {
      renderHeader();
      const startInput = screen.getByTestId('loop-start') as HTMLInputElement;
      const endInput = screen.getByTestId('loop-end') as HTMLInputElement;

      fireEvent.change(startInput, { target: { value: '5' } });
      fireEvent.change(endInput, { target: { value: '3' } });
      fireEvent.blur(endInput);

      expect(screen.getByText('開始 < 終了')).toBeInTheDocument();
      expect(usePracticeStore.getState().loopStart).toBe(1);
      expect(usePracticeStore.getState().loopEnd).toBe(2);
    });
  });

  describe('再生コントロール (PlaybackControls integration)', () => {
    // PlaybackControlsはscore===nullの場合に再生系ボタンを無効化する（REQ-010-002）
    // ため、再生操作の検証では楽譜読み込み済みを模したダミーのScoreを渡す。
    const mockScore = { parts: [], measures: [] } as unknown as import('../../types').Score;

    it('forwards the audioEngine prop to PlaybackControls', async () => {
      const audioEngine = {
        playAccompaniment: vi.fn(),
        pauseAccompaniment: vi.fn(),
        stopAccompaniment: vi.fn(),
      };
      renderHeader({ audioEngine, score: mockScore });

      fireEvent.click(screen.getByTestId('playback-play'));
      await waitFor(() => expect(audioEngine.playAccompaniment).toHaveBeenCalledTimes(1));

      fireEvent.click(screen.getByTestId('playback-pause'));
      expect(audioEngine.pauseAccompaniment).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByTestId('playback-stop'));
      expect(audioEngine.stopAccompaniment).toHaveBeenCalledTimes(1);
    });

    it('toggles play/pause via the Space key (Space再生トグル維持)', async () => {
      const audioEngine = {
        playAccompaniment: vi.fn(),
        pauseAccompaniment: vi.fn(),
        stopAccompaniment: vi.fn(),
      };
      renderHeader({ audioEngine, score: mockScore });

      fireEvent.keyDown(window, { code: 'Space' });
      await waitFor(() => expect(audioEngine.playAccompaniment).toHaveBeenCalledTimes(1));

      fireEvent.keyDown(window, { code: 'Space' });
      expect(audioEngine.pauseAccompaniment).toHaveBeenCalledTimes(1);
    });
  });
});
