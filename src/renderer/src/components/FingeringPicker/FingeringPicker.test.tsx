import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { FingeringPicker } from './index';
import { usePracticeStore } from '../../store';

// 指法编辑模式中点击乐谱上的指法数字后弹出的数字选择条（1-5）。
// 选择后立即通过 onSelectFinger 修改指法；Esc 或点击外部关闭。

describe('FingeringPicker', () => {
  beforeEach(() => {
    usePracticeStore.setState({ language: 'ja' });
  });

  it('shows the finger options 1 through 5', () => {
    render(
      <FingeringPicker
        noteId="P1-M1-N0"
        x={0}
        y={0}
        onSelectFinger={() => {}}
        onClose={() => {}}
      />
    );
    for (const finger of [1, 2, 3, 4, 5]) {
      expect(screen.getByTestId(`finger-pick-option-${finger}`)).toBeInTheDocument();
    }
  });

  it('highlights the current finger with aria-pressed', () => {
    render(
      <FingeringPicker
        noteId="P1-M1-N0"
        x={0}
        y={0}
        currentFinger={3}
        onSelectFinger={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.getByTestId('finger-pick-option-3').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('finger-pick-option-1').getAttribute('aria-pressed')).toBe('false');
  });

  it('calls onSelectFinger with the noteId and the chosen finger', () => {
    const onSelectFinger = vi.fn();
    render(
      <FingeringPicker
        noteId="P1-M1-N0"
        x={0}
        y={0}
        onSelectFinger={onSelectFinger}
        onClose={() => {}}
      />
    );
    fireEvent.click(screen.getByTestId('finger-pick-option-4'));
    expect(onSelectFinger).toHaveBeenCalledWith('P1-M1-N0', 4);
  });

  it('closes on Escape key', () => {
    const onClose = vi.fn();
    render(
      <FingeringPicker
        noteId="P1-M1-N0"
        x={0}
        y={0}
        onSelectFinger={() => {}}
        onClose={onClose}
      />
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('closes when clicking outside the picker', () => {
    const onClose = vi.fn();
    render(
      <FingeringPicker
        noteId="P1-M1-N0"
        x={0}
        y={0}
        onSelectFinger={() => {}}
        onClose={onClose}
      />
    );
    fireEvent.pointerDown(document.body);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not close when clicking inside the picker', () => {
    const onClose = vi.fn();
    render(
      <FingeringPicker
        noteId="P1-M1-N0"
        x={0}
        y={0}
        onSelectFinger={() => {}}
        onClose={onClose}
      />
    );
    fireEvent.pointerDown(screen.getByTestId('finger-pick-option-1'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
