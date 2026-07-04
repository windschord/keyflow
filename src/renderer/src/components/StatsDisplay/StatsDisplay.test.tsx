import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { StatsDisplay } from './index';
import { usePracticeStore } from '../../store';

describe('StatsDisplay (US-004: 正解率・連続正解数の可視化)', () => {
  beforeEach(() => {
    usePracticeStore.setState({
      stats: { totalNotes: 0, correctNotes: 0, incorrectNotes: 0, accuracy: 0, consecutiveCorrect: 0 },
    });
  });

  it('displays 0% accuracy and 0 consecutive correct notes with Japanese labels initially', () => {
    render(<StatsDisplay />);

    expect(screen.getByTestId('stats-accuracy')).toHaveTextContent('正解率: 0%');
    expect(screen.getByTestId('stats-consecutive-correct')).toHaveTextContent('連続正解数: 0');
  });

  it('reflects updated stats from the store (accuracy as a rounded percentage)', () => {
    usePracticeStore.setState({
      stats: {
        totalNotes: 4,
        correctNotes: 3,
        incorrectNotes: 1,
        accuracy: 0.75,
        consecutiveCorrect: 3,
      },
    });

    render(<StatsDisplay />);

    expect(screen.getByTestId('stats-accuracy')).toHaveTextContent('正解率: 75%');
    expect(screen.getByTestId('stats-consecutive-correct')).toHaveTextContent('連続正解数: 3');
  });

  it('re-renders when the store stats change after mount', () => {
    render(<StatsDisplay />);
    expect(screen.getByTestId('stats-consecutive-correct')).toHaveTextContent('連続正解数: 0');

    act(() => {
      usePracticeStore.setState({
        stats: {
          totalNotes: 1,
          correctNotes: 1,
          incorrectNotes: 0,
          accuracy: 1,
          consecutiveCorrect: 1,
        },
      });
    });

    expect(screen.getByTestId('stats-consecutive-correct')).toHaveTextContent('連続正解数: 1');
    expect(screen.getByTestId('stats-accuracy')).toHaveTextContent('正解率: 100%');
  });
});
