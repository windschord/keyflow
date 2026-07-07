import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MetronomeToggle } from './MetronomeToggle';
import { usePracticeStore } from '../../store';

// TASK-074: TempoControlから分離した、QuickPanel専用のメトロノームON/OFF+
// 1拍目強調トグル。Zustandのmetronomeenabled/metronomeAccentEnabledを
// 既存TempoControlと同じ経路（同一のstoreアクション）で操作する。

describe('MetronomeToggle', () => {
  beforeEach(() => {
    usePracticeStore.setState({
      metronomeEnabled: false,
      metronomeAccentEnabled: true,
    });
  });

  it('shows a Japanese "メトロノーム" checkbox reflecting the store state', () => {
    render(<MetronomeToggle />);
    const checkbox = screen.getByTestId('metronome-checkbox') as HTMLInputElement;
    expect(screen.getByText('メトロノーム')).toBeInTheDocument();
    expect(checkbox.checked).toBe(false);
  });

  it('shows a Japanese "1拍目強調" checkbox reflecting the store state', () => {
    render(<MetronomeToggle />);
    const checkbox = screen.getByTestId('metronome-accent-checkbox') as HTMLInputElement;
    expect(screen.getByText('1拍目強調')).toBeInTheDocument();
    expect(checkbox.checked).toBe(true);
  });

  it('calls setMetronomeEnabled and updates the store when the metronome checkbox is clicked', () => {
    render(<MetronomeToggle />);
    const checkbox = screen.getByTestId('metronome-checkbox') as HTMLInputElement;

    checkbox.click();

    expect(usePracticeStore.getState().metronomeEnabled).toBe(true);
  });

  it('calls setMetronomeAccentEnabled and updates the store when the accent checkbox is clicked', () => {
    render(<MetronomeToggle />);
    const checkbox = screen.getByTestId('metronome-accent-checkbox') as HTMLInputElement;

    checkbox.click();

    expect(usePracticeStore.getState().metronomeAccentEnabled).toBe(false);
  });

  it('remains operable regardless of playbackState (QuickPanel is not disabled while playing)', () => {
    usePracticeStore.setState({ playbackState: 'playing' });
    render(<MetronomeToggle />);

    expect((screen.getByTestId('metronome-checkbox') as HTMLInputElement).disabled).toBe(false);
    expect((screen.getByTestId('metronome-accent-checkbox') as HTMLInputElement).disabled).toBe(
      false
    );
  });
});
