import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PracticeEngineService } from './index';
import { PracticeStore } from '../../store';
import { Note, Part, Score, PracticeMode, ErrorMode } from '../../types';
import { StoreApi } from 'zustand';

describe('PracticeEngineService', () => {
  let mockStore: StoreApi<PracticeStore>;
  let engine: PracticeEngineService;

  const mockParts: Part[] = [
    { id: 'P1', name: 'Right Hand', hand: 'right', clef: 'treble' },
    { id: 'P2', name: 'Left Hand', hand: 'left', clef: 'bass' },
  ];

  const mockNotesMeasure1: Note[] = [
    {
      id: 'n1',
      partId: 'P1',
      measureNumber: 1,
      noteIndex: 0,
      pitch: { step: 'C', octave: 4 },
      midiNumber: 60,
      duration: 1,
      isChord: false,
      isRest: false,
    },
    {
      id: 'n2',
      partId: 'P1',
      measureNumber: 1,
      noteIndex: 1,
      pitch: { step: 'D', octave: 4 },
      midiNumber: 62,
      duration: 1,
      isChord: false,
      isRest: false,
    },
  ];

  const mockChordNotes: Note[] = [
    {
      id: 'c1',
      partId: 'P1',
      measureNumber: 2,
      noteIndex: 0,
      pitch: { step: 'C', octave: 4 },
      midiNumber: 60,
      duration: 1,
      isChord: true,
      isRest: false,
    },
    {
      id: 'c2',
      partId: 'P1',
      measureNumber: 2,
      noteIndex: 0,
      pitch: { step: 'E', octave: 4 },
      midiNumber: 64,
      duration: 1,
      isChord: true,
      isRest: false,
    },
    {
      id: 'c3',
      partId: 'P1',
      measureNumber: 2,
      noteIndex: 0,
      pitch: { step: 'G', octave: 4 },
      midiNumber: 67,
      duration: 1,
      isChord: true,
      isRest: false,
    },
  ];

  const mockLeftHandNote: Note[] = [
    {
      id: 'l1',
      partId: 'P2',
      measureNumber: 3,
      noteIndex: 0,
      pitch: { step: 'C', octave: 3 },
      midiNumber: 48,
      duration: 1,
      isChord: false,
      isRest: false,
    },
  ];

  const mockScore: Score = {
    title: 'Test Score',
    parts: mockParts,
    measures: [
      { number: 1, notes: mockNotesMeasure1 },
      { number: 2, notes: mockChordNotes },
      { number: 3, notes: mockLeftHandNote },
    ],
    tempo: 120,
    timeSignature: { beats: 4, beatType: 4 },
    keySignature: 0,
  };

  beforeEach(() => {
    let currentState = {
      score: mockScore,
      // @ts-expect-error 不完全なPracticeModeのテスト用スタブ
      practiceMode: 'both' as PracticeMode,
      // @ts-expect-error 不完全なErrorModeのテスト用スタブ
      errorMode: 'wait' as ErrorMode,
      currentMeasure: 1,
      currentNoteIndex: 0,
      loopEnabled: false,
      loopStart: 1,
      loopEnd: 1,
      pressedKeys: new Set<number>(),
      stats: { totalNotes: 0, correctNotes: 0, incorrectNotes: 0, accuracy: 0 },
    };

    mockStore = {
      // @ts-expect-error 不完全なPracticeStoreのテスト用スタブ
      getState: () => currentState as PracticeStore,
      setState: vi.fn(
        (
          newStateOrCallback:
            | Partial<PracticeStore>
            | ((state: PracticeStore) => Partial<PracticeStore>)
        ) => {
          if (typeof newStateOrCallback === 'function') {
            currentState = {
              ...currentState,
              // @ts-expect-error 不完全なPracticeStoreのテスト用スタブ
              ...newStateOrCallback(currentState as PracticeStore),
            };
          } else {
            currentState = { ...currentState, ...newStateOrCallback };
          }
        }
      ),
      subscribe: vi.fn(),
      destroy: vi.fn(),
      // @ts-expect-error 不完全なStoreApiのテスト用スタブ
    } as unknown as StoreApi<PracticeStore>;

    engine = new PracticeEngineService(mockStore);
  });

  // 1. 正しい音符を押すと次の音符に進む
  it('advances position on correct note', () => {
    const result = engine.handleNoteOn({
      midiNumber: 60,
      velocity: 100,
      type: 'note-on',
      timestamp: 0,
    });

    expect(result.result).toBe('correct');
    expect(result.advanced).toBe(true);
    expect(mockStore.getState().currentNoteIndex).toBe(1);
    expect(mockStore.getState().stats?.correctNotes).toBe(1);
  });

  // 2. 誤った音符を押すとwaitモードで位置が進まない
  it('does not advance position on incorrect note in wait mode', () => {
    const result = engine.handleNoteOn({
      midiNumber: 61,
      velocity: 100,
      type: 'note-on',
      timestamp: 0,
    });

    expect(result.result).toBe('incorrect');
    expect(result.advanced).toBe(false);
    expect(mockStore.getState().currentNoteIndex).toBe(0);
    expect(mockStore.getState().stats?.incorrectNotes).toBe(1);
  });

  // 3. コードは全音符が揃ったら正解になる
  it('judges chord correct only when all notes are pressed', () => {
    mockStore.setState({ currentMeasure: 2, currentNoteIndex: 0 });

    let result = engine.handleNoteOn({
      midiNumber: 60,
      velocity: 100,
      type: 'note-on',
      timestamp: 0,
    });
    expect(result.result).toBe('correct'); // Partial match is fine, but not advanced yet
    expect(result.advanced).toBe(false);

    result = engine.handleNoteOn({ midiNumber: 64, velocity: 100, type: 'note-on', timestamp: 0 });
    expect(result.result).toBe('correct');
    expect(result.advanced).toBe(false);

    result = engine.handleNoteOn({ midiNumber: 67, velocity: 100, type: 'note-on', timestamp: 0 });
    expect(result.result).toBe('correct');
    expect(result.advanced).toBe(true);
    expect(mockStore.getState().currentMeasure).toBe(3); // Advanced to next measure
    expect(mockStore.getState().currentNoteIndex).toBe(0);
  });

  // 4. 右手モードで左手パートの音符は判定をスキップする
  it('skips left hand notes in right hand mode', () => {
    mockStore.setState({ practiceMode: 'right', currentMeasure: 3, currentNoteIndex: 0 });

    const result = engine.handleNoteOn({
      midiNumber: 60,
      velocity: 100,
      type: 'note-on',
      timestamp: 0,
    });
    // In measure 3, there's only a left hand note.
    // If practiceMode is 'right', the left hand note should be automatically skipped or ignored.
    expect(result.result).toBe('ignored');
  });

  // 5. ループ終端で先頭に戻る
  it('loops back to loopStart when reaching end of loopEnd', () => {
    // Note: Measure 2 only has noteIndex 0 now!
    mockStore.setState({
      loopEnabled: true,
      loopStart: 1,
      loopEnd: 2,
      currentMeasure: 2,
      currentNoteIndex: 0,
    });
    // Advance position manually to simulate pressing first two notes of the chord
    mockStore.setState({ pressedKeys: new Set([60, 64]) });
    const result = engine.handleNoteOn({
      midiNumber: 67,
      velocity: 100,
      type: 'note-on',
      timestamp: 0,
    });

    expect(result.advanced).toBe(true);
    expect(mockStore.getState().currentMeasure).toBe(1); // Looped back
    expect(mockStore.getState().currentNoteIndex).toBe(0);
  });

  // 6. passモードでは誤りでも次に進む
  it('advances position on incorrect note in pass mode', () => {
    mockStore.setState({ errorMode: 'pass' });

    const result = engine.handleNoteOn({
      midiNumber: 61,
      velocity: 100,
      type: 'note-on',
      timestamp: 0,
    });

    expect(result.result).toBe('incorrect');
    expect(result.advanced).toBe(true);
    expect(mockStore.getState().currentNoteIndex).toBe(1);
    expect(mockStore.getState().stats?.incorrectNotes).toBe(1);
  });
});
