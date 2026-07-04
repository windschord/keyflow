import { describe, it, expect, beforeEach } from 'vitest';
import { PracticeEngineService } from './index';
import { PracticeStore } from '../../store';
import { Score, Part, Note, PracticeStats } from '../../types';

describe('PracticeEngineService', () => {
  let engine: PracticeEngineService;
  let mockStore: PracticeStore;

  const mockParts: Part[] = [
    { id: 'P1', name: 'Right Hand', hand: 'right', clef: 'treble' },
    { id: 'P2', name: 'Left Hand', hand: 'left', clef: 'bass' },
  ];

  const mockNotesMeasure1: Note[] = [
    {
      id: 'N1',
      partId: 'P1',
      measureNumber: 1,
      noteIndex: 0,
      pitch: { step: 'C', octave: 4 },
      midiNumber: 60,
      duration: 1,
      startTick: 0,
      durationTicks: 480,
      startSeconds: 0,
      durationSeconds: 0.5,
      voice: 1,
      isChord: false,
      isRest: false,
    },
    {
      id: 'N2',
      partId: 'P1',
      measureNumber: 1,
      noteIndex: 1,
      pitch: { step: 'E', octave: 4 },
      midiNumber: 64,
      duration: 1,
      startTick: 0,
      durationTicks: 480,
      startSeconds: 0,
      durationSeconds: 0.5,
      voice: 1,
      isChord: true,
      isRest: false,
    },
    {
      id: 'N3',
      partId: 'P2',
      measureNumber: 1,
      noteIndex: 2,
      pitch: { step: 'C', octave: 3 },
      midiNumber: 48,
      duration: 1,
      startTick: 0,
      durationTicks: 480,
      startSeconds: 0,
      durationSeconds: 0.5,
      voice: 1,
      isChord: false,
      isRest: false,
    },
  ];

  const mockNotesMeasure2: Note[] = [
    {
      id: 'N4',
      partId: 'P1',
      measureNumber: 2,
      noteIndex: 0,
      pitch: { step: 'D', octave: 4 },
      midiNumber: 62,
      duration: 1,
      startTick: 480,
      durationTicks: 480,
      startSeconds: 0.5,
      durationSeconds: 0.5,
      voice: 1,
      isChord: false,
      isRest: false,
    },
  ];

  const mockScore: Score = {
    title: 'Test Score',
    parts: mockParts,
    measures: [
      { number: 1, startTick: 0, notes: mockNotesMeasure1 },
      { number: 2, startTick: 480, notes: mockNotesMeasure2 },
    ],
    tempo: 120,
    ticksPerQuarter: 480,
    tempoMap: [{ tick: 0, bpm: 120 }],
    timeSignature: { beats: 4, beatType: 4 },
    keySignature: 0,
  };

  beforeEach(() => {
    mockStore = {
      practiceMode: 'both',
      errorMode: 'wait',
      currentMeasure: 1,
      currentNoteIndex: 0,
      expectedNotes: [mockNotesMeasure1[0], mockNotesMeasure1[1]], // chord of C4 and E4
      pressedKeys: new Set(),
      incorrectKeys: new Set(),
      loopEnabled: false,
      loopStart: 1,
      loopEnd: 2,
      stats: { totalNotes: 0, correctNotes: 0, incorrectNotes: 0, accuracy: 0 },
      setPracticeMode: (m) => {
        mockStore.practiceMode = m;
      },
      setLoopRange: (start, end) => {
        mockStore.loopStart = start;
        mockStore.loopEnd = end;
      },
      toggleLoop: () => {
        mockStore.loopEnabled = !mockStore.loopEnabled;
      },
      score: mockScore,
      musicXmlPath: null,
      musicXmlContent: null,
      setScore: () => {},
      // ui slice mocks
      theme: 'system',
      setTheme: () => {},
      zoom: 1,
      setZoom: () => {},
      pianoHeight: 120,
      setPianoHeight: () => {},
      isSidebarOpen: true,
      toggleSidebar: () => {},
    } as PracticeStore;

    const storeApiMock = {
      getState: () => mockStore,
      setState: (partial: Partial<PracticeStore>) => {
        Object.assign(mockStore, partial);
      },
    };

    // @ts-expect-error Mocking StoreApi specifically for this test
    engine = new PracticeEngineService(storeApiMock);
  });

  it('正しい音符を押すと次の音符に進む', () => {
    mockStore.expectedNotes = [mockNotesMeasure1[0]]; // Expect C4 (60)

    const judgement = engine.handleNoteOn({
      midiNumber: 60,
      velocity: 100,
      type: 'note-on',
      timestamp: 0,
    });

    expect(judgement.result).toBe('correct');
    expect(judgement.advanced).toBe(true);
    expect(mockStore.currentNoteIndex).toBe(1);
    expect(mockStore.stats.correctNotes).toBe(1);
  });

  it('誤った音符を押すとwaitモードで位置が進まない', () => {
    mockStore.expectedNotes = [mockNotesMeasure1[0]]; // Expect C4 (60)
    mockStore.errorMode = 'wait';

    const judgement = engine.handleNoteOn({
      midiNumber: 61,
      velocity: 100,
      type: 'note-on',
      timestamp: 0,
    });

    expect(judgement.result).toBe('incorrect');
    expect(judgement.advanced).toBe(false);
    expect(mockStore.currentNoteIndex).toBe(0); // Did not advance
    expect(mockStore.stats.incorrectNotes).toBe(1);
  });

  it('コードは全音符が揃ったら正解になる', () => {
    mockStore.expectedNotes = [mockNotesMeasure1[0], mockNotesMeasure1[1]]; // C4 (60), E4 (64)

    // Press C4
    let judgement = engine.handleNoteOn({
      midiNumber: 60,
      velocity: 100,
      type: 'note-on',
      timestamp: 0,
    });
    expect(judgement.result).toBe('correct');
    expect(judgement.advanced).toBe(false); // Not all chord notes pressed

    // Press E4
    judgement = engine.handleNoteOn({
      midiNumber: 64,
      velocity: 100,
      type: 'note-on',
      timestamp: 0,
    });
    expect(judgement.result).toBe('correct');
    expect(judgement.advanced).toBe(true); // Now chord is complete
  });

  it('コード演奏中に余分な鍵が押されている場合はincorrectとして扱う', () => {
    mockStore.expectedNotes = [mockNotesMeasure1[0], mockNotesMeasure1[1]]; // C4 (60), E4 (64)
    mockStore.pressedKeys = new Set([61]); // Extra key

    const judgement = engine.handleNoteOn({
      midiNumber: 60,
      velocity: 100,
      type: 'note-on',
      timestamp: 0,
    });

    expect(judgement.result).toBe('incorrect');
    expect(judgement.advanced).toBe(false);
    expect(mockStore.currentNoteIndex).toBe(0);
    expect(mockStore.stats.correctNotes).toBe(0);
    expect(mockStore.stats.incorrectNotes).toBe(1);
    expect(mockStore.incorrectKeys.has(61)).toBe(true);
    expect(mockStore.incorrectKeys.has(60)).toBe(false);
  });

  it('右手モードで左手パートの音符は判定をスキップする', () => {
    mockStore.practiceMode = 'right';
    mockStore.expectedNotes = [mockNotesMeasure1[2]]; // C3 (48) from Left Hand (P2)

    // Even if we press something completely different
    const judgement = engine.handleNoteOn({
      midiNumber: 72,
      velocity: 100,
      type: 'note-on',
      timestamp: 0,
    });

    expect(judgement.result).toBe('ignored');
    expect(judgement.advanced).toBe(true); // Advanced because it was skipped
  });

  it('ループ終端で先頭に戻る', () => {
    mockStore.expectedNotes = [mockNotesMeasure2[0]]; // D4 (62) in Measure 2
    mockStore.currentMeasure = 2;
    mockStore.currentNoteIndex = 0; // last note of measure 2 (last measure)
    mockStore.loopEnabled = true;
    mockStore.loopStart = 1;
    mockStore.loopEnd = 2;

    engine.handleNoteOn({ midiNumber: 62, velocity: 100, type: 'note-on', timestamp: 0 });

    expect(mockStore.currentMeasure).toBe(1); // looped back to 1
  });

  it('passモードでは誤りでも次に進む', () => {
    mockStore.expectedNotes = [mockNotesMeasure1[0]]; // Expect C4 (60)
    mockStore.errorMode = 'pass';

    const judgement = engine.handleNoteOn({
      midiNumber: 61,
      velocity: 100,
      type: 'note-on',
      timestamp: 0,
    });

    expect(judgement.result).toBe('incorrect');
    expect(judgement.advanced).toBe(true); // Advanced despite incorrect
  });
});
