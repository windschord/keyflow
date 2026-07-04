import { render, screen, waitFor, act } from '@testing-library/react';
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

  return {
    getTransport: vi.fn(() => mockTransport),
    getDraw: vi.fn(() => mockDraw),
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
    Sequence: vi.fn().mockImplementation(() => ({
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

vi.mock('./components/ScoreRenderer', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ScoreRenderer: (props: any) => (
    <div data-testid="mock-score-renderer" data-looprange={JSON.stringify(props.loopRange)}>
      ScoreRenderer
    </div>
  ),
}));

vi.mock('./components/PianoKeyboard', () => ({
  PianoKeyboard: () => <div data-testid="mock-piano-keyboard">PianoKeyboard</div>,
}));

vi.mock('./components/Toolbar', () => ({
  Toolbar: () => <div data-testid="mock-toolbar">Toolbar</div>,
}));

vi.mock('./components/FingeringPanel', () => ({
  FingeringPanel: () => <div data-testid="mock-fingering-panel">FingeringPanel</div>,
}));

describe('App', () => {
  afterEach(() => {
    usePracticeStore.setState({
      bpm: 120,
      originalBpm: 120,
      metronomeEnabled: false,
      loopEnabled: false,
      loopStart: 1,
      loopEnd: 2,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).electronAPI;
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
    const loadScoreSpy = vi.spyOn(AudioEngineService.prototype, 'loadScore').mockImplementation(
      () => {}
    );

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
    expect(scoreRenderer.getAttribute('data-looprange')).toBe(
      JSON.stringify({ start: 3, end: 7 })
    );
  });
});
