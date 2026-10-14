import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { FingeringEditToggle } from './FingeringEditToggle';
import { usePracticeStore } from '../../store';

// 指法编辑模式开关（受控组件：checked/onChange 由 App 持有）。
// ja 显示日语文案（'運指編集'），ON/OFF 状态沿用英文（日语习惯用法）。

describe('FingeringEditToggle', () => {
  beforeEach(() => {
    usePracticeStore.setState({ language: 'ja' });
  });

  it('shows the "運指編集" label', () => {
    render(<FingeringEditToggle checked={false} onChange={() => {}} />);
    expect(screen.getByText('運指編集')).toBeInTheDocument();
  });

  it('reflects the checked state via aria-pressed and the ON/OFF status text', () => {
    render(<FingeringEditToggle checked={true} onChange={() => {}} />);
    const button = screen.getByTestId('fingering-edit-toggle');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('ON')).toBeInTheDocument();
  });

  it('shows OFF status text when unchecked', () => {
    render(<FingeringEditToggle checked={false} onChange={() => {}} />);
    expect(screen.getByText('OFF')).toBeInTheDocument();
  });

  it('calls onChange with the inverted value when clicked', () => {
    const onChange = vi.fn();
    render(<FingeringEditToggle checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('fingering-edit-toggle'));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
