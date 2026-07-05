import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ZoomControl } from './ZoomControl';
import { usePracticeStore } from '../../store';

// TASK-045: ズームUI（REQ-002-006）。ScoreRenderer→osmd-controller.setZoomの
// パイプラインは既に確立されており（ui-slice.setZoom）、本コンポーネントは
// それを呼び出すUIを提供する。モーダルを開かずとも「即座に更新」される
// ことが要件のため、Toolbarに常設する。
describe('ZoomControl labels and behavior', () => {
  beforeEach(() => {
    usePracticeStore.setState({ zoom: 1.0 });
  });

  it('shows a Japanese label for the zoom selector and a tooltip explaining its purpose', () => {
    render(<ZoomControl />);
    const select = screen.getByTestId('zoom-select');
    expect(screen.getByText('表示倍率:')).toBeInTheDocument();
    expect(select.getAttribute('title')).toMatch(/倍率|ズーム/);
  });

  it('reflects the current store zoom value in the selector', () => {
    usePracticeStore.setState({ zoom: 1.5 });
    render(<ZoomControl />);
    const select = screen.getByTestId('zoom-select') as HTMLSelectElement;
    expect(select.value).toBe('1.5');
  });

  it('calls setZoom immediately when a new value is selected (no modal, no extra confirm step)', () => {
    render(<ZoomControl />);
    const select = screen.getByTestId('zoom-select') as HTMLSelectElement;

    fireEvent.change(select, { target: { value: '4' } });

    expect(usePracticeStore.getState().zoom).toBe(4);
  });

  it('offers a range of zoom levels including a 400% option (used by E2E scroll verification)', () => {
    render(<ZoomControl />);
    const select = screen.getByTestId('zoom-select') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toContain('4');
  });
});
