import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { TempoControl } from './TempoControl';
import { usePracticeStore } from '../../store';

describe('TempoControl labels and tooltips', () => {
  beforeEach(() => {
    usePracticeStore.setState({
      bpm: 120,
      originalBpm: 120,
      metronomeEnabled: false,
      metronomeAccentEnabled: true,
      playbackState: 'stopped',
    });
  });

  it('shows a Japanese label for the tempo slider and a tooltip explaining its purpose', () => {
    render(<TempoControl />);
    const slider = screen.getByTestId('tempo-slider');
    expect(screen.getByText('テンポ:')).toBeInTheDocument();
    expect(slider.getAttribute('title')).toMatch(/テンポ/);
  });

  it('shows a Japanese label for the BPM input and a tooltip explaining its purpose', () => {
    render(<TempoControl />);
    const input = screen.getByTestId('tempo-input');
    expect(screen.getByText('BPM:')).toBeInTheDocument();
    expect(input.getAttribute('title')).toMatch(/BPM|テンポ/);
  });

  it('shows a Japanese label for the reset button with a tooltip', () => {
    render(<TempoControl />);
    const resetButton = screen.getByText('リセット');
    expect(resetButton.getAttribute('title')).toBeTruthy();
  });

  it('shows a Japanese label for the metronome checkbox with a tooltip', () => {
    render(<TempoControl />);
    expect(screen.getByText('メトロノーム')).toBeInTheDocument();
    const checkbox = screen.getByTestId('metronome-checkbox');
    const label = checkbox.closest('label');
    expect(label?.getAttribute('title')).toMatch(/メトロノーム/);
  });

  it('gives the metronome label an explicit readable text color (TASK-054)', () => {
    render(<TempoControl />);
    const checkbox = screen.getByTestId('metronome-checkbox');
    const label = checkbox.closest('label');
    // #374151 is the readable dark gray used elsewhere in the toolbar labels.
    expect(label?.style.color).toBe('rgb(55, 65, 81)');
  });
});

// TASK-063: メトロノームの一拍目アクセント有効/無効チェックボックス（REQ-006-008）。
// 配置はツールバーのメトロノームチェックボックス横、既定でON。
describe('TempoControl metronome accent checkbox (TASK-063, REQ-006-008)', () => {
  beforeEach(() => {
    usePracticeStore.setState({
      bpm: 120,
      originalBpm: 120,
      metronomeEnabled: false,
      metronomeAccentEnabled: true,
      playbackState: 'stopped',
    });
  });

  it('shows a Japanese "1拍目強調" checkbox next to the metronome checkbox, checked by default', () => {
    render(<TempoControl />);
    const checkbox = screen.getByTestId('metronome-accent-checkbox') as HTMLInputElement;
    expect(screen.getByText('1拍目強調')).toBeInTheDocument();
    expect(checkbox.checked).toBe(true);
  });

  it('calls setMetronomeAccentEnabled(false) and reflects the store when unchecked', () => {
    render(<TempoControl />);
    const checkbox = screen.getByTestId('metronome-accent-checkbox') as HTMLInputElement;

    checkbox.click();

    expect(usePracticeStore.getState().metronomeAccentEnabled).toBe(false);
  });

  it('remains operable when the metronome itself is OFF (not disabled)', () => {
    usePracticeStore.setState({ metronomeEnabled: false });
    render(<TempoControl />);
    const checkbox = screen.getByTestId('metronome-accent-checkbox') as HTMLInputElement;

    expect(checkbox.disabled).toBe(false);
  });
});

// TASK-067: 再生中はテンポ設定UI（スライダー・数値入力・リセット）を無効化する
// （REQ-006-010、ユーザー要望2026-07-07）。メトロノーム系チェックボックスは対象外。
describe('TempoControl playback lock (TASK-067, REQ-006-010)', () => {
  beforeEach(() => {
    usePracticeStore.setState({
      bpm: 120,
      originalBpm: 120,
      metronomeEnabled: false,
      metronomeAccentEnabled: true,
      playbackState: 'stopped',
    });
  });

  it('disables the tempo slider, BPM input, and reset button while playbackState is "playing"', () => {
    usePracticeStore.setState({ playbackState: 'playing' });
    render(<TempoControl />);

    expect((screen.getByTestId('tempo-slider') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByTestId('tempo-input') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByText('リセット') as HTMLButtonElement).disabled).toBe(true);
  });

  it.each(['stopped', 'paused'] as const)(
    'keeps the tempo slider, BPM input, and reset button operable while playbackState is "%s"',
    (playbackState) => {
      usePracticeStore.setState({ playbackState });
      render(<TempoControl />);

      expect((screen.getByTestId('tempo-slider') as HTMLInputElement).disabled).toBe(false);
      expect((screen.getByTestId('tempo-input') as HTMLInputElement).disabled).toBe(false);
      expect((screen.getByText('リセット') as HTMLButtonElement).disabled).toBe(false);
    }
  );

  it('keeps the metronome and accent checkboxes operable while playbackState is "playing"', () => {
    usePracticeStore.setState({ playbackState: 'playing' });
    render(<TempoControl />);

    expect((screen.getByTestId('metronome-checkbox') as HTMLInputElement).disabled).toBe(false);
    expect((screen.getByTestId('metronome-accent-checkbox') as HTMLInputElement).disabled).toBe(
      false
    );
  });
});
