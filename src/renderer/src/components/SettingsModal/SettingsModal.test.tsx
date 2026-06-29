import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsModal } from './index';

describe('SettingsModal', () => {
  const settingsApi = {
    get: vi.fn(),
    set: vi.fn(),
    getRecentFiles: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    window.electronAPI = {
      file: {
        showOpenDialog: vi.fn(),
        read: vi.fn(),
        readBinary: vi.fn(),
        write: vi.fn(),
      },
      settings: settingsApi,
    };
  });

  it('loads settings and recent files through preload API', async () => {
    settingsApi.get.mockImplementation((key: string) => {
      if (key === 'ui')
        return Promise.resolve({ theme: 'light', language: 'ja', zoom: 1, pianoHeight: 120 });
      if (key === 'practice')
        return Promise.resolve({ defaultErrorMode: 'pass', metronomeEnabled: true });
      return Promise.resolve(undefined);
    });
    settingsApi.getRecentFiles.mockResolvedValue([
      { path: '/scores/example.musicxml', openedAt: '2026-06-29T00:00:00.000Z' },
    ]);

    render(<SettingsModal isOpen onClose={vi.fn()} />);

    expect(await screen.findByText('Settings')).toBeInTheDocument();
    await waitFor(() => expect(settingsApi.get).toHaveBeenCalledWith('ui'));
    expect(screen.getByText('example.musicxml')).toBeInTheDocument();
    expect(screen.getByLabelText('Enable Metronome by Default')).toBeChecked();
  });

  it('keeps the modal open with defaults and reports load failures', async () => {
    settingsApi.get.mockRejectedValue(new Error('IPC failed'));
    settingsApi.getRecentFiles.mockResolvedValue([]);

    render(<SettingsModal isOpen onClose={vi.fn()} />);

    expect(await screen.findByText('Settings')).toBeInTheDocument();
    await waitFor(() =>
      expect(window.alert).toHaveBeenCalledWith(
        '設定の読み込みに失敗しました。既定値で表示します。'
      )
    );
    expect(screen.getByText('No recent files')).toBeInTheDocument();
  });

  it('rolls back optimistic updates and reports save failures', async () => {
    settingsApi.get.mockImplementation((key: string) => {
      if (key === 'ui')
        return Promise.resolve({ theme: 'light', language: 'ja', zoom: 1, pianoHeight: 120 });
      if (key === 'practice')
        return Promise.resolve({ defaultErrorMode: 'wait', metronomeEnabled: false });
      return Promise.resolve(undefined);
    });
    settingsApi.getRecentFiles.mockResolvedValue([]);
    settingsApi.set.mockRejectedValue(new Error('save failed'));

    render(<SettingsModal isOpen onClose={vi.fn()} />);

    const checkbox = await screen.findByLabelText('Enable Metronome by Default') as HTMLInputElement;

    // Check initial state
    await waitFor(() => expect(checkbox.checked).toBe(false));

    fireEvent.click(checkbox);

    await waitFor(() =>
      expect(window.alert).toHaveBeenCalledWith('設定の保存に失敗しました。変更を元に戻しました。')
    );
    expect(checkbox.checked).toBe(false);
  });
});
