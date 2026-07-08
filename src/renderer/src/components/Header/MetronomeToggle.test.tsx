import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MetronomeToggle, MetronomeAccentToggle } from './MetronomeToggle';
import { usePracticeStore } from '../../store';

// TASK-079: 2026-07-08のユーザー実機フィードバック（DEC-007改訂）により、
// メトロノームON/OFFはヘッダー常駐のアイコントグル（MetronomeToggle）へ移動し、
// 1拍目強調のみがQuickPanel向けの`MetronomeAccentToggle`として残る。

describe('MetronomeToggle (ヘッダー常駐、ON/OFFのみ)', () => {
  beforeEach(() => {
    usePracticeStore.setState({
      metronomeEnabled: false,
      metronomeAccentEnabled: true,
      playbackState: 'stopped',
    });
  });

  it('renders an icon button with a Japanese tooltip/aria-label "メトロノーム"', () => {
    render(<MetronomeToggle />);
    const button = screen.getByTestId('metronome-toggle');
    expect(button.getAttribute('title')).toBe('メトロノーム');
    expect(button.getAttribute('aria-label')).toBe('メトロノーム');
  });

  it('reflects metronomeEnabled=false as aria-pressed="false"', () => {
    render(<MetronomeToggle />);
    expect(screen.getByTestId('metronome-toggle')).toHaveAttribute('aria-pressed', 'false');
  });

  it('reflects metronomeEnabled=true as aria-pressed="true"', () => {
    usePracticeStore.setState({ metronomeEnabled: true });
    render(<MetronomeToggle />);
    expect(screen.getByTestId('metronome-toggle')).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls setMetronomeEnabled and updates the store when clicked', () => {
    render(<MetronomeToggle />);
    const button = screen.getByTestId('metronome-toggle');

    button.click();

    expect(usePracticeStore.getState().metronomeEnabled).toBe(true);
  });

  it('remains operable regardless of playbackState (現行仕様維持、再生中も操作可能)', () => {
    usePracticeStore.setState({ playbackState: 'playing' });
    render(<MetronomeToggle />);
    const button = screen.getByTestId('metronome-toggle') as HTMLButtonElement;

    expect(button.disabled).toBe(false);
    button.click();

    expect(usePracticeStore.getState().metronomeEnabled).toBe(true);
  });
});

describe('MetronomeAccentToggle (QuickPanel、1拍目強調のみ)', () => {
  beforeEach(() => {
    usePracticeStore.setState({
      metronomeEnabled: false,
      metronomeAccentEnabled: true,
    });
  });

  it('shows a Japanese "1拍目強調" checkbox reflecting the store state', () => {
    render(<MetronomeAccentToggle />);
    const checkbox = screen.getByTestId('metronome-accent-checkbox') as HTMLInputElement;
    expect(screen.getByText('1拍目強調')).toBeInTheDocument();
    expect(checkbox.checked).toBe(true);
  });

  it('calls setMetronomeAccentEnabled and updates the store when the checkbox is clicked', () => {
    render(<MetronomeAccentToggle />);
    const checkbox = screen.getByTestId('metronome-accent-checkbox') as HTMLInputElement;

    checkbox.click();

    expect(usePracticeStore.getState().metronomeAccentEnabled).toBe(false);
  });

  it('remains operable regardless of playbackState (QuickPanel is not disabled while playing)', () => {
    usePracticeStore.setState({ playbackState: 'playing' });
    render(<MetronomeAccentToggle />);

    expect((screen.getByTestId('metronome-accent-checkbox') as HTMLInputElement).disabled).toBe(
      false
    );
  });
});
