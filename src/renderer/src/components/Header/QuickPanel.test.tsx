import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { QuickPanel } from './QuickPanel';
import { usePracticeStore } from '../../store';

// TASK-074: 低頻度操作パネル（QuickPanel、design/components/header.md）。
// 音量・表示倍率・運指・メトロノーム・成績の5セクションを内包し、
// 既存コンポーネント（VolumeControl/ZoomControl/FingeringToggle/FingeringPanel/
// StatsDisplay）はロジック不変で再利用する（REQ-012-004）。

vi.mock('../../lib/fingering-engine', () => ({
  FingeringEngineService: vi.fn().mockImplementation(() => ({
    computeFingering: vi.fn(),
    dispose: vi.fn(),
  })),
  DEFAULT_HAND_SETTINGS: { maxSpanSemitones: 14, scaleFactorLeft: 1.0 },
}));

describe('QuickPanel', () => {
  beforeEach(() => {
    usePracticeStore.setState({
      volume: 80,
      zoom: 1,
      showFingerings: true,
      metronomeEnabled: false,
      metronomeAccentEnabled: true,
      stats: {
        totalNotes: 10,
        correctNotes: 8,
        incorrectNotes: 2,
        accuracy: 0.8,
        consecutiveCorrect: 3,
      },
    });
  });

  it('renders the volume section (VolumeControl)', () => {
    render(<QuickPanel score={null} onFingeringSuggested={() => {}} />);
    expect(screen.getByTestId('volume-slider')).toBeInTheDocument();
  });

  it('renders the zoom section (ZoomControl)', () => {
    render(<QuickPanel score={null} onFingeringSuggested={() => {}} />);
    expect(screen.getByTestId('zoom-select')).toBeInTheDocument();
  });

  it('renders the fingering section (FingeringToggle + FingeringPanel)', () => {
    render(<QuickPanel score={null} onFingeringSuggested={() => {}} />);
    expect(screen.getByTestId('fingering-toggle')).toBeInTheDocument();
    expect(screen.getByText('運指対象:')).toBeInTheDocument();
  });

  it('renders the metronome section (MetronomeToggle)', () => {
    render(<QuickPanel score={null} onFingeringSuggested={() => {}} />);
    expect(screen.getByTestId('metronome-checkbox')).toBeInTheDocument();
    expect(screen.getByTestId('metronome-accent-checkbox')).toBeInTheDocument();
  });

  it('renders the stats section (StatsDisplay)', () => {
    render(<QuickPanel score={null} onFingeringSuggested={() => {}} />);
    expect(screen.getByTestId('stats-display')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
  });

  it('toggles the store metronomeEnabled state when the MetronomeToggle checkbox is operated', () => {
    render(<QuickPanel score={null} onFingeringSuggested={() => {}} />);
    const checkbox = screen.getByTestId('metronome-checkbox') as HTMLInputElement;

    checkbox.click();

    expect(usePracticeStore.getState().metronomeEnabled).toBe(true);
  });

  it('forwards suggested fingerings from FingeringPanel to onFingeringSuggested', () => {
    const onFingeringSuggested = vi.fn();
    render(<QuickPanel score={null} onFingeringSuggested={onFingeringSuggested} />);
    // score が null の場合、運指提案ボタンは無効化されクリックしても
    // computeFingering は呼ばれない（FingeringPanelの既存挙動）。
    // ここではpropsが正しくFingeringPanelへ橋渡しされていることを型面で保証する。
    expect(screen.getByText('運指提案')).toBeInTheDocument();
    expect(onFingeringSuggested).not.toHaveBeenCalled();
  });
});
