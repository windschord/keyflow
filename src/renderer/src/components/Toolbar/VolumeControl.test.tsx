import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { VolumeControl } from './VolumeControl';
import { usePracticeStore } from '../../store';

// TASK-052: マスターボリューム調整UI（REQ: ツールバーの音量スライダーで音量が変わる、
// スライダー0でミュート、日本語ラベル・ツールチップがある）。

// テスト用にelectronAPIを差し替えるためのwindow参照。実際のElectronAPI型全体を
// モックする必要はないため、settings部分のみを持つ構造的な型でキャストする
// （`any` 禁止ルールに従い、unknown経由の限定的なキャストを使う）。
const testWindow = window as unknown as {
  electronAPI?: {
    settings: {
      get: ReturnType<typeof vi.fn>;
      set: ReturnType<typeof vi.fn>;
      getRecentFiles: ReturnType<typeof vi.fn>;
    };
  };
};

describe('VolumeControl labels and behavior', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete testWindow.electronAPI;
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
    testWindow.electronAPI = {
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

  // CodeRabbit PR#25指摘#1: get('ui')→set('ui')の非同期read-modify-writeは、
  // rangeのonChange高頻度発火で並行実行されると解決順序が入れ替わりうる。
  // 後から開始した書き込みが先に完了し、その後に古い値の書き込みも完了して
  // 上書きする（lost update）おそれあり。書き込みをPromiseチェーンで
  // 直列化し、常に最新値のみが最後に保存されることを検証する。
  it('persists only the latest value when the slider changes rapidly in succession', async () => {
    let resolveFirstGet: (value: { volume: number }) => void = () => {};
    const firstGetPromise = new Promise<{ volume: number }>((resolve) => {
      resolveFirstGet = resolve;
    });
    const getMock = vi
      .fn()
      .mockImplementationOnce(() => firstGetPromise)
      .mockImplementation(() => Promise.resolve({ volume: 999 }));
    const setCalls: number[] = [];
    const setMock = vi.fn().mockImplementation((_key: string, uiSettings: { volume: number }) => {
      setCalls.push(uiSettings.volume);
      return Promise.resolve();
    });
    testWindow.electronAPI = {
      settings: { get: getMock, set: setMock, getRecentFiles: vi.fn() },
    };

    render(<VolumeControl />);
    const slider = screen.getByTestId('volume-slider') as HTMLInputElement;

    // 2つの変更を、最初のget()がまだ解決していない間に連続で発火させる。
    // 直列化されていなければ、後発の書き込みが先に完了してしまい得る。
    fireEvent.change(slider, { target: { value: '10' } });
    fireEvent.change(slider, { target: { value: '20' } });

    resolveFirstGet({ volume: 80 });

    await vi.waitFor(() => expect(setCalls.length).toBeGreaterThan(0));
    // 途中経過が何回あっても、最後に書き込まれる値は必ず最新（20）である。
    expect(setCalls[setCalls.length - 1]).toBe(20);
    expect(usePracticeStore.getState().volume).toBe(20);
  });
});
