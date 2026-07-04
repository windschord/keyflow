import { render, screen, waitFor, act } from '@testing-library/react';
import App from './App';
import { vi } from 'vitest';
import { AudioEngineService } from './lib/audio-engine';
import { WebMidiService } from './lib/midi/web-midi';
import { usePracticeStore } from './store';

// Mock Tone.js globally to avoid AudioContext errors during testing
vi.mock('tone', () => {
  const mockTransport = {
    bpm: { value: 120 },
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
  };

  return {
    getTransport: vi.fn(() => mockTransport),
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
  ScoreRenderer: () => <div data-testid="mock-score-renderer">ScoreRenderer</div>,
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
    usePracticeStore.setState({ bpm: 120, originalBpm: 120, metronomeEnabled: false });
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
    expect(screen.getByText('Open File')).toBeInTheDocument();
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
    const openFileBtn = screen.getByText('Open File');
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
    const openFileBtn = screen.getByText('Open File');
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
    const openFileBtn = screen.getByText('Open File');
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
    const openFileBtn = screen.getByText('Open File');
    openFileBtn.click();

    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith(
        'MusicXML ファイルの解析に失敗しました。ファイル形式を確認してください。'
      );
    });

    alertMock.mockRestore();
    consoleErrorMock.mockRestore();
  });

  it('calls audioEngine.loadAccompaniment() when a score is opened', async () => {
    const loadAccompanimentSpy = vi
      .spyOn(AudioEngineService.prototype, 'loadAccompaniment')
      .mockResolvedValue(undefined);

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
    const openFileBtn = screen.getByText('Open File');
    openFileBtn.click();

    await waitFor(() => {
      expect(loadAccompanimentSpy).toHaveBeenCalledTimes(1);
    });
    expect(loadAccompanimentSpy.mock.calls[0][0]).toMatchObject({ tempo: expect.any(Number) });
    expect(['left', 'right', 'unknown']).toContain(loadAccompanimentSpy.mock.calls[0][1]);

    loadAccompanimentSpy.mockRestore();
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
    const openFileBtn = screen.getByText('Open File');
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
    const openFileBtn = screen.getByText('Open File');
    openFileBtn.click();

    await waitFor(() => expect(readMock).toHaveBeenCalled());
    await waitFor(() => expect(onNoteOnSpy).toHaveBeenCalled());

    const noteOnCallback = onNoteOnSpy.mock.calls[onNoteOnSpy.mock.calls.length - 1][0];

    // C4 (midi 60) is the only expected note in the loaded score.
    act(() => {
      noteOnCallback(60, 100, 1);
    });
    expect(playCorrectSpy).toHaveBeenCalledTimes(1);

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

    render(<App />);

    await waitFor(() => expect(settingsGetMock).toHaveBeenCalledWith('practice'));
    await waitFor(() => expect(usePracticeStore.getState().metronomeEnabled).toBe(true));
  });

  it('does not throw when electronAPI is unavailable while loading the default metronome setting', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).electronAPI;

    expect(() => render(<App />)).not.toThrow();
  });
});
