import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { VolumeControl } from './VolumeControl';
import { usePracticeStore } from '../../store';

// TASK-052: マスターボリューム調整UI（REQ: ツールバーの音量スライダーで音量が変わる、
// スライダー0でミュート、日本語ラベル・ツールチップがある）。
describe('VolumeControl labels and behavior', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).electronAPI;
    usePracticeStore.setState({ volume: 80 });
  });

  it('shows a Japanese label for the volume slider and a tooltip explaining its purpose', () => {
    render(<VolumeControl />);
    const slider = screen.getByTestId('volume-slider');
    expect(screen.getByText('音量:')).toBeInTheDocument();
    expect(slider.getAttribute('title')).toMatch(/音量/);
  });

  it('reflects the current store volume value in the slider', () => {
    usePracticeStore.setState({ volume: 45 });
    render(<VolumeControl />);
    const slider = screen.getByTestId('volume-slider') as HTMLInputElement;
    expect(slider.value).toBe('45');
  });

  it('calls setVolume immediately when the slider is moved', () => {
    render(<VolumeControl />);
    const slider = screen.getByTestId('volume-slider') as HTMLInputElement;

    fireEvent.change(slider, { target: { value: '30' } });

    expect(usePracticeStore.getState().volume).toBe(30);
  });

  it('allows setting the slider to 0 (mute)', () => {
    render(<VolumeControl />);
    const slider = screen.getByTestId('volume-slider') as HTMLInputElement;

    fireEvent.change(slider, { target: { value: '0' } });

    expect(usePracticeStore.getState().volume).toBe(0);
    expect(slider.value).toBe('0');
  });

  it('has min=0 and max=100', () => {
    render(<VolumeControl />);
    const slider = screen.getByTestId('volume-slider') as HTMLInputElement;
    expect(slider.min).toBe('0');
    expect(slider.max).toBe('100');
  });

  it('persists the new volume to electron-store, merging with the existing ui settings', async () => {
    const getMock = vi.fn().mockResolvedValue({
      theme: 'light',
      language: 'ja',
      zoom: 1,
      pianoHeight: 120,
      volume: 80,
    });
    const setMock = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).electronAPI = {
      settings: { get: getMock, set: setMock, getRecentFiles: vi.fn() },
    };

    render(<VolumeControl />);
    const slider = screen.getByTestId('volume-slider') as HTMLInputElement;

    fireEvent.change(slider, { target: { value: '20' } });

    await vi.waitFor(() => expect(setMock).toHaveBeenCalled());
    expect(setMock).toHaveBeenCalledWith(
      'ui',
      expect.objectContaining({ theme: 'light', pianoHeight: 120, volume: 20 })
    );
  });

  it('does not throw when electronAPI is unavailable while changing volume', () => {
    render(<VolumeControl />);
    const slider = screen.getByTestId('volume-slider') as HTMLInputElement;

    expect(() => fireEvent.change(slider, { target: { value: '10' } })).not.toThrow();
    expect(usePracticeStore.getState().volume).toBe(10);
  });
});
