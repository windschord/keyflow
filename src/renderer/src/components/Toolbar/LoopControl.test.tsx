import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { LoopControl } from './LoopControl';
import { usePracticeStore } from '../../store';

// TASK-075: 「開始小節:」「終了小節:」「ループ」の可視ラベルはツールチップへ
// 移した（design/components/header.md）ため、可視テキストの存在ではなく
// title属性を検証する。
describe('LoopControl tooltips (TASK-075: compacted, labels moved to tooltips)', () => {
  beforeEach(() => {
    usePracticeStore.setState({ loopEnabled: false, loopStart: 1, loopEnd: 2 });
  });

  it('shows a tooltip for the loop toggle checkbox', () => {
    render(<LoopControl />);
    const checkbox = screen.getByRole('checkbox');
    const label = checkbox.closest('label');
    expect(label?.getAttribute('title')).toMatch(/ループ/);
  });

  it('shows a tooltip for the start measure input', () => {
    render(<LoopControl />);
    const startInput = screen.getByTestId('loop-start');
    expect(startInput.getAttribute('title')).toMatch(/開始/);
  });

  it('shows a tooltip for the end measure input', () => {
    render(<LoopControl />);
    const endInput = screen.getByTestId('loop-end');
    expect(endInput.getAttribute('title')).toMatch(/終了/);
  });

  it('gives the loop label and the range separator an explicit readable text color (TASK-054)', () => {
    render(<LoopControl />);
    const checkbox = screen.getByRole('checkbox');
    const label = checkbox.closest('label');
    // #374151 is the readable dark gray used elsewhere in the toolbar labels.
    expect(label?.style.color).toBe('rgb(55, 65, 81)');

    const separator = screen.getByText('–');
    expect(separator.style.color).toBe('rgb(55, 65, 81)');
  });

  it('shows an error when loop start >= end (検証を維持)', () => {
    render(<LoopControl />);
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
