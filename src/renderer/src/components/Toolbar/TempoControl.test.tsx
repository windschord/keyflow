import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { TempoControl } from './TempoControl';
import { usePracticeStore } from '../../store';

describe('TempoControl labels and tooltips', () => {
  beforeEach(() => {
    usePracticeStore.setState({ bpm: 120, originalBpm: 120, metronomeEnabled: false });
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
    const checkbox = screen.getByRole('checkbox');
    const label = checkbox.closest('label');
    expect(label?.getAttribute('title')).toMatch(/メトロノーム/);
  });
});
