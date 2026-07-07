import { screen, waitFor, act, fireEvent, createEvent } from '@testing-library/react';
import { renderWithStrictMode as render } from './tests/test-utils';
import App from './App';
import { vi } from 'vitest';
import { AudioEngineService } from './lib/audio-engine';
import { WebMidiService } from './lib/midi/web-midi';
import { usePracticeStore } from './store';

// Mock Tone.js globally to avoid AudioContext errors during testing
vi.mock('tone', () => {
  let scheduleIdSeq = 0;
  const mockTransport = {
    bpm: { value: 120 },
    PPQ: 480,
    loop: false,
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    schedule: vi.fn(() => scheduleIdSeq++),
    clear: vi.fn(),
    setLoopPoints: vi.fn(),
  };
  const mockDraw = { schedule: vi.fn((cb: () => void) => cb()) };
  const mockDestination = { volume: { value: 0 }, mute: false };

  return {
    getTransport: vi.fn(() => mockTransport),
    getDraw: vi.fn(() => mockDraw),
    getDestination: vi.fn(() => mockDestination),
    Synth: vi.fn().mockImplementation(() => ({
      toDestination: vi.fn().mockReturnThis(),
      triggerAttackRelease: vi.fn(),
      dispose: vi.fn(),
    })),
    PolySynth: vi.fn().mockImplementation(() => ({
      toDestination: vi.fn().mockReturnThis(),
      triggerAttackRelease: vi.fn(),
      dispose: vi.fn(),
    })),
    // TASK-071: 既定の再生音色（grand-piano）がTone.Samplerを生成するため、
    // AudioEngineServiceの初期化そのものを検証しない本ファイルの他のテストが
    // 壊れないよう、onload/onerrorを受け取れる最小限のモックを用意する。
    Sampler: vi.fn().mockImplementation((options: { onload?: () => void; onerror?: (error: Error) => void }) => ({
      toDestination: vi.fn().mockReturnThis(),
      triggerAttackRelease: vi.fn(),
      dispose: vi.fn(),
      onload: options?.onload,
      onerror: options?.onerror,
    })),
    FMSynth: vi.fn(),
    Sequence: vi.fn().mockImplementation(() => ({
      start: vi.fn(),
      stop: vi.fn(),
      dispose: vi.fn(),
    })),
    // TASK-066: メトロノーム単独再生（独立クロック）用モック。
    Clock: vi.fn().mockImplementation((callback: (time: number) => void, frequency: number) => ({
      callback,
      frequency: { value: frequency },
      start: vi.fn(),
      stop: vi.fn(),
      dispose: vi.fn(),
    })),
    Part: vi.fn().mockImplementation(() => ({
      start: vi.fn().mockReturnThis(),
      dispose: vi.fn(),
    })),
    Frequency: vi.fn((midiNumber) => ({
      toNote: () => {
        if (midiNumber === 60) return 'C4';
        return 'A4'; // default
      },
    })),
  };
});

// TASK-044: 実装したコンテキストメニュー結線を検証するため、モック化した
// ScoreRenderer/PianoKeyboard/FingeringPanelのpropsを直近レンダー分だけ捕捉する。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let latestScoreRendererProps: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let latestPianoKeyboardProps: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let latestFingeringPanelProps: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let latestToolbarProps: any = null;

vi.mock('./components/ScoreRenderer', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ScoreRenderer: (props: any) => {
    latestScoreRendererProps = props;
    return (
      <div data-testid="mock-score-renderer" data-looprange={JSON.stringify(props.loopRange)}>
        ScoreRenderer
      </div>
    );
  },
}));

vi.mock('./components/PianoKeyboard', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PianoKeyboard: (props: any) => {
    latestPianoKeyboardProps = props;
    return <div data-testid="mock-piano-keyboard">PianoKeyboard</div>;
  },
}));

vi.mock('./components/Toolbar', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Toolbar: (props: any) => {
    latestToolbarProps = props;
    return <div data-testid="mock-toolbar">Toolbar</div>;
  },
}));

vi.mock('./components/FingeringPanel', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  FingeringPanel: (props: any) => {
    latestFingeringPanelProps = props;
    return <div data-testid="mock-fingering-panel">FingeringPanel</div>;
  },
}));

describe('App', () => {
  afterEach(() => {
    usePracticeStore.setState({
      bpm: 120,
      originalBpm: 120,
      metronomeEnabled: false,
      metronomeAccentEnabled: true,
      errorMode: 'wait',
      loopEnabled: false,
      loopStart: 1,
      loopEnd: 2,
      zoom: 1.0,
      pianoHeight: 120,
      midiDeviceId: null,
      keyboardSize: 88,
      // TASK-051: usePractice の score/practiceMode 監視エフェクト（audioEngine.loadScore
      // の再スケジュール）を追加したことで、score がテスト間に残留していると次のテストの
      // マウント時に意図しない loadScore 呼び出しが発生してしまう。他のテストが
      // handleOpenFile経由でscoreをセットすることがあるため、ここで明示的にリセットする。
      score: null,
      musicXmlPath: null,
      musicXmlContent: null,
      practiceMode: 'both',
      playbackState: 'stopped',
      currentMeasure: 1,
      currentNoteIndex: 0,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).electronAPI;
    latestScoreRendererProps = null;
    latestPianoKeyboardProps = null;
    latestFingeringPanelProps = null;
    latestToolbarProps = null;
  });

  it('renders correctly with layout components', () => {
    render(<App />);

    expect(screen.getByTestId('mock-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('mock-score-renderer')).toBeInTheDocument();
    expect(screen.getByTestId('mock-piano-keyboard')).toBeInTheDocument();
  });

  it('renders Open File button', () => {
    render(<App />);
    expect(screen.getByText('ファイルを開く')).toBeInTheDocument();
  });

  it('triggers electronAPI file methods when Open File button is clicked', async () => {
    const showOpenDialogMock = vi.fn().mockResolvedValue('test.xml');
    const SIMPLE_XML = `<?xml version="1.0"?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>Piano Right</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration></note>
    </measure>
  </part>
</score-partwise>`;
    const readMock = vi.fn().mockResolvedValue(SIMPLE_XML);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).electronAPI = {
      file: {
        showOpenDialog: showOpenDialogMock,
        read: readMock,
      },
    };

    render(<App />);
    const openFileBtn = screen.getByText('ファイルを開く');
    openFileBtn.click();

    await waitFor(() => {
      expect(showOpenDialogMock).toHaveBeenCalled();
    });
    expect(readMock).toHaveBeenCalledWith('test.xml');
  });

  it('triggers electronAPI file methods correctly when opening an .mxl file', async () => {
    const showOpenDialogMock = vi.fn().mockResolvedValue('test.mxl');

    const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container>
  <rootfiles>
    <rootfile full-path="score.xml" media-type="application/vnd.recordare.musicxml+xml"/>
  </rootfiles>
</container>`;
    const SIMPLE_XML = `<?xml version="1.0"?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>Piano Right</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration></note>
    </measure>
  </part>
</score-partwise>`;

    const { zipSync } = await import('fflate');

    const zipped = zipSync({
      'META-INF/container.xml': new TextEncoder().encode(containerXml),
      'score.xml': new TextEncoder().encode(SIMPLE_XML),
    });

    const readBinaryMock = vi.fn().mockResolvedValue(zipped.buffer);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).electronAPI = {
      file: {
        showOpenDialog: showOpenDialogMock,
        readBinary: readBinaryMock,
      },
    };

    render(<App />);
    const openFileBtn = screen.getByText('ファイルを開く');
    openFileBtn.click();

    await waitFor(() => {
      expect(showOpenDialogMock).toHaveBeenCalled();
    });
    expect(readBinaryMock).toHaveBeenCalledWith('test.mxl');
  });

  it('handles user canceling Open File dialog', async () => {
    const showOpenDialogMock = vi.fn().mockResolvedValue(null);
    const readMock = vi.fn();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).electronAPI = {
      file: {
        showOpenDialog: showOpenDialogMock,
        read: readMock,
      },
    };

    render(<App />);
    const openFileBtn = screen.getByText('ファイルを開く');
    openFileBtn.click();

    await waitFor(() => {
      expect(showOpenDialogMock).toHaveBeenCalled();
    });
    expect(readMock).not.toHaveBeenCalled();
  });

  it('handles parsing errors by alerting the user', async () => {
    const showOpenDialogMock = vi.fn().mockResolvedValue('test.xml');
    const readMock = vi.fn().mockResolvedValue('<xml/>'); // invalid xml

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).electronAPI = {
      file: {
        showOpenDialog: showOpenDialogMock,
        read: readMock,
      },
    };

    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<App />);
    const openFileBtn = screen.getByText('ファイルを開く');
    openFileBtn.click();

    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith(
        'MusicXML ファイルの解析に失敗しました。ファイル形式を確認してください。'
      );
    });

    alertMock.mockRestore();
    consoleErrorMock.mockRestore();
  });

  it('calls audioEngine.loadScore() when a score is opened', async () => {
    const loadScoreSpy = vi
      .spyOn(AudioEngineService.prototype, 'loadScore')
      .mockImplementation(() => {});

    const showOpenDialogMock = vi.fn().mockResolvedValue('test.xml');
    const SIMPLE_XML = `<?xml version="1.0"?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>Piano Right</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration></note>
    </measure>
  </part>
</score-partwise>`;
    const readMock = vi.fn().mockResolvedValue(SIMPLE_XML);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).electronAPI = {
      file: {
        showOpenDialog: showOpenDialogMock,
        read: readMock,
      },
    };

    render(<App />);
    const openFileBtn = screen.getByText('ファイルを開く');
    openFileBtn.click();

    await waitFor(() => {
      expect(loadScoreSpy).toHaveBeenCalledTimes(1);
    });
    expect(loadScoreSpy.mock.calls[0][0]).toMatchObject({ tempo: expect.any(Number) });

    loadScoreSpy.mockRestore();
  });

  it('handles errors when invoking electronAPI functions', async () => {
    const showOpenDialogMock = vi.fn().mockRejectedValue(new Error('IPC Error'));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).electronAPI = {
      file: {
        showOpenDialog: showOpenDialogMock,
      },
    };

    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<App />);
    const openFileBtn = screen.getByText('ファイルを開く');
    openFileBtn.click();

    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('ファイル選択ダイアログを開けませんでした。');
    });

    alertMock.mockRestore();
    consoleErrorMock.mockRestore();
  });

  it('syncs store bpm changes to audioEngine.setBpm', async () => {
    const setBpmSpy = vi.spyOn(AudioEngineService.prototype, 'setBpm');

    render(<App />);

    await waitFor(() => expect(setBpmSpy).toHaveBeenCalledWith(120));

    act(() => {
      usePracticeStore.getState().setBpm(150);
    });

    await waitFor(() => expect(setBpmSpy).toHaveBeenCalledWith(150));

    setBpmSpy.mockRestore();
  });

  it('syncs store metronomeEnabled changes to audioEngine.setMetronomeEnabled', async () => {
    const setMetronomeEnabledSpy = vi.spyOn(AudioEngineService.prototype, 'setMetronomeEnabled');

    render(<App />);

    await waitFor(() => expect(setMetronomeEnabledSpy).toHaveBeenCalledWith(false));

    act(() => {
      usePracticeStore.getState().setMetronomeEnabled(true);
    });

    await waitFor(() => expect(setMetronomeEnabledSpy).toHaveBeenCalledWith(true));

    setMetronomeEnabledSpy.mockRestore();
  });

  it('plays correct/incorrect feedback sounds based on the MIDI note judgement result', async () => {
    const onNoteOnSpy = vi.spyOn(WebMidiService.prototype, 'onNoteOn');
    const playCorrectSpy = vi
      .spyOn(AudioEngineService.prototype, 'playCorrectSound')
      .mockImplementation(() => {});
    const playIncorrectSpy = vi
      .spyOn(AudioEngineService.prototype, 'playIncorrectSound')
      .mockImplementation(() => {});

    const showOpenDialogMock = vi.fn().mockResolvedValue('test.xml');
    // 2音構成にしておくことで、1音目正解後も2音目がexpectedNotesに残り、
    // 誤った音を弾いた際に 'incorrect' 判定（'ignored'ではなく）になることを保証する。
    const SIMPLE_XML = `<?xml version="1.0"?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>Piano Right</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration></note>
    </measure>
  </part>
</score-partwise>`;
    const readMock = vi.fn().mockResolvedValue(SIMPLE_XML);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).electronAPI = {
      file: {
        showOpenDialog: showOpenDialogMock,
        read: readMock,
      },
    };

    render(<App />);
    const openFileBtn = screen.getByText('ファイルを開く');
    openFileBtn.click();

    await waitFor(() => expect(readMock).toHaveBeenCalled());
    await waitFor(() => expect(onNoteOnSpy).toHaveBeenCalled());

    const noteOnCallback = onNoteOnSpy.mock.calls[onNoteOnSpy.mock.calls.length - 1][0];

    // C4 (midi 60) is the first expected note in the loaded score.
    act(() => {
      noteOnCallback(60, 100, 1);
    });
    expect(playCorrectSpy).toHaveBeenCalledTimes(1);

    // D4 (midi 62) is expected next; pressing C#4 (midi 61) is incorrect.
    act(() => {
      noteOnCallback(61, 100, 1);
    });
    expect(playIncorrectSpy).toHaveBeenCalledTimes(1);

    onNoteOnSpy.mockRestore();
    playCorrectSpy.mockRestore();
    playIncorrectSpy.mockRestore();
  });

  it('applies the persisted "metronome enabled by default" setting to the ui-slice on startup', async () => {
    const settingsGetMock = vi.fn().mockImplementation((key: string) => {
      if (key === 'practice') {
        return Promise.resolve({ defaultErrorMode: 'wait', metronomeEnabled: true });
      }
      return Promise.resolve(undefined);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).electronAPI = {
      file: { showOpenDialog: vi.fn() },
      settings: {
        get: settingsGetMock,
        set: vi.fn(),
        getRecentFiles: vi.fn().mockResolvedValue([]),
      },
    };

    await act(async () => {
      render(<App />);
    });

    await waitFor(() => expect(settingsGetMock).toHaveBeenCalledWith('practice'));
    await waitFor(() => expect(usePracticeStore.getState().metronomeEnabled).toBe(true));
  });

  it('applies the persisted "metronome accent enabled" setting to the ui-slice on startup (TASK-063)', async () => {
    usePracticeStore.setState({ metronomeAccentEnabled: true });
    const settingsGetMock = vi.fn().mockImplementation((key: string) => {
      if (key === 'practice') {
        return Promise.resolve({
          defaultErrorMode: 'wait',
          metronomeEnabled: false,
          metronomeAccentEnabled: false,
        });
      }
      return Promise.resolve(undefined);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).electronAPI = {
      file: { showOpenDialog: vi.fn() },
      settings: {
        get: settingsGetMock,
        set: vi.fn(),
        getRecentFiles: vi.fn().mockResolvedValue([]),
      },
    };

    await act(async () => {
      render(<App />);
    });

    await waitFor(() => expect(settingsGetMock).toHaveBeenCalledWith('practice'));
    await waitFor(() => expect(usePracticeStore.getState().metronomeAccentEnabled).toBe(false));
  });

  it('keeps metronomeAccentEnabled at its store default (true) when the persisted practice settings lack the key (backward compatibility, TASK-063)', async () => {
    usePracticeStore.setState({ metronomeAccentEnabled: true });
    const settingsGetMock = vi.fn().mockImplementation((key: string) => {
      if (key === 'practice') {
        // 既存ストア（キー追加前に永続化されたデータ）を模す。
        return Promise.resolve({ defaultErrorMode: 'wait', metronomeEnabled: false });
      }
      return Promise.resolve(undefined);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).electronAPI = {
      file: { showOpenDialog: vi.fn() },
      settings: {
        get: settingsGetMock,
        set: vi.fn(),
        getRecentFiles: vi.fn().mockResolvedValue([]),
      },
    };

    await act(async () => {
      render(<App />);
    });

    await waitFor(() => expect(settingsGetMock).toHaveBeenCalledWith('practice'));
    expect(usePracticeStore.getState().metronomeAccentEnabled).toBe(true);
  });

  it('applies the persisted "default error mode" setting to the practice-slice on startup (TASK-040)', async () => {
    const settingsGetMock = vi.fn().mockImplementation((key: string) => {
      if (key === 'practice') {
        return Promise.resolve({ defaultErrorMode: 'pass', metronomeEnabled: false });
      }
      return Promise.resolve(undefined);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).electronAPI = {
      file: { showOpenDialog: vi.fn() },
      settings: {
        get: settingsGetMock,
        set: vi.fn(),
        getRecentFiles: vi.fn().mockResolvedValue([]),
      },
    };

    await act(async () => {
      render(<App />);
    });

    await waitFor(() => expect(settingsGetMock).toHaveBeenCalledWith('practice'));
    await waitFor(() => expect(usePracticeStore.getState().errorMode).toBe('pass'));
  });

  it('applies the persisted ui.zoom / ui.pianoHeight settings to the store on startup (TASK-045)', async () => {
    const settingsGetMock = vi.fn().mockImplementation((key: string) => {
      if (key === 'practice') {
        return Promise.resolve({ defaultErrorMode: 'wait', metronomeEnabled: false });
      }
      if (key === 'ui') {
        return Promise.resolve({ theme: 'light', language: 'ja', zoom: 2.5, pianoHeight: 200 });
      }
      return Promise.resolve(undefined);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).electronAPI = {
      file: { showOpenDialog: vi.fn() },
      settings: {
        get: settingsGetMock,
        set: vi.fn(),
        getRecentFiles: vi.fn().mockResolvedValue([]),
      },
    };

    await act(async () => {
      render(<App />);
    });

    await waitFor(() => expect(settingsGetMock).toHaveBeenCalledWith('ui'));
    await waitFor(() => expect(usePracticeStore.getState().zoom).toBe(2.5));
    expect(usePracticeStore.getState().pianoHeight).toBe(200);
  });

  it('applies the persisted ui.volume setting to the store on startup (TASK-052)', async () => {
    const settingsGetMock = vi.fn().mockImplementation((key: string) => {
      if (key === 'practice') {
        return Promise.resolve({ defaultErrorMode: 'wait', metronomeEnabled: false });
      }
      if (key === 'ui') {
        return Promise.resolve({
          theme: 'light',
          language: 'ja',
          zoom: 1,
          pianoHeight: 120,
          volume: 35,
        });
      }
      return Promise.resolve(undefined);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).electronAPI = {
      file: { showOpenDialog: vi.fn() },
      settings: {
        get: settingsGetMock,
        set: vi.fn(),
        getRecentFiles: vi.fn().mockResolvedValue([]),
      },
    };

    await act(async () => {
      render(<App />);
    });

    await waitFor(() => expect(settingsGetMock).toHaveBeenCalledWith('ui'));
    await waitFor(() => expect(usePracticeStore.getState().volume).toBe(35));
  });

  it('applies the persisted midi.selectedDeviceId setting to WebMidiService via useMidi on startup (TASK-045, REQ-004-008)', async () => {
    const setSelectedDeviceSpy = vi.spyOn(WebMidiService.prototype, 'setSelectedDevice');

    const settingsGetMock = vi.fn().mockImplementation((key: string) => {
      if (key === 'practice') {
        return Promise.resolve({ defaultErrorMode: 'wait', metronomeEnabled: false });
      }
      if (key === 'midi') {
        return Promise.resolve({ selectedDeviceId: 'device-9', selectedDeviceIndex: 0 });
      }
      return Promise.resolve(undefined);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).electronAPI = {
      file: { showOpenDialog: vi.fn() },
      settings: {
        get: settingsGetMock,
        set: vi.fn(),
        getRecentFiles: vi.fn().mockResolvedValue([]),
      },
    };

    await act(async () => {
      render(<App />);
    });

    await waitFor(() => expect(settingsGetMock).toHaveBeenCalledWith('midi'));
    await waitFor(() => expect(setSelectedDeviceSpy).toHaveBeenCalledWith('device-9'));

    setSelectedDeviceSpy.mockRestore();
  });

  it('does not throw when electronAPI is unavailable while loading the default metronome setting', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).electronAPI;

    expect(() => render(<App />)).not.toThrow();
  });

  it('passes loopRange=null to ScoreRenderer when the loop is disabled', () => {
    act(() => {
      usePracticeStore.setState({ loopEnabled: false, loopStart: 1, loopEnd: 2 });
    });

    render(<App />);

    const scoreRenderer = screen.getByTestId('mock-score-renderer');
    expect(scoreRenderer.getAttribute('data-looprange')).toBe('null');
  });

  it('passes loopRange derived from loopStart/loopEnd to ScoreRenderer when the loop is enabled', () => {
    act(() => {
      usePracticeStore.setState({ loopEnabled: true, loopStart: 3, loopEnd: 7 });
    });

    render(<App />);

    const scoreRenderer = screen.getByTestId('mock-score-renderer');
    expect(scoreRenderer.getAttribute('data-looprange')).toBe(JSON.stringify({ start: 3, end: 7 }));
  });
});

describe('App - TASK-055: 運指の一括表示/非表示トグル', () => {
  const SIMPLE_XML = `<?xml version="1.0"?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>Piano Right</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration></note>
    </measure>
  </part>
</score-partwise>`;

  async function openScoreWithSuggestedFingering(): Promise<void> {
    const showOpenDialogMock = vi.fn().mockResolvedValue('test.xml');
    const readMock = vi.fn().mockImplementation((path: string) => {
      if (path.endsWith('.annotation.json')) {
        return Promise.reject(new Error('not found'));
      }
      return Promise.resolve(SIMPLE_XML);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).electronAPI = {
      file: {
        showOpenDialog: showOpenDialogMock,
        read: readMock,
        write: vi.fn().mockResolvedValue(undefined),
      },
    };

    render(<App />);
    const openFileBtn = screen.getByText('ファイルを開く');
    openFileBtn.click();

    await waitFor(() => expect(readMock).toHaveBeenCalledWith('test.xml'));
    await waitFor(() => expect(latestFingeringPanelProps?.onSuggested).toBeInstanceOf(Function));

    await act(async () => {
      await latestFingeringPanelProps.onSuggested([{ noteId: 'P1-M1-N0', finger: 2, cost: 0 }]);
    });

    await waitFor(() =>
      expect(latestScoreRendererProps.annotations).toEqual([
        expect.objectContaining({ noteId: 'P1-M1-N0', fingerNumber: 2 }),
      ])
    );
  }

  afterEach(() => {
    act(() => {
      usePracticeStore.setState({ showFingerings: true, score: null });
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).electronAPI;
  });

  it('passes an empty annotations array to ScoreRenderer and PianoKeyboard when showFingerings is turned off (data is not mutated in annotation-store)', async () => {
    await openScoreWithSuggestedFingering();

    act(() => {
      usePracticeStore.getState().setShowFingerings(false);
    });

    await waitFor(() => expect(latestScoreRendererProps.annotations).toEqual([]));
    expect(latestPianoKeyboardProps.annotations).toEqual([]);
  });

  it('restores the real annotations to ScoreRenderer and PianoKeyboard immediately when showFingerings is turned back on', async () => {
    await openScoreWithSuggestedFingering();

    act(() => {
      usePracticeStore.getState().setShowFingerings(false);
    });
    await waitFor(() => expect(latestScoreRendererProps.annotations).toEqual([]));

    act(() => {
      usePracticeStore.getState().setShowFingerings(true);
    });

    await waitFor(() =>
      expect(latestScoreRendererProps.annotations).toEqual([
        expect.objectContaining({ noteId: 'P1-M1-N0', fingerNumber: 2 }),
      ])
    );
    expect(latestPianoKeyboardProps.annotations).toEqual([
      expect.objectContaining({ noteId: 'P1-M1-N0', fingerNumber: 2 }),
    ]);
  });

  it('automatically turns showFingerings back on when a fingering suggestion is applied while it is off (so the result is visible)', async () => {
    const showOpenDialogMock = vi.fn().mockResolvedValue('test.xml');
    const readMock = vi.fn().mockImplementation((path: string) => {
      if (path.endsWith('.annotation.json')) {
        return Promise.reject(new Error('not found'));
      }
      return Promise.resolve(SIMPLE_XML);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).electronAPI = {
      file: {
        showOpenDialog: showOpenDialogMock,
        read: readMock,
        write: vi.fn().mockResolvedValue(undefined),
      },
    };

    render(<App />);
    const openFileBtn = screen.getByText('ファイルを開く');
    openFileBtn.click();
    await waitFor(() => expect(readMock).toHaveBeenCalledWith('test.xml'));
    await waitFor(() => expect(latestFingeringPanelProps?.onSuggested).toBeInstanceOf(Function));

    act(() => {
      usePracticeStore.getState().setShowFingerings(false);
    });
    expect(usePracticeStore.getState().showFingerings).toBe(false);

    await act(async () => {
      await latestFingeringPanelProps.onSuggested([{ noteId: 'P1-M1-N0', finger: 4, cost: 0 }]);
    });

    expect(usePracticeStore.getState().showFingerings).toBe(true);
    await waitFor(() =>
      expect(latestScoreRendererProps.annotations).toEqual([
        expect.objectContaining({ noteId: 'P1-M1-N0', fingerNumber: 4 }),
      ])
    );
  });

  it('applies the persisted ui.showFingerings setting to the store on startup', async () => {
    const settingsGetMock = vi.fn().mockImplementation((key: string) => {
      if (key === 'practice') {
        return Promise.resolve({ defaultErrorMode: 'wait', metronomeEnabled: false });
      }
      if (key === 'ui') {
        return Promise.resolve({
          theme: 'light',
          language: 'ja',
          zoom: 1,
          pianoHeight: 120,
          volume: 80,
          showFingerings: false,
        });
      }
      return Promise.resolve(undefined);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).electronAPI = {
      file: { showOpenDialog: vi.fn() },
      settings: {
        get: settingsGetMock,
        set: vi.fn(),
        getRecentFiles: vi.fn().mockResolvedValue([]),
      },
    };

    await act(async () => {
      render(<App />);
    });

    await waitFor(() => expect(settingsGetMock).toHaveBeenCalledWith('ui'));
    await waitFor(() => expect(usePracticeStore.getState().showFingerings).toBe(false));
  });
});

describe('App - TASK-056: 画面下キーボードの鍵盤数指定', () => {
  afterEach(() => {
    act(() => {
      usePracticeStore.setState({ keyboardSize: 88 });
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).electronAPI;
  });

  it('passes the current ui-slice keyboardSize to PianoKeyboard (default 88)', () => {
    render(<App />);
    expect(latestPianoKeyboardProps.keyboardSize).toBe(88);
  });

  it('passes the updated keyboardSize to PianoKeyboard immediately when the store changes (SettingsModal結線の検証)', () => {
    render(<App />);
    expect(latestPianoKeyboardProps.keyboardSize).toBe(88);

    act(() => {
      usePracticeStore.getState().setKeyboardSize(61);
    });

    expect(latestPianoKeyboardProps.keyboardSize).toBe(61);
  });

  it('applies the persisted ui.keyboardSize setting to the store (and to PianoKeyboard) on startup', async () => {
    const settingsGetMock = vi.fn().mockImplementation((key: string) => {
      if (key === 'practice') {
        return Promise.resolve({ defaultErrorMode: 'wait', metronomeEnabled: false });
      }
      if (key === 'ui') {
        return Promise.resolve({
          theme: 'light',
          language: 'ja',
          zoom: 1,
          pianoHeight: 120,
          volume: 80,
          showFingerings: true,
          keyboardSize: 49,
        });
      }
      return Promise.resolve(undefined);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).electronAPI = {
      file: { showOpenDialog: vi.fn() },
      settings: {
        get: settingsGetMock,
        set: vi.fn(),
        getRecentFiles: vi.fn().mockResolvedValue([]),
      },
    };

    await act(async () => {
      render(<App />);
    });

    await waitFor(() => expect(settingsGetMock).toHaveBeenCalledWith('ui'));
    await waitFor(() => expect(usePracticeStore.getState().keyboardSize).toBe(49));
    expect(latestPianoKeyboardProps.keyboardSize).toBe(49);
  });

  it('does not throw when electronAPI is unavailable while loading the default keyboardSize setting', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).electronAPI;

    expect(() => render(<App />)).not.toThrow();
  });
});

// TASK-057: usePracticeが公開するsoundingNotes（再生中の発音中ノーツ集合）が
// そのままPianoKeyboardへ渡されることの結線検証。実際の値の遷移（音価に応じた
// 更新）はaudio-engine.test/usePractice.testで検証済みのため、ここでは
// 「usePractice()の戻り値がpropsとしてそのまま伝搬すること」のみを確認する。
describe('App - soundingNotesの伝搬（TASK-057）', () => {
  it('passes an empty soundingNotes set to PianoKeyboard initially (no playback in progress)', () => {
    render(<App />);

    expect(latestPianoKeyboardProps.soundingNotes).toEqual(new Set());
  });
});

describe('App - drag & drop file open (TASK-053)', () => {
  const SIMPLE_XML = `<?xml version="1.0"?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>Piano Right</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration></note>
    </measure>
  </part>
</score-partwise>`;

  afterEach(() => {
    usePracticeStore.setState({ score: null, musicXmlPath: null, musicXmlContent: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).electronAPI;
  });

  function dropFiles(container: HTMLElement, files: File[]): void {
    fireEvent.drop(container, {
      dataTransfer: { files, types: ['Files'] },
    });
  }

  it('shows a drop hint placeholder while no score is loaded', () => {
    render(<App />);
    expect(
      screen.getByText('ここにMusicXMLファイルをドロップ（またはファイルを開く）')
    ).toBeInTheDocument();
  });

  it('shows a drag-active visual overlay on dragenter and clears it on dragleave', () => {
    render(<App />);
    const appRoot = screen.getByTestId('app-container');

    fireEvent.dragEnter(appRoot, { dataTransfer: { types: ['Files'] } });
    expect(screen.getByTestId('drag-active-overlay')).toBeInTheDocument();

    fireEvent.dragLeave(appRoot, { dataTransfer: { types: ['Files'] } });
    expect(screen.queryByTestId('drag-active-overlay')).not.toBeInTheDocument();
  });

  it('prevents the default browser behavior on dragover so a drop can occur', () => {
    render(<App />);
    const appRoot = screen.getByTestId('app-container');

    const dragOverEvent = createEvent.dragOver(appRoot, { dataTransfer: { types: ['Files'] } });
    fireEvent(appRoot, dragOverEvent);

    expect(dragOverEvent.defaultPrevented).toBe(true);
  });

  it('opens a dropped .xml file through the same pipeline as the dialog and registers it for annotation writes', async () => {
    const getDroppedFilePathMock = vi.fn().mockReturnValue('/scores/dropped.xml');
    const registerDroppedFileMock = vi.fn().mockResolvedValue(true);
    const readMock = vi.fn().mockResolvedValue(SIMPLE_XML);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).electronAPI = {
      file: {
        showOpenDialog: vi.fn(),
        read: readMock,
        getDroppedFilePath: getDroppedFilePathMock,
        registerDroppedFile: registerDroppedFileMock,
      },
    };

    render(<App />);
    const appRoot = screen.getByTestId('app-container');
    const file = new File([SIMPLE_XML], 'dropped.xml', { type: 'application/xml' });

    dropFiles(appRoot, [file]);

    await waitFor(() => expect(getDroppedFilePathMock).toHaveBeenCalledWith(file));
    await waitFor(() =>
      expect(registerDroppedFileMock).toHaveBeenCalledWith('/scores/dropped.xml')
    );
    await waitFor(() => expect(readMock).toHaveBeenCalledWith('/scores/dropped.xml'));
    await waitFor(() => expect(usePracticeStore.getState().score).not.toBeNull());
    expect(usePracticeStore.getState().musicXmlPath).toBe('/scores/dropped.xml');

    expect(screen.queryByTestId('drag-active-overlay')).not.toBeInTheDocument();
  });

  it('opens a dropped .mxl file via the binary read path', async () => {
    const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container>
  <rootfiles>
    <rootfile full-path="score.xml" media-type="application/vnd.recordare.musicxml+xml"/>
  </rootfiles>
</container>`;

    const { zipSync } = await import('fflate');
    const zipped = zipSync({
      'META-INF/container.xml': new TextEncoder().encode(containerXml),
      'score.xml': new TextEncoder().encode(SIMPLE_XML),
    });

    const readBinaryMock = vi.fn().mockResolvedValue(zipped.buffer);
    const getDroppedFilePathMock = vi.fn().mockReturnValue('/scores/dropped.mxl');
    const registerDroppedFileMock = vi.fn().mockResolvedValue(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).electronAPI = {
      file: {
        showOpenDialog: vi.fn(),
        readBinary: readBinaryMock,
        getDroppedFilePath: getDroppedFilePathMock,
        registerDroppedFile: registerDroppedFileMock,
      },
    };

    render(<App />);
    const appRoot = screen.getByTestId('app-container');
    const file = new File(['dummy'], 'dropped.mxl');

    dropFiles(appRoot, [file]);

    await waitFor(() => expect(readBinaryMock).toHaveBeenCalledWith('/scores/dropped.mxl'));
    await waitFor(() => expect(usePracticeStore.getState().score).not.toBeNull());
  });

  it('rejects a dropped file with an unsupported extension without calling the open pipeline', async () => {
    const getDroppedFilePathMock = vi.fn();
    const registerDroppedFileMock = vi.fn();
    const readMock = vi.fn();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).electronAPI = {
      file: {
        showOpenDialog: vi.fn(),
        read: readMock,
        getDroppedFilePath: getDroppedFilePathMock,
        registerDroppedFile: registerDroppedFileMock,
      },
    };

    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(<App />);
    const appRoot = screen.getByTestId('app-container');
    const file = new File(['%PDF-1.4'], 'song.pdf', { type: 'application/pdf' });

    dropFiles(appRoot, [file]);

    await waitFor(() =>
      expect(alertMock).toHaveBeenCalledWith(
        '対応していないファイル形式です。.xml / .musicxml / .mxl ファイルをドロップしてください。'
      )
    );
    expect(getDroppedFilePathMock).not.toHaveBeenCalled();
    expect(registerDroppedFileMock).not.toHaveBeenCalled();
    expect(readMock).not.toHaveBeenCalled();

    alertMock.mockRestore();
  });

  it('considers only the first dropped file when multiple files are dropped, rejecting when it is unsupported', async () => {
    const readMock = vi.fn();
    const getDroppedFilePathMock = vi.fn();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).electronAPI = {
      file: {
        showOpenDialog: vi.fn(),
        read: readMock,
        getDroppedFilePath: getDroppedFilePathMock,
        registerDroppedFile: vi.fn(),
      },
    };

    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(<App />);
    const appRoot = screen.getByTestId('app-container');
    const invalidFirst = new File(['%PDF-1.4'], 'notes.pdf', { type: 'application/pdf' });
    const validSecond = new File([SIMPLE_XML], 'valid.xml', { type: 'application/xml' });

    dropFiles(appRoot, [invalidFirst, validSecond]);

    await waitFor(() => expect(alertMock).toHaveBeenCalled());
    expect(getDroppedFilePathMock).not.toHaveBeenCalled();
    expect(readMock).not.toHaveBeenCalled();

    alertMock.mockRestore();
  });

  it('notifies the user when the main process rejects registering the dropped path (defense in depth)', async () => {
    const getDroppedFilePathMock = vi.fn().mockReturnValue('/scores/dropped.xml');
    const registerDroppedFileMock = vi.fn().mockResolvedValue(false);
    const readMock = vi.fn();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).electronAPI = {
      file: {
        showOpenDialog: vi.fn(),
        read: readMock,
        getDroppedFilePath: getDroppedFilePathMock,
        registerDroppedFile: registerDroppedFileMock,
      },
    };

    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(<App />);
    const appRoot = screen.getByTestId('app-container');
    const file = new File([SIMPLE_XML], 'dropped.xml', { type: 'application/xml' });

    dropFiles(appRoot, [file]);

    await waitFor(() =>
      expect(registerDroppedFileMock).toHaveBeenCalledWith('/scores/dropped.xml')
    );
    await waitFor(() => expect(alertMock).toHaveBeenCalled());
    expect(readMock).not.toHaveBeenCalled();

    alertMock.mockRestore();
  });

  it('shows an alert when electronAPI is unavailable at drop time', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(<App />);
    const appRoot = screen.getByTestId('app-container');
    const file = new File([SIMPLE_XML], 'dropped.xml', { type: 'application/xml' });

    dropFiles(appRoot, [file]);

    await waitFor(() =>
      expect(alertMock).toHaveBeenCalledWith(
        'Electron API が利用できません。Electron アプリとして起動してください。'
      )
    );

    alertMock.mockRestore();
  });
});

describe('App - TASK-051: playback practice-mode filter / cursor-position playback / note-level cursor movement', () => {
  const TWO_NOTE_XML = `<?xml version="1.0"?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>Piano Right</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration></note>
    </measure>
  </part>
</score-partwise>`;

  async function openTwoNoteScore(): Promise<void> {
    const showOpenDialogMock = vi.fn().mockResolvedValue('test.xml');
    const readMock = vi.fn().mockResolvedValue(TWO_NOTE_XML);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).electronAPI = {
      file: { showOpenDialog: showOpenDialogMock, read: readMock },
    };

    render(<App />);
    const openFileBtn = screen.getByText('ファイルを開く');
    openFileBtn.click();

    await waitFor(() => expect(readMock).toHaveBeenCalled());
    await waitFor(() => expect(usePracticeStore.getState().score).not.toBeNull());
  }

  afterEach(() => {
    usePracticeStore.setState({
      currentMeasure: 1,
      currentNoteIndex: 0,
      playbackState: 'stopped',
      score: null,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).electronAPI;
    latestScoreRendererProps = null;
    latestToolbarProps = null;
  });

  it("moves the cursor to the clicked note's own judgement group, not the measure head (REQ-002-004)", async () => {
    await openTwoNoteScore();

    const score = usePracticeStore.getState().score!;
    const secondNote = score.measures[0].notes[1];

    act(() => {
      latestScoreRendererProps.onNoteClick(secondNote);
    });

    expect(usePracticeStore.getState().currentMeasure).toBe(1);
    expect(usePracticeStore.getState().currentNoteIndex).toBe(1);
  });

  it('keeps the cursor at group index 0 when the clicked note is the first judgement group (regression)', async () => {
    await openTwoNoteScore();

    const score = usePracticeStore.getState().score!;
    const firstNote = score.measures[0].notes[0];

    act(() => {
      latestScoreRendererProps.onNoteClick(firstNote);
    });

    expect(usePracticeStore.getState().currentMeasure).toBe(1);
    expect(usePracticeStore.getState().currentNoteIndex).toBe(0);
  });

  it('starts playback from the current cursor position tick when playing from a stopped state (REQ-010-001)', async () => {
    const playAccompanimentSpy = vi
      .spyOn(AudioEngineService.prototype, 'playAccompaniment')
      .mockImplementation(() => {});

    await openTwoNoteScore();

    const score = usePracticeStore.getState().score!;
    const secondNote = score.measures[0].notes[1];

    act(() => {
      latestScoreRendererProps.onNoteClick(secondNote);
    });

    await waitFor(() => expect(latestToolbarProps?.audioEngine).toBeDefined());

    act(() => {
      latestToolbarProps.audioEngine.playAccompaniment();
    });

    expect(playAccompanimentSpy).toHaveBeenCalledWith(secondNote.startTick);

    playAccompanimentSpy.mockRestore();
  });

  it('resumes from the current cursor position tick even from a paused state (paused中のカーソル移動を反映)', async () => {
    // カーソルは再生中も再生位置に追従する（REQ-010-005）ため、一時停止時点の
    // カーソル位置＝一時停止位置であり、常にカーソル位置から開始すれば
    // REQ-010-003（一時停止位置からの再開）は実質満たされる。加えて、
    // 一時停止中にユーザーが楽譜クリックでカーソルを動かした場合は
    // その位置から再開できる（2026-07-05 実機フィードバック）。
    const playAccompanimentSpy = vi
      .spyOn(AudioEngineService.prototype, 'playAccompaniment')
      .mockImplementation(() => {});

    await openTwoNoteScore();
    await waitFor(() => expect(latestToolbarProps?.audioEngine).toBeDefined());

    const score = usePracticeStore.getState().score!;
    const secondNote = score.measures[0].notes[1];

    act(() => {
      usePracticeStore.setState({ playbackState: 'paused' });
    });

    // 一時停止中に楽譜クリックでカーソルを移動する
    act(() => {
      latestScoreRendererProps.onNoteClick(secondNote);
    });

    act(() => {
      latestToolbarProps.audioEngine.playAccompaniment();
    });

    expect(playAccompanimentSpy).toHaveBeenCalledWith(secondNote.startTick);

    playAccompanimentSpy.mockRestore();
  });
});

describe('App - note context menu (TASK-044, US-008)', () => {
  const SIMPLE_XML = `<?xml version="1.0"?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>Piano Right</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration></note>
    </measure>
  </part>
</score-partwise>`;

  async function openScoreFile(writeMock: ReturnType<typeof vi.fn>): Promise<void> {
    const showOpenDialogMock = vi.fn().mockResolvedValue('test.xml');
    const readMock = vi.fn().mockImplementation((path: string) => {
      if (path.endsWith('.annotation.json')) {
        return Promise.reject(new Error('not found'));
      }
      return Promise.resolve(SIMPLE_XML);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).electronAPI = {
      file: {
        showOpenDialog: showOpenDialogMock,
        read: readMock,
        write: writeMock,
      },
    };

    render(<App />);
    const openFileBtn = screen.getByText('ファイルを開く');
    openFileBtn.click();

    await waitFor(() => expect(readMock).toHaveBeenCalledWith('test.xml'));
    await waitFor(() =>
      expect(latestScoreRendererProps?.onNoteContextMenu).toBeInstanceOf(Function)
    );
  }

  it('opens the context menu on right-click and saves a selected finger number via annotation-store (REQ-008-001)', async () => {
    const writeMock = vi.fn().mockResolvedValue(undefined);
    await openScoreFile(writeMock);

    act(() => {
      latestScoreRendererProps.onNoteContextMenu('P1-M1-N0', 50, 60);
    });

    expect(screen.getByTestId('note-context-menu')).toBeInTheDocument();

    await act(async () => {
      screen.getByTestId('finger-option-3').click();
    });

    await waitFor(() => expect(writeMock).toHaveBeenCalled());
    const writtenContent = JSON.parse(writeMock.mock.calls[0][1] as string);
    expect(writtenContent.annotations).toEqual([
      expect.objectContaining({ noteId: 'P1-M1-N0', fingerNumber: 3 }),
    ]);

    expect(screen.queryByTestId('note-context-menu')).not.toBeInTheDocument();

    await waitFor(() =>
      expect(latestPianoKeyboardProps.annotations).toEqual([
        expect.objectContaining({ noteId: 'P1-M1-N0', fingerNumber: 3 }),
      ])
    );
    expect(latestScoreRendererProps.annotations).toEqual([
      expect.objectContaining({ noteId: 'P1-M1-N0', fingerNumber: 3 }),
    ]);
  });

  it('removes an existing finger number via the context menu (REQ-008-006)', async () => {
    const writeMock = vi.fn().mockResolvedValue(undefined);
    await openScoreFile(writeMock);

    act(() => {
      latestScoreRendererProps.onNoteContextMenu('P1-M1-N0', 50, 60);
    });
    await act(async () => {
      screen.getByTestId('finger-option-4').click();
    });
    await waitFor(() => expect(writeMock).toHaveBeenCalledTimes(1));

    act(() => {
      latestScoreRendererProps.onNoteContextMenu('P1-M1-N0', 50, 60);
    });
    expect(screen.getByTestId('remove-finger-button')).not.toBeDisabled();

    await act(async () => {
      screen.getByTestId('remove-finger-button').click();
    });

    await waitFor(() => expect(writeMock).toHaveBeenCalledTimes(2));
    const writtenContent = JSON.parse(
      writeMock.mock.calls[writeMock.mock.calls.length - 1][1] as string
    );
    expect(writtenContent.annotations).toEqual([]);
    await waitFor(() => expect(latestPianoKeyboardProps.annotations).toEqual([]));
  });

  it('adds and edits a text comment via the context menu (REQ-008-003)', async () => {
    const writeMock = vi.fn().mockResolvedValue(undefined);
    await openScoreFile(writeMock);

    act(() => {
      latestScoreRendererProps.onNoteContextMenu('P1-M1-N0', 50, 60);
    });

    const textarea = screen.getByTestId('comment-textarea') as HTMLTextAreaElement;
    await act(async () => {
      fireEvent.change(textarea, { target: { value: '親指から始める' } });
      screen.getByTestId('save-comment-button').click();
    });

    await waitFor(() => expect(writeMock).toHaveBeenCalled());
    const writtenContent = JSON.parse(writeMock.mock.calls[0][1] as string);
    expect(writtenContent.annotations).toEqual([
      expect.objectContaining({ noteId: 'P1-M1-N0', comment: '親指から始める' }),
    ]);
  });

  it('approves an AI-suggested annotation via the context menu, reflected as isApproved in showFingerings data (REQ-009-005)', async () => {
    const writeMock = vi.fn().mockResolvedValue(undefined);
    await openScoreFile(writeMock);

    await waitFor(() => expect(latestFingeringPanelProps?.onSuggested).toBeInstanceOf(Function));

    await act(async () => {
      await latestFingeringPanelProps.onSuggested([{ noteId: 'P1-M1-N0', finger: 2, cost: 0 }]);
    });

    await waitFor(() =>
      expect(latestScoreRendererProps.annotations).toEqual([
        expect.objectContaining({ noteId: 'P1-M1-N0', fingerNumber: 2, isApproved: false }),
      ])
    );

    act(() => {
      latestScoreRendererProps.onNoteContextMenu('P1-M1-N0', 50, 60);
    });

    await act(async () => {
      screen.getByTestId('approve-annotation-button').click();
    });

    await waitFor(() =>
      expect(latestScoreRendererProps.annotations).toEqual([
        expect.objectContaining({ noteId: 'P1-M1-N0', fingerNumber: 2, isApproved: true }),
      ])
    );
  });

  it('keeps a manually approved annotation when new AI suggestions are applied afterwards (REQ-009-006 regression)', async () => {
    const writeMock = vi.fn().mockResolvedValue(undefined);
    await openScoreFile(writeMock);

    await waitFor(() => expect(latestFingeringPanelProps?.onSuggested).toBeInstanceOf(Function));

    await act(async () => {
      await latestFingeringPanelProps.onSuggested([{ noteId: 'P1-M1-N0', finger: 2, cost: 0 }]);
    });

    act(() => {
      latestScoreRendererProps.onNoteContextMenu('P1-M1-N0', 50, 60);
    });
    await act(async () => {
      screen.getByTestId('approve-annotation-button').click();
    });

    await waitFor(() =>
      expect(latestScoreRendererProps.annotations).toEqual([
        expect.objectContaining({ noteId: 'P1-M1-N0', fingerNumber: 2, isApproved: true }),
      ])
    );

    await act(async () => {
      await latestFingeringPanelProps.onSuggested([{ noteId: 'P1-M1-N0', finger: 5, cost: 0 }]);
    });

    await waitFor(() =>
      expect(latestScoreRendererProps.annotations).toEqual([
        expect.objectContaining({ noteId: 'P1-M1-N0', fingerNumber: 2, isApproved: true }),
      ])
    );
  });
});
