import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { LoopControl } from './LoopControl';
import { usePracticeStore } from '../../store';

describe('LoopControl labels and tooltips', () => {
  beforeEach(() => {
    usePracticeStore.setState({ loopEnabled: false, loopStart: 1, loopEnd: 2 });
  });

  it('shows a Japanese label for the loop checkbox with a tooltip', () => {
    render(<LoopControl />);
    expect(screen.getByText('ループ')).toBeInTheDocument();
    const checkbox = screen.getByRole('checkbox');
    const label = checkbox.closest('label');
    expect(label?.getAttribute('title')).toMatch(/ループ/);
  });

  it('shows a Japanese label and tooltip for the start measure input', () => {
    render(<LoopControl />);
    const startInput = screen.getByTestId('loop-start');
    expect(screen.getByText('開始小節:')).toBeInTheDocument();
    expect(startInput.getAttribute('title')).toMatch(/開始/);
  });

  it('shows a Japanese label and tooltip for the end measure input', () => {
    render(<LoopControl />);
    const endInput = screen.getByTestId('loop-end');
    expect(screen.getByText('終了小節:')).toBeInTheDocument();
    expect(endInput.getAttribute('title')).toMatch(/終了/);
  });
});
