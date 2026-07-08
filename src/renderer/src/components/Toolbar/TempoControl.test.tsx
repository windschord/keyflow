import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { TempoControl } from './TempoControl';
import { usePracticeStore } from '../../store';

// TASK-075: メトロノーム関連チェックボックスはHeader/MetronomeToggle.tsx
// （QuickPanel内）へ移設した。移設先の挙動はMetronomeToggle.test.tsxで
// 検証済みのため、本ファイルではテンポ系のみを検証する。
// また「テンポ:」「BPM:」の可視ラベルはツールチップ（title属性）へ
// 移したため、可視テキストの存在ではなくtitle属性を検証する
// （design/components/header.md: ラベルテキストのツールチップ化）。
describe('TempoControl tooltips (TASK-075: compacted, labels moved to tooltips)', () => {
  beforeEach(() => {
    usePracticeStore.setState({
      bpm: 120,
      originalBpm: 120,
      playbackState: 'stopped',
    });
  });

  it('shows a tooltip explaining the tempo slider purpose', () => {
    render(<TempoControl />);
    const slider = screen.getByTestId('tempo-slider');
    expect(slider.getAttribute('title')).toMatch(/テンポ/);
  });

  it('shows a tooltip explaining the BPM input purpose', () => {
    render(<TempoControl />);
    const input = screen.getByTestId('tempo-input');
    expect(input.getAttribute('title')).toMatch(/BPM|テンポ/);
  });

  it('shows a tooltip for the reset button', () => {
    render(<TempoControl />);
    const resetButton = screen.getByRole('button', { name: 'テンポをリセット' });
    expect(resetButton.getAttribute('title')).toBeTruthy();
  });

  it('does not render metronome checkboxes (moved to Header/MetronomeToggle.tsx, TASK-075)', () => {
    render(<TempoControl />);
    expect(screen.queryByTestId('metronome-checkbox')).not.toBeInTheDocument();
    expect(screen.queryByTestId('metronome-accent-checkbox')).not.toBeInTheDocument();
  });
});

// TASK-067: 再生中はテンポ設定UI（スライダー・数値入力・リセット）を無効化する
// （REQ-006-010、ユーザー要望2026-07-07）。
describe('TempoControl playback lock (TASK-067, REQ-006-010)', () => {
  beforeEach(() => {
    usePracticeStore.setState({
      bpm: 120,
      originalBpm: 120,
      playbackState: 'stopped',
    });
  });

  it('disables the tempo slider, BPM input, and reset button while playbackState is "playing"', () => {
    usePracticeStore.setState({ playbackState: 'playing' });
    render(<TempoControl />);

    expect((screen.getByTestId('tempo-slider') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByTestId('tempo-input') as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'テンポをリセット' })).toBeDisabled();
  });

  it.each(['stopped', 'paused'] as const)(
    'keeps the tempo slider, BPM input, and reset button operable while playbackState is "%s"',
    (playbackState) => {
      usePracticeStore.setState({ playbackState });
      render(<TempoControl />);

      expect((screen.getByTestId('tempo-slider') as HTMLInputElement).disabled).toBe(false);
      expect((screen.getByTestId('tempo-input') as HTMLInputElement).disabled).toBe(false);
      expect(screen.getByRole('button', { name: 'テンポをリセット' })).not.toBeDisabled();
    }
  );
});
