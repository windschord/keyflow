import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { PracticeModeSelector } from './PracticeModeSelector';
import { usePracticeStore } from '../../store';

describe('PracticeModeSelector labels and tooltips', () => {
  beforeEach(() => {
    usePracticeStore.setState({ practiceMode: 'both' });
  });

  afterEach(() => {
    usePracticeStore.setState({ practiceMode: 'both' });
  });

  it('shows a group label distinguishing this control from fingering target selection', () => {
    render(<PracticeModeSelector />);
    expect(screen.getByText('練習対象:')).toBeInTheDocument();
  });

  it('shows Japanese labels with keyboard shortcut hints for each mode button', () => {
    render(<PracticeModeSelector />);

    const left = screen.getByTestId('mode-left');
    const right = screen.getByTestId('mode-right');
    const both = screen.getByTestId('mode-both');

    expect(left.textContent).toMatch(/左手/);
    expect(right.textContent).toMatch(/右手/);
    expect(both.textContent).toMatch(/両手/);

    expect(left.getAttribute('title')).toMatch(/L/);
    expect(right.getAttribute('title')).toMatch(/R/);
    expect(both.getAttribute('title')).toMatch(/B/);
  });
});
