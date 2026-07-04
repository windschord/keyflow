import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsModal } from './index';
import { usePracticeStore } from '../../store';

// 本ファイルは window.electronAPI をモックした「UI表示層のみ」の検証である。
// settingsApi.getRecentFiles はモック応答を返すため、Main プロセス側で
// SettingsService.addRecentFile が実際に呼ばれ、electron-store の recentFiles に
// 反映されるという本番経路の結線（REQ-001-006）はここでは検証できない。
// その結線検証は src/main/file-handlers.test.ts
// （createShowOpenDialogHandler が addRecentFile を呼ぶことの検証）が担う。
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
    usePracticeStore.setState({ metronomeEnabled: false, errorMode: 'wait' });
  });

  it('renders recent files returned by the preload API (UI display only, mocked data)', async () => {
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

    const checkbox = (await screen.findByLabelText(
      'Enable Metronome by Default'
    )) as HTMLInputElement;

    // Check initial state
    await waitFor(() => expect(checkbox.checked).toBe(false));

    fireEvent.click(checkbox);

    await waitFor(() =>
      expect(window.alert).toHaveBeenCalledWith('設定の保存に失敗しました。変更を元に戻しました。')
    );
    expect(checkbox.checked).toBe(false);
    // ui-slice の metronomeEnabled も保存失敗時にはロールバックされる
    expect(usePracticeStore.getState().metronomeEnabled).toBe(false);
  });

  it('reflects "Enable Metronome by Default" changes to the ui-slice metronomeEnabled state', async () => {
    settingsApi.get.mockImplementation((key: string) => {
      if (key === 'ui')
        return Promise.resolve({ theme: 'light', language: 'ja', zoom: 1, pianoHeight: 120 });
      if (key === 'practice')
        return Promise.resolve({ defaultErrorMode: 'wait', metronomeEnabled: false });
      return Promise.resolve(undefined);
    });
    settingsApi.getRecentFiles.mockResolvedValue([]);
    settingsApi.set.mockResolvedValue(undefined);

    render(<SettingsModal isOpen onClose={vi.fn()} />);

    const checkbox = (await screen.findByLabelText(
      'Enable Metronome by Default'
    )) as HTMLInputElement;
    await waitFor(() => expect(checkbox.checked).toBe(false));
    expect(usePracticeStore.getState().metronomeEnabled).toBe(false);

    fireEvent.click(checkbox);

    await waitFor(() => expect(usePracticeStore.getState().metronomeEnabled).toBe(true));
    expect(settingsApi.set).toHaveBeenCalledWith(
      'practice',
      expect.objectContaining({ metronomeEnabled: true })
    );
  });

  it('reflects "Default Error Mode" changes to the practice-slice errorMode state immediately (TASK-040)', async () => {
    settingsApi.get.mockImplementation((key: string) => {
      if (key === 'ui')
        return Promise.resolve({ theme: 'light', language: 'ja', zoom: 1, pianoHeight: 120 });
      if (key === 'practice')
        return Promise.resolve({ defaultErrorMode: 'wait', metronomeEnabled: false });
      return Promise.resolve(undefined);
    });
    settingsApi.getRecentFiles.mockResolvedValue([]);
    settingsApi.set.mockResolvedValue(undefined);
    usePracticeStore.setState({ errorMode: 'wait' });

    render(<SettingsModal isOpen onClose={vi.fn()} />);

    const select = (await screen.findByLabelText('Default Error Mode')) as HTMLSelectElement;
    await waitFor(() => expect(select.value).toBe('wait'));
    expect(usePracticeStore.getState().errorMode).toBe('wait');

    fireEvent.change(select, { target: { value: 'pass' } });

    await waitFor(() => expect(usePracticeStore.getState().errorMode).toBe('pass'));
    expect(settingsApi.set).toHaveBeenCalledWith(
      'practice',
      expect.objectContaining({ defaultErrorMode: 'pass' })
    );
  });

  it('rolls back the practice-slice errorMode when saving "Default Error Mode" fails (TASK-040)', async () => {
    settingsApi.get.mockImplementation((key: string) => {
      if (key === 'ui')
        return Promise.resolve({ theme: 'light', language: 'ja', zoom: 1, pianoHeight: 120 });
      if (key === 'practice')
        return Promise.resolve({ defaultErrorMode: 'wait', metronomeEnabled: false });
      return Promise.resolve(undefined);
    });
    settingsApi.getRecentFiles.mockResolvedValue([]);
    settingsApi.set.mockRejectedValue(new Error('save failed'));
    usePracticeStore.setState({ errorMode: 'wait' });

    render(<SettingsModal isOpen onClose={vi.fn()} />);

    const select = (await screen.findByLabelText('Default Error Mode')) as HTMLSelectElement;
    await waitFor(() => expect(select.value).toBe('wait'));

    fireEvent.change(select, { target: { value: 'pass' } });

    await waitFor(() =>
      expect(window.alert).toHaveBeenCalledWith('設定の保存に失敗しました。変更を元に戻しました。')
    );
    expect(select.value).toBe('wait');
    expect(usePracticeStore.getState().errorMode).toBe('wait');
  });
});
