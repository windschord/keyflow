import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { parse } from '../../lib/musicxml-parser/parser';
import { usePracticeStore } from '../../store';
import { PracticeEngineService } from '../../lib/practice-engine';
import { SettingsModal } from '../../components/SettingsModal';
import App from '../../App';

// Mock Tone.js globally to avoid AudioContext errors during App rendering in tests.
vi.mock('tone', () => {
  let scheduleIdSeq = 0;
  const mockTransport = {
    bpm: { value: 120 },
    PPQ: 480,
    loop: false,
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    // TASK-051: usePractice が score/practiceMode の変化を監視して
    // audioEngine.loadScore を呼ぶようになった（従来はApp.tsxのhandleOpenFile内で
    // try/catchに包まれて直接呼ばれていたため、この結線が欠けていても例外は
    // 静かに握りつぶされていた）。loadScoreが内部で使うschedule/clear/setLoopPoints
    // もモックしておかないと、エフェクト内の例外がtry/catchで捕捉されず
    // unhandled errorになる。
    schedule: vi.fn(() => scheduleIdSeq++),
    clear: vi.fn(),
    setLoopPoints: vi.fn(),
  };
  const mockDraw = { schedule: vi.fn((callback: () => void) => callback()) };

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
    Sequence: vi.fn().mockImplementation(() => ({
      start: vi.fn(),
      stop: vi.fn(),
      dispose: vi.fn(),
    })),
    Part: vi.fn().mockImplementation(() => ({
      start: vi.fn().mockReturnThis(),
      dispose: vi.fn(),
    })),
    Frequency: vi.fn(() => ({
      toNote: () => 'A4',
    })),
  };
});

vi.mock('../../components/ScoreRenderer', () => ({
  ScoreRenderer: () => null,
}));

vi.mock('../../components/PianoKeyboard', () => ({
  PianoKeyboard: () => null,
}));

vi.mock('../../components/Toolbar', () => ({
  Toolbar: () => null,
}));

vi.mock('../../components/FingeringPanel', () => ({
  FingeringPanel: () => null,
}));

const SAMPLE_MUSICXML_2PARTS = `<?xml version="1.0"?>
<score-partwise>
  <part-list>
    <score-part id="P1"><part-name>Piano Right</part-name></score-part>
    <score-part id="P2"><part-name>Piano Left</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration></note>
    </measure>
  </part>
  <part id="P2">
    <measure number="1">
      <note><pitch><step>C</step><octave>3</octave></pitch><duration>4</duration></note>
    </measure>
  </part>
</score-partwise>`;

const LOOP_TEST_XML = `<?xml version="1.0"?>
<score-partwise>
  <part-list>
    <score-part id="P1"><part-name>Piano Right</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration></note>
    </measure>
    <measure number="2">
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration></note>
    </measure>
  </part>
</score-partwise>`;

const TEMPO_MUSICXML_90 = `<?xml version="1.0"?>
<score-partwise>
  <part-list>
    <score-part id="P1"><part-name>Piano Right</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <direction><sound tempo="90"/></direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration></note>
    </measure>
  </part>
</score-partwise>`;

function resetStore() {
  usePracticeStore.setState({
    score: null,
    musicXmlPath: null,
    musicXmlContent: null,
    practiceMode: 'both',
    errorMode: 'wait',
    currentMeasure: 1,
    currentNoteIndex: 0,
    expectedNotes: [],
    pressedKeys: new Set(),
    incorrectKeys: new Set(),
    loopEnabled: false,
    loopStart: 1,
    loopEnd: 1,
    stats: {
      totalNotes: 0,
      correctNotes: 0,
      incorrectNotes: 0,
      accuracy: 0,
      consecutiveCorrect: 0,
    },
    bpm: 120,
    originalBpm: 120,
  });
}

describe('練習フロー統合テスト', () => {
  beforeEach(() => {
    resetStore();
  });

  it('MusicXMLを読み込んで右手モードで練習を開始できる', () => {
    const score = parse(SAMPLE_MUSICXML_2PARTS);
    expect(score.parts).toHaveLength(2);
    expect(score.measures.length).toBeGreaterThan(0);

    usePracticeStore.getState().setScore(score, '/test/sample.xml', SAMPLE_MUSICXML_2PARTS);
    usePracticeStore.getState().setPracticeMode('right');

    const engine = new PracticeEngineService(usePracticeStore);
    engine.resetToMeasure(1);

    const state = usePracticeStore.getState();
    expect(state.score).not.toBeNull();
    expect(state.practiceMode).toBe('right');
    expect(state.expectedNotes.length).toBeGreaterThan(0);

    const judgement = engine.handleNoteOn({
      midiNumber: 60,
      velocity: 64,
      type: 'note-on',
      timestamp: 0,
    });
    expect(['correct', 'incorrect', 'ignored']).toContain(judgement.result);
  });

  it('ループが有効な時、終端小節の完了後にloopStartへ戻る', () => {
    const score = parse(LOOP_TEST_XML);
    usePracticeStore.getState().setScore(score, '/test/loop.xml', LOOP_TEST_XML);
    usePracticeStore.setState({ loopEnabled: true, loopStart: 1, loopEnd: 2 });

    const engine = new PracticeEngineService(usePracticeStore);
    engine.resetToMeasure(1);

    engine.handleNoteOn({ midiNumber: 60, velocity: 100, type: 'note-on', timestamp: 0 });
    engine.handleNoteOff({ midiNumber: 60, velocity: 0, type: 'note-off', timestamp: 1 });
    expect(usePracticeStore.getState().currentMeasure).toBe(1);

    engine.handleNoteOn({ midiNumber: 62, velocity: 100, type: 'note-on', timestamp: 2 });
    engine.handleNoteOff({ midiNumber: 62, velocity: 0, type: 'note-off', timestamp: 3 });
    expect(usePracticeStore.getState().currentMeasure).toBe(2);

    engine.handleNoteOn({ midiNumber: 64, velocity: 100, type: 'note-on', timestamp: 4 });
    engine.handleNoteOff({ midiNumber: 64, velocity: 0, type: 'note-off', timestamp: 5 });
    expect(usePracticeStore.getState().currentMeasure).toBe(1);
  });

  it('小節1〜2をループして3周できる', () => {
    const score = parse(LOOP_TEST_XML);
    usePracticeStore.getState().setScore(score, '/test/loop.xml', LOOP_TEST_XML);
    usePracticeStore.setState({ loopEnabled: true, loopStart: 1, loopEnd: 2 });

    const engine = new PracticeEngineService(usePracticeStore);
    engine.resetToMeasure(1);

    let loopCount = 0;
    const noteSequence = [60, 62, 64, 60, 62, 64, 60, 62, 64];

    for (const midiNumber of noteSequence) {
      const measureBefore = usePracticeStore.getState().currentMeasure;
      engine.handleNoteOn({ midiNumber, velocity: 100, type: 'note-on', timestamp: 0 });
      engine.handleNoteOff({ midiNumber, velocity: 0, type: 'note-off', timestamp: 1 });
      const measureAfter = usePracticeStore.getState().currentMeasure;

      if (measureBefore === 2 && measureAfter === 1) {
        loopCount++;
      }
    }

    expect(loopCount).toBe(3);
  });
});

describe('SettingsModal→store→practice-engineの結線（TASK-040）', () => {
  beforeEach(() => {
    resetStore();
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  it('SettingsModalで"誤りがあっても先へ進む"を選択すると、誤入力時にpractice-engineが自動で次へ進行する（UI→store→engineの本番経路）', async () => {
    const score = parse(LOOP_TEST_XML);
    usePracticeStore.getState().setScore(score, '/test/loop.xml', LOOP_TEST_XML);

    const engine = new PracticeEngineService(usePracticeStore);
    engine.resetToMeasure(1);

    // 誤り時に到達不能だったことの前提確認: 既定は'wait'なので誤入力しても進行しない。
    expect(usePracticeStore.getState().errorMode).toBe('wait');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).electronAPI = {
      file: { showOpenDialog: vi.fn() },
      settings: {
        get: vi.fn().mockImplementation((key: string) => {
          if (key === 'ui')
            return Promise.resolve({ theme: 'light', language: 'ja', zoom: 1, pianoHeight: 120 });
          if (key === 'practice')
            return Promise.resolve({ defaultErrorMode: 'wait', metronomeEnabled: false });
          return Promise.resolve(undefined);
        }),
        set: vi.fn().mockResolvedValue(undefined),
        getRecentFiles: vi.fn().mockResolvedValue([]),
      },
    };

    render(<SettingsModal isOpen onClose={vi.fn()} />);

    const select = (await screen.findByLabelText('既定のエラーモード')) as HTMLSelectElement;
    await waitFor(() => expect(select.value).toBe('wait'));

    fireEvent.change(select, { target: { value: 'pass' } });

    await waitFor(() => expect(usePracticeStore.getState().errorMode).toBe('pass'));

    // 期待音(C4=60)ではなく誤った音(61)を弾く。UI(SettingsModal)→store(errorMode)→
    // practice-engineの'pass'分岐が本番経路で到達可能であることを確認する。
    const judgement = engine.handleNoteOn({
      midiNumber: 61,
      velocity: 100,
      type: 'note-on',
      timestamp: 0,
    });

    expect(judgement.result).toBe('incorrect');
    expect(judgement.advanced).toBe(true);
    expect(usePracticeStore.getState().currentNoteIndex).toBe(1);
  });
});

describe('アプリ経路の初期化（スコア読み込み→練習セッション初期化）', () => {
  beforeEach(() => {
    resetStore();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).electronAPI;
  });

  it('Open FileでMusicXMLを読み込むと、テスト側でresetToMeasureを呼ばなくてもexpectedNotesが初期化される', async () => {
    const showOpenDialogMock = vi.fn().mockResolvedValue('/test/sample.xml');
    const readMock = vi.fn().mockResolvedValue(SAMPLE_MUSICXML_2PARTS);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).electronAPI = {
      file: { showOpenDialog: showOpenDialogMock, read: readMock },
    };

    render(<App />);
    screen.getByText('ファイルを開く').click();

    await waitFor(() => {
      expect(usePracticeStore.getState().score).not.toBeNull();
    });

    // PracticeEngineService.resetToMeasure はテスト側から一切呼び出していない。
    await waitFor(() => {
      expect(usePracticeStore.getState().expectedNotes.length).toBeGreaterThan(0);
    });
    expect(usePracticeStore.getState().currentMeasure).toBe(1);
    expect(usePracticeStore.getState().currentNoteIndex).toBe(0);
  });

  it('テンポ指定ありのMusicXMLを読み込むと、originalBpm/bpmが楽譜のテンポになる', async () => {
    const showOpenDialogMock = vi.fn().mockResolvedValue('/test/tempo.xml');
    const readMock = vi.fn().mockResolvedValue(TEMPO_MUSICXML_90);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).electronAPI = {
      file: { showOpenDialog: showOpenDialogMock, read: readMock },
    };

    render(<App />);
    screen.getByText('ファイルを開く').click();

    await waitFor(() => {
      expect(usePracticeStore.getState().score).not.toBeNull();
    });

    expect(usePracticeStore.getState().originalBpm).toBe(90);
    expect(usePracticeStore.getState().bpm).toBe(90);
  });

  it('テンポ指定なしのMusicXMLを読み込むと、originalBpm/bpmはパーサーのデフォルト値(120)になる', async () => {
    const showOpenDialogMock = vi.fn().mockResolvedValue('/test/sample.xml');
    const readMock = vi.fn().mockResolvedValue(SAMPLE_MUSICXML_2PARTS);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).electronAPI = {
      file: { showOpenDialog: showOpenDialogMock, read: readMock },
    };

    render(<App />);
    screen.getByText('ファイルを開く').click();

    await waitFor(() => {
      expect(usePracticeStore.getState().score).not.toBeNull();
    });

    expect(usePracticeStore.getState().originalBpm).toBe(120);
    expect(usePracticeStore.getState().bpm).toBe(120);
  });
});
