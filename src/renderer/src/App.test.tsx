import { render, screen, waitFor } from '@testing-library/react';
import App from './App';
import { vi } from 'vitest';

vi.mock('./components/ScoreRenderer', () => ({
  ScoreRenderer: () => <div data-testid="mock-score-renderer">ScoreRenderer</div>,
}));

vi.mock('./components/PianoKeyboard', () => ({
  PianoKeyboard: () => <div data-testid="mock-piano-keyboard">PianoKeyboard</div>,
}));

vi.mock('./components/Toolbar', () => ({
  Toolbar: () => <div data-testid="mock-toolbar">Toolbar</div>,
}));

describe('App', () => {
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

    // Mock window.alert
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

    const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<App />);
    const openFileBtn = screen.getByText('Open File');

    openFileBtn.click();

    await waitFor(() => {
      expect(showOpenDialogMock).toHaveBeenCalled();
    });
    expect(alertMock).toHaveBeenCalledWith('Failed to parse MusicXML file. Please check the file format.');

    alertMock.mockRestore();
    consoleErrorMock.mockRestore();
  });

  it('handles errors when invoking electronAPI functions', async () => {
    const showOpenDialogMock = vi.fn().mockRejectedValue(new Error('IPC Error'));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).electronAPI = {
      file: {
        showOpenDialog: showOpenDialogMock,
      },
    };

    // Mock window.alert
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

    const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<App />);
    const openFileBtn = screen.getByText('Open File');

    openFileBtn.click();

    await waitFor(() => {
      expect(showOpenDialogMock).toHaveBeenCalled();
    });
    expect(alertMock).toHaveBeenCalledWith(
      'Failed to parse MusicXML file. Please check the file format.'
    );

    alertMock.mockRestore();
    consoleErrorMock.mockRestore();
  });
});
