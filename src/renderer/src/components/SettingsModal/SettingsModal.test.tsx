import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithStrictMode as render } from '../../tests/test-utils';
import { SettingsModal } from './index';
import { usePracticeStore } from '../../store';
import type { WebMidiService } from '../../lib/midi/web-midi';

// 本ファイルは window.electronAPI をモックした「UI表示層のみ」の検証である。
// settingsApi.getRecentFiles はモック応答を返す。
// そのため、Main プロセス側で SettingsService.addRecentFile が実際に呼ばれ、
// electron-store の recentFiles に反映されるという本番経路の結線（REQ-001-006）は
// ここでは検証できない。
// その結線検証は src/main/file-handlers.test.ts
// （createShowOpenDialogHandler が addRecentFile を呼ぶことの検証）が担う。
//
// NOTE (TASK-045, NFR-U-002): 本タスクでSettingsModalの日本語化を行ったため、
// 以下のテストで参照するラベル文字列はすべて日本語表記に更新している。
describe('SettingsModal', () => {
  const settingsApi = {
    get: vi.fn(),
    set: vi.fn(),
    getRecentFiles: vi.fn(),
  };

  const defaultUi = { theme: 'light', language: 'ja', zoom: 1, pianoHeight: 120 };
  const defaultPractice = {
    defaultErrorMode: 'wait',
    metronomeEnabled: false,
    metronomeAccentEnabled: true,
  };
  const defaultMidi = { selectedDeviceId: null, selectedDeviceIndex: 0 };
  const defaultAudio = { playbackVoice: 'grand-piano', metronomeVoice: 'click' };

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
    usePracticeStore.setState({
      metronomeEnabled: false,
      metronomeAccentEnabled: true,
      errorMode: 'wait',
      pianoHeight: 120,
      midiDeviceId: null,
      keyboardSize: 88,
      playbackVoice: 'grand-piano',
      metronomeVoice: 'click',
    });
  });

  it('renders recent files returned by the preload API (UI display only, mocked data)', async () => {
    settingsApi.get.mockImplementation((key: string) => {
      if (key === 'ui')
        return Promise.resolve({ theme: 'light', language: 'ja', zoom: 1, pianoHeight: 120 });
      if (key === 'practice')
        return Promise.resolve({ defaultErrorMode: 'pass', metronomeEnabled: true });
      if (key === 'midi') return Promise.resolve(defaultMidi);
      return Promise.resolve(undefined);
    });
    settingsApi.getRecentFiles.mockResolvedValue([
      { path: '/scores/example.musicxml', openedAt: '2026-06-29T00:00:00.000Z' },
    ]);

    render(<SettingsModal isOpen onClose={vi.fn()} />);

    expect(await screen.findByText('設定')).toBeInTheDocument();
    await waitFor(() => expect(settingsApi.get).toHaveBeenCalledWith('ui'));
    expect(screen.getByText('example.musicxml')).toBeInTheDocument();
    expect(screen.getByLabelText('既定でメトロノームを有効にする')).toBeChecked();
  });

  it('keeps the modal open with defaults and reports load failures', async () => {
    settingsApi.get.mockRejectedValue(new Error('IPC failed'));
    settingsApi.getRecentFiles.mockResolvedValue([]);

    render(<SettingsModal isOpen onClose={vi.fn()} />);

    expect(await screen.findByText('設定')).toBeInTheDocument();
    await waitFor(() =>
      expect(window.alert).toHaveBeenCalledWith(
        '設定の読み込みに失敗しました。既定値で表示します。'
      )
    );
    expect(screen.getByText('最近使ったファイルはありません')).toBeInTheDocument();
  });

  it('rolls back optimistic updates and reports save failures', async () => {
    settingsApi.get.mockImplementation((key: string) => {
      if (key === 'ui') return Promise.resolve(defaultUi);
      if (key === 'practice') return Promise.resolve(defaultPractice);
      if (key === 'midi') return Promise.resolve(defaultMidi);
      return Promise.resolve(undefined);
    });
    settingsApi.getRecentFiles.mockResolvedValue([]);
    settingsApi.set.mockRejectedValue(new Error('save failed'));

    render(<SettingsModal isOpen onClose={vi.fn()} />);

    const checkbox = (await screen.findByLabelText(
      '既定でメトロノームを有効にする'
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

  it('reflects "既定でメトロノームを有効にする" changes to the ui-slice metronomeEnabled state', async () => {
    settingsApi.get.mockImplementation((key: string) => {
      if (key === 'ui') return Promise.resolve(defaultUi);
      if (key === 'practice') return Promise.resolve(defaultPractice);
      if (key === 'midi') return Promise.resolve(defaultMidi);
      return Promise.resolve(undefined);
    });
    settingsApi.getRecentFiles.mockResolvedValue([]);
    settingsApi.set.mockResolvedValue(undefined);

    render(<SettingsModal isOpen onClose={vi.fn()} />);

    const checkbox = (await screen.findByLabelText(
      '既定でメトロノームを有効にする'
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

  // TASK-063: メトロノーム一拍目アクセントの既定値設定UI（REQ-006-008）。
  it('reflects "既定で1拍目を強調する" changes to the ui-slice metronomeAccentEnabled state and persists it', async () => {
    settingsApi.get.mockImplementation((key: string) => {
      if (key === 'ui') return Promise.resolve(defaultUi);
      if (key === 'practice') return Promise.resolve(defaultPractice);
      if (key === 'midi') return Promise.resolve(defaultMidi);
      return Promise.resolve(undefined);
    });
    settingsApi.getRecentFiles.mockResolvedValue([]);
    settingsApi.set.mockResolvedValue(undefined);

    render(<SettingsModal isOpen onClose={vi.fn()} />);

    const checkbox = (await screen.findByLabelText('既定で1拍目を強調する')) as HTMLInputElement;
    await waitFor(() => expect(checkbox.checked).toBe(true));
    expect(usePracticeStore.getState().metronomeAccentEnabled).toBe(true);

    fireEvent.click(checkbox);

    await waitFor(() => expect(usePracticeStore.getState().metronomeAccentEnabled).toBe(false));
    expect(settingsApi.set).toHaveBeenCalledWith(
      'practice',
      expect.objectContaining({ metronomeAccentEnabled: false })
    );
  });

  // PR #27 CodeRabbit指摘: electron-storeはネストオブジェクトを深くマージしないため、
  // metronomeAccentEnabledキー導入前に保存された既存ユーザーのpracticeオブジェクトには
  // このキーが存在しない。従来の`practice || DEFAULT_SETTINGS.practice`という全置換
  // フォールバックは、practiceオブジェクト自体は存在するため働かず、
  // settings.practiceにmetronomeAccentEnabledキーが欠けたまま保持されてしまう。
  // 別項目（既定のエラーモード）を変更して保存すると、その欠けたキーを引き継いだ
  // オブジェクトがそのままelectron-storeへ書き戻され、既定値trueが失われる。
  // チェックボックスのchecked属性を直接見るテストは、Reactが制御コンポーネントから
  // 非制御（checked={undefined}）へ切り替わる際にDOMのchecked値を保持してしまう
  // 挙動があり、バグの有無に関わらず一見trueと表示されうるため採用しない。
  it('preserves metronomeAccentEnabled default (true) in a subsequent practice save when the persisted practice object predates that key', async () => {
    settingsApi.get.mockImplementation((key: string) => {
      if (key === 'ui') return Promise.resolve(defaultUi);
      // metronomeAccentEnabledキーを含まない旧形式のpracticeオブジェクトを模す。
      if (key === 'practice')
        return Promise.resolve({ defaultErrorMode: 'wait', metronomeEnabled: false });
      if (key === 'midi') return Promise.resolve(defaultMidi);
      return Promise.resolve(undefined);
    });
    settingsApi.getRecentFiles.mockResolvedValue([]);
    settingsApi.set.mockResolvedValue(undefined);

    render(<SettingsModal isOpen onClose={vi.fn()} />);

    const select = await screen.findByLabelText('既定のエラーモード');
    fireEvent.change(select, { target: { value: 'pass' } });

    await waitFor(() =>
      expect(settingsApi.set).toHaveBeenCalledWith(
        'practice',
        expect.objectContaining({ metronomeAccentEnabled: true })
      )
    );
  });

  it('reflects "既定のエラーモード" changes to the practice-slice errorMode state immediately (TASK-040)', async () => {
    settingsApi.get.mockImplementation((key: string) => {
      if (key === 'ui') return Promise.resolve(defaultUi);
      if (key === 'practice') return Promise.resolve(defaultPractice);
      if (key === 'midi') return Promise.resolve(defaultMidi);
      return Promise.resolve(undefined);
    });
    settingsApi.getRecentFiles.mockResolvedValue([]);
    settingsApi.set.mockResolvedValue(undefined);
    usePracticeStore.setState({ errorMode: 'wait' });

    render(<SettingsModal isOpen onClose={vi.fn()} />);

    const select = (await screen.findByLabelText('既定のエラーモード')) as HTMLSelectElement;
    await waitFor(() => expect(select.value).toBe('wait'));
    expect(usePracticeStore.getState().errorMode).toBe('wait');

    fireEvent.change(select, { target: { value: 'pass' } });

    await waitFor(() => expect(usePracticeStore.getState().errorMode).toBe('pass'));
    expect(settingsApi.set).toHaveBeenCalledWith(
      'practice',
      expect.objectContaining({ defaultErrorMode: 'pass' })
    );
  });

  it('rolls back the practice-slice errorMode when saving "既定のエラーモード" fails (TASK-040)', async () => {
    settingsApi.get.mockImplementation((key: string) => {
      if (key === 'ui') return Promise.resolve(defaultUi);
      if (key === 'practice') return Promise.resolve(defaultPractice);
      if (key === 'midi') return Promise.resolve(defaultMidi);
      return Promise.resolve(undefined);
    });
    settingsApi.getRecentFiles.mockResolvedValue([]);
    settingsApi.set.mockRejectedValue(new Error('save failed'));
    usePracticeStore.setState({ errorMode: 'wait' });

    render(<SettingsModal isOpen onClose={vi.fn()} />);

    const select = (await screen.findByLabelText('既定のエラーモード')) as HTMLSelectElement;
    await waitFor(() => expect(select.value).toBe('wait'));

    fireEvent.change(select, { target: { value: 'pass' } });

    await waitFor(() =>
      expect(window.alert).toHaveBeenCalledWith('設定の保存に失敗しました。変更を元に戻しました。')
    );
    expect(select.value).toBe('wait');
    expect(usePracticeStore.getState().errorMode).toBe('wait');
  });

  // TASK-045: MIDIデバイス選択（REQ-004-008）
  describe('MIDI device selection (TASK-045, REQ-004-008)', () => {
    const makeWebMidiServiceMock = (devices: Array<{ id: string; name: string }>): WebMidiService =>
      ({
        getDevices: vi.fn().mockReturnValue(devices),
      }) as unknown as WebMidiService;

    it('lists the connected MIDI input devices returned by webMidiService.getDevices, plus an "all devices" option', async () => {
      settingsApi.get.mockImplementation((key: string) => {
        if (key === 'ui') return Promise.resolve(defaultUi);
        if (key === 'practice') return Promise.resolve(defaultPractice);
        if (key === 'midi') return Promise.resolve(defaultMidi);
        return Promise.resolve(undefined);
      });
      settingsApi.getRecentFiles.mockResolvedValue([]);

      const webMidiService = makeWebMidiServiceMock([
        { id: 'device-1', name: 'Keyboard A' },
        { id: 'device-2', name: 'Keyboard B' },
      ]);

      render(<SettingsModal isOpen onClose={vi.fn()} webMidiService={webMidiService} />);

      const select = (await screen.findByLabelText('MIDI入力デバイス')) as HTMLSelectElement;
      expect(screen.getByText('すべてのデバイス')).toBeInTheDocument();
      expect(screen.getByText('Keyboard A')).toBeInTheDocument();
      expect(screen.getByText('Keyboard B')).toBeInTheDocument();
      expect(select.value).toBe('');
    });

    it('renders only the "all devices" option when no webMidiService is provided (no crash)', async () => {
      settingsApi.get.mockImplementation((key: string) => {
        if (key === 'ui') return Promise.resolve(defaultUi);
        if (key === 'practice') return Promise.resolve(defaultPractice);
        if (key === 'midi') return Promise.resolve(defaultMidi);
        return Promise.resolve(undefined);
      });
      settingsApi.getRecentFiles.mockResolvedValue([]);

      render(<SettingsModal isOpen onClose={vi.fn()} />);

      const select = (await screen.findByLabelText('MIDI入力デバイス')) as HTMLSelectElement;
      expect(select.options).toHaveLength(1);
      expect(select.options[0].textContent).toBe('すべてのデバイス');
    });

    it('selecting a device saves midi.selectedDeviceId and reflects it to the ui-slice midiDeviceId immediately', async () => {
      settingsApi.get.mockImplementation((key: string) => {
        if (key === 'ui') return Promise.resolve(defaultUi);
        if (key === 'practice') return Promise.resolve(defaultPractice);
        if (key === 'midi') return Promise.resolve(defaultMidi);
        return Promise.resolve(undefined);
      });
      settingsApi.getRecentFiles.mockResolvedValue([]);
      settingsApi.set.mockResolvedValue(undefined);

      const webMidiService = makeWebMidiServiceMock([{ id: 'device-1', name: 'Keyboard A' }]);

      render(<SettingsModal isOpen onClose={vi.fn()} webMidiService={webMidiService} />);

      const select = (await screen.findByLabelText('MIDI入力デバイス')) as HTMLSelectElement;
      await waitFor(() => expect(select.value).toBe(''));

      fireEvent.change(select, { target: { value: 'device-1' } });

      await waitFor(() => expect(usePracticeStore.getState().midiDeviceId).toBe('device-1'));
      expect(settingsApi.set).toHaveBeenCalledWith(
        'midi',
        expect.objectContaining({ selectedDeviceId: 'device-1' })
      );
    });

    it('rolls back the ui-slice midiDeviceId when saving the device selection fails', async () => {
      settingsApi.get.mockImplementation((key: string) => {
        if (key === 'ui') return Promise.resolve(defaultUi);
        if (key === 'practice') return Promise.resolve(defaultPractice);
        if (key === 'midi') return Promise.resolve(defaultMidi);
        return Promise.resolve(undefined);
      });
      settingsApi.getRecentFiles.mockResolvedValue([]);
      settingsApi.set.mockRejectedValue(new Error('save failed'));

      const webMidiService = makeWebMidiServiceMock([{ id: 'device-1', name: 'Keyboard A' }]);

      render(<SettingsModal isOpen onClose={vi.fn()} webMidiService={webMidiService} />);

      const select = (await screen.findByLabelText('MIDI入力デバイス')) as HTMLSelectElement;
      await waitFor(() => expect(select.value).toBe(''));

      fireEvent.change(select, { target: { value: 'device-1' } });

      await waitFor(() =>
        expect(window.alert).toHaveBeenCalledWith(
          '設定の保存に失敗しました。変更を元に戻しました。'
        )
      );
      expect(select.value).toBe('');
      expect(usePracticeStore.getState().midiDeviceId).toBeNull();
    });

    it('selecting "すべてのデバイス" saves null as the selectedDeviceId', async () => {
      settingsApi.get.mockImplementation((key: string) => {
        if (key === 'ui') return Promise.resolve(defaultUi);
        if (key === 'practice') return Promise.resolve(defaultPractice);
        if (key === 'midi')
          return Promise.resolve({ selectedDeviceId: 'device-1', selectedDeviceIndex: 0 });
        return Promise.resolve(undefined);
      });
      settingsApi.getRecentFiles.mockResolvedValue([]);
      settingsApi.set.mockResolvedValue(undefined);
      usePracticeStore.setState({ midiDeviceId: 'device-1' });

      const webMidiService = makeWebMidiServiceMock([{ id: 'device-1', name: 'Keyboard A' }]);

      render(<SettingsModal isOpen onClose={vi.fn()} webMidiService={webMidiService} />);

      const select = (await screen.findByLabelText('MIDI入力デバイス')) as HTMLSelectElement;
      await waitFor(() => expect(select.value).toBe('device-1'));

      fireEvent.change(select, { target: { value: '' } });

      await waitFor(() => expect(usePracticeStore.getState().midiDeviceId).toBeNull());
      expect(settingsApi.set).toHaveBeenCalledWith(
        'midi',
        expect.objectContaining({ selectedDeviceId: null })
      );
    });
  });

  // TASK-045: 鍵盤の高さ設定UI
  describe('Piano height setting (TASK-045)', () => {
    it('shows the persisted pianoHeight value on the slider', async () => {
      settingsApi.get.mockImplementation((key: string) => {
        if (key === 'ui') return Promise.resolve({ ...defaultUi, pianoHeight: 180 });
        if (key === 'practice') return Promise.resolve(defaultPractice);
        if (key === 'midi') return Promise.resolve(defaultMidi);
        return Promise.resolve(undefined);
      });
      settingsApi.getRecentFiles.mockResolvedValue([]);

      render(<SettingsModal isOpen onClose={vi.fn()} />);

      const slider = (await screen.findByLabelText('鍵盤の高さ')) as HTMLInputElement;
      await waitFor(() => expect(slider.value).toBe('180'));
    });

    it('reflects slider changes to the ui-slice pianoHeight state immediately and persists via electron-store', async () => {
      settingsApi.get.mockImplementation((key: string) => {
        if (key === 'ui') return Promise.resolve(defaultUi);
        if (key === 'practice') return Promise.resolve(defaultPractice);
        if (key === 'midi') return Promise.resolve(defaultMidi);
        return Promise.resolve(undefined);
      });
      settingsApi.getRecentFiles.mockResolvedValue([]);
      settingsApi.set.mockResolvedValue(undefined);

      render(<SettingsModal isOpen onClose={vi.fn()} />);

      const slider = (await screen.findByLabelText('鍵盤の高さ')) as HTMLInputElement;
      await waitFor(() => expect(slider.value).toBe('120'));

      fireEvent.change(slider, { target: { value: '220' } });

      await waitFor(() => expect(usePracticeStore.getState().pianoHeight).toBe(220));
      expect(settingsApi.set).toHaveBeenCalledWith(
        'ui',
        expect.objectContaining({ pianoHeight: 220 })
      );
    });

    it('rolls back the ui-slice pianoHeight when saving fails', async () => {
      settingsApi.get.mockImplementation((key: string) => {
        if (key === 'ui') return Promise.resolve(defaultUi);
        if (key === 'practice') return Promise.resolve(defaultPractice);
        if (key === 'midi') return Promise.resolve(defaultMidi);
        return Promise.resolve(undefined);
      });
      settingsApi.getRecentFiles.mockResolvedValue([]);
      settingsApi.set.mockRejectedValue(new Error('save failed'));

      render(<SettingsModal isOpen onClose={vi.fn()} />);

      const slider = (await screen.findByLabelText('鍵盤の高さ')) as HTMLInputElement;
      await waitFor(() => expect(slider.value).toBe('120'));

      fireEvent.change(slider, { target: { value: '220' } });

      await waitFor(() =>
        expect(window.alert).toHaveBeenCalledWith(
          '設定の保存に失敗しました。変更を元に戻しました。'
        )
      );
      expect(slider.value).toBe('120');
      expect(usePracticeStore.getState().pianoHeight).toBe(120);
    });

    it('clamps the slider range to 80-300px', async () => {
      settingsApi.get.mockImplementation((key: string) => {
        if (key === 'ui') return Promise.resolve(defaultUi);
        if (key === 'practice') return Promise.resolve(defaultPractice);
        if (key === 'midi') return Promise.resolve(defaultMidi);
        return Promise.resolve(undefined);
      });
      settingsApi.getRecentFiles.mockResolvedValue([]);

      render(<SettingsModal isOpen onClose={vi.fn()} />);

      const slider = (await screen.findByLabelText('鍵盤の高さ')) as HTMLInputElement;
      expect(slider.min).toBe('80');
      expect(slider.max).toBe('300');
    });
  });

  // TASK-056: 画面下キーボードの鍵盤数プリセット（88/76/61/49鍵）。
  describe('Keyboard size setting (TASK-056)', () => {
    it('shows a Japanese "鍵盤数" label with a select for the presets', async () => {
      settingsApi.get.mockImplementation((key: string) => {
        if (key === 'ui') return Promise.resolve({ ...defaultUi, keyboardSize: 88 });
        if (key === 'practice') return Promise.resolve(defaultPractice);
        if (key === 'midi') return Promise.resolve(defaultMidi);
        return Promise.resolve(undefined);
      });
      settingsApi.getRecentFiles.mockResolvedValue([]);

      render(<SettingsModal isOpen onClose={vi.fn()} />);

      const select = (await screen.findByLabelText('鍵盤数')) as HTMLSelectElement;
      expect(select).toBeInTheDocument();
    });

    it('shows the persisted keyboardSize value on the select', async () => {
      settingsApi.get.mockImplementation((key: string) => {
        if (key === 'ui') return Promise.resolve({ ...defaultUi, keyboardSize: 61 });
        if (key === 'practice') return Promise.resolve(defaultPractice);
        if (key === 'midi') return Promise.resolve(defaultMidi);
        return Promise.resolve(undefined);
      });
      settingsApi.getRecentFiles.mockResolvedValue([]);

      render(<SettingsModal isOpen onClose={vi.fn()} />);

      const select = (await screen.findByLabelText('鍵盤数')) as HTMLSelectElement;
      await waitFor(() => expect(select.value).toBe('61'));
    });

    it('reflects selection changes to the ui-slice keyboardSize state immediately and persists via electron-store', async () => {
      settingsApi.get.mockImplementation((key: string) => {
        if (key === 'ui') return Promise.resolve({ ...defaultUi, keyboardSize: 88 });
        if (key === 'practice') return Promise.resolve(defaultPractice);
        if (key === 'midi') return Promise.resolve(defaultMidi);
        return Promise.resolve(undefined);
      });
      settingsApi.getRecentFiles.mockResolvedValue([]);
      settingsApi.set.mockResolvedValue(undefined);

      render(<SettingsModal isOpen onClose={vi.fn()} />);

      const select = (await screen.findByLabelText('鍵盤数')) as HTMLSelectElement;
      await waitFor(() => expect(select.value).toBe('88'));

      fireEvent.change(select, { target: { value: '61' } });

      await waitFor(() => expect(usePracticeStore.getState().keyboardSize).toBe(61));
      expect(settingsApi.set).toHaveBeenCalledWith(
        'ui',
        expect.objectContaining({ keyboardSize: 61 })
      );
    });

    it('rolls back the ui-slice keyboardSize when saving fails', async () => {
      settingsApi.get.mockImplementation((key: string) => {
        if (key === 'ui') return Promise.resolve({ ...defaultUi, keyboardSize: 88 });
        if (key === 'practice') return Promise.resolve(defaultPractice);
        if (key === 'midi') return Promise.resolve(defaultMidi);
        return Promise.resolve(undefined);
      });
      settingsApi.getRecentFiles.mockResolvedValue([]);
      settingsApi.set.mockRejectedValue(new Error('save failed'));

      render(<SettingsModal isOpen onClose={vi.fn()} />);

      const select = (await screen.findByLabelText('鍵盤数')) as HTMLSelectElement;
      await waitFor(() => expect(select.value).toBe('88'));

      fireEvent.change(select, { target: { value: '49' } });

      await waitFor(() =>
        expect(window.alert).toHaveBeenCalledWith(
          '設定の保存に失敗しました。変更を元に戻しました。'
        )
      );
      expect(select.value).toBe('88');
      expect(usePracticeStore.getState().keyboardSize).toBe(88);
    });
  });

  // TASK-073: 音色設定（再生音色・メトロノーム音色、US-013）。
  describe('Voice settings (TASK-073, REQ-013-003/-006)', () => {
    const mockGetWithAudio = (audio: { playbackVoice: string; metronomeVoice: string }) =>
      vi.fn().mockImplementation((key: string) => {
        if (key === 'ui') return Promise.resolve(defaultUi);
        if (key === 'practice') return Promise.resolve(defaultPractice);
        if (key === 'midi') return Promise.resolve(defaultMidi);
        if (key === 'audio') return Promise.resolve(audio);
        return Promise.resolve(undefined);
      });

    it('shows a Japanese "音色" section with selects for the persisted playbackVoice/metronomeVoice', async () => {
      settingsApi.get.mockImplementation(
        mockGetWithAudio({ playbackVoice: 'organ', metronomeVoice: 'cowbell' })
      );
      settingsApi.getRecentFiles.mockResolvedValue([]);

      render(<SettingsModal isOpen onClose={vi.fn()} />);

      expect(await screen.findByText('音色')).toBeInTheDocument();
      const playbackSelect = (await screen.findByLabelText('再生音色')) as HTMLSelectElement;
      const metronomeSelect = (await screen.findByLabelText(
        'メトロノーム音色'
      )) as HTMLSelectElement;

      await waitFor(() => expect(playbackSelect.value).toBe('organ'));
      expect(metronomeSelect.value).toBe('cowbell');
    });

    it('falls back to the defaults (grand-piano/click) when the persisted audio settings are absent', async () => {
      settingsApi.get.mockImplementation((key: string) => {
        if (key === 'ui') return Promise.resolve(defaultUi);
        if (key === 'practice') return Promise.resolve(defaultPractice);
        if (key === 'midi') return Promise.resolve(defaultMidi);
        return Promise.resolve(undefined);
      });
      settingsApi.getRecentFiles.mockResolvedValue([]);

      render(<SettingsModal isOpen onClose={vi.fn()} />);

      const playbackSelect = (await screen.findByLabelText('再生音色')) as HTMLSelectElement;
      await waitFor(() => expect(playbackSelect.value).toBe('grand-piano'));
      expect(screen.getByLabelText('メトロノーム音色')).toHaveValue('click');
    });

    it('changing the playback voice select updates the ui-slice playbackVoice and persists via settings:set (結線テスト)', async () => {
      settingsApi.get.mockImplementation(mockGetWithAudio(defaultAudio));
      settingsApi.getRecentFiles.mockResolvedValue([]);
      settingsApi.set.mockResolvedValue(undefined);

      render(<SettingsModal isOpen onClose={vi.fn()} />);

      const select = (await screen.findByLabelText('再生音色')) as HTMLSelectElement;
      await waitFor(() => expect(select.value).toBe('grand-piano'));

      fireEvent.change(select, { target: { value: 'organ' } });

      await waitFor(() => expect(usePracticeStore.getState().playbackVoice).toBe('organ'));
      expect(settingsApi.set).toHaveBeenCalledWith(
        'audio',
        expect.objectContaining({ playbackVoice: 'organ' })
      );
    });

    it('changing the metronome voice select updates the ui-slice metronomeVoice and persists via settings:set (結線テスト)', async () => {
      settingsApi.get.mockImplementation(mockGetWithAudio(defaultAudio));
      settingsApi.getRecentFiles.mockResolvedValue([]);
      settingsApi.set.mockResolvedValue(undefined);

      render(<SettingsModal isOpen onClose={vi.fn()} />);

      const select = (await screen.findByLabelText('メトロノーム音色')) as HTMLSelectElement;
      await waitFor(() => expect(select.value).toBe('click'));

      fireEvent.change(select, { target: { value: 'beep' } });

      await waitFor(() => expect(usePracticeStore.getState().metronomeVoice).toBe('beep'));
      expect(settingsApi.set).toHaveBeenCalledWith(
        'audio',
        expect.objectContaining({ metronomeVoice: 'beep' })
      );
    });

    it('rolls back the ui-slice playbackVoice when saving fails', async () => {
      settingsApi.get.mockImplementation(mockGetWithAudio(defaultAudio));
      settingsApi.getRecentFiles.mockResolvedValue([]);
      settingsApi.set.mockRejectedValue(new Error('save failed'));

      render(<SettingsModal isOpen onClose={vi.fn()} />);

      const select = (await screen.findByLabelText('再生音色')) as HTMLSelectElement;
      await waitFor(() => expect(select.value).toBe('grand-piano'));

      fireEvent.change(select, { target: { value: 'synth' } });

      await waitFor(() =>
        expect(window.alert).toHaveBeenCalledWith(
          '設定の保存に失敗しました。変更を元に戻しました。'
        )
      );
      expect(select.value).toBe('grand-piano');
      expect(usePracticeStore.getState().playbackVoice).toBe('grand-piano');
    });
  });

  // TASK-076: 「このアプリについて」セクション（US-015）。AboutPanel自体の表示内容
  // （バージョン・ライブラリ一覧のアコーディオン等）はAboutPanel.test.tsxが担う。
  // ここではSettingsModal側にAboutPanelが実際に結線されていることのみ検証する。
  it('renders the "このアプリについて" section with AboutPanel content (結線テスト, REQ-015-001)', async () => {
    settingsApi.get.mockImplementation((key: string) => {
      if (key === 'ui') return Promise.resolve(defaultUi);
      if (key === 'practice') return Promise.resolve(defaultPractice);
      if (key === 'midi') return Promise.resolve(defaultMidi);
      if (key === 'audio') return Promise.resolve(defaultAudio);
      return Promise.resolve(undefined);
    });
    settingsApi.getRecentFiles.mockResolvedValue([]);

    render(<SettingsModal isOpen onClose={vi.fn()} />);

    expect(await screen.findByText('このアプリについて')).toBeInTheDocument();
    expect(screen.getByText('MusicXML Piano Practice')).toBeInTheDocument();
    expect(screen.getByText(/Apache License 2\.0/)).toBeInTheDocument();
  });
});
