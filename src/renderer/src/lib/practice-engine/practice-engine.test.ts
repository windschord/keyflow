import { describe, it, expect, beforeEach } from 'vitest';
import { PracticeEngineService } from './index';
import { PracticeStore } from '../../store';
import { Score, Part, Note } from '../../types';

/**
 * `startTick`/`durationTicks`/`startSeconds`/`durationSeconds`/`voice` の
 * デフォルト値を補完してテスト用ノートを簡潔に生成するヘルパー。
 */
function makeNote(overrides: Partial<Note> & Pick<Note, 'id' | 'partId' | 'midiNumber'>): Note {
  return {
    measureNumber: 1,
    noteIndex: 0,
    pitch: { step: 'C', octave: 4 },
    duration: 1,
    startTick: 0,
    durationTicks: 480,
    startSeconds: 0,
    durationSeconds: 0.5,
    voice: 1,
    isChord: false,
    isRest: false,
    staff: 1,
    // TASK-048: Note.hand is now the source of truth for practice-mode filtering
    // (note-grouping.ts). Default it from partId to mirror mockParts (P1='right',
    // P2='left') unless a test explicitly overrides it.
    hand: overrides.partId === 'P2' ? 'left' : 'right',
    ...overrides,
  };
}

describe('PracticeEngineService', () => {
  let engine: PracticeEngineService;
  let mockStore: PracticeStore;

  const mockParts: Part[] = [
    { id: 'P1', name: 'Right Hand', hand: 'right', clef: 'treble' },
    { id: 'P2', name: 'Left Hand', hand: 'left', clef: 'bass' },
  ];

  // Measure 1:
  //   group@tick0:   P1 C4(60) + P1 E4(64, chord) [right hand chord]  + P2 C3(48) [left hand]
  //   group@tick480: P1 D4(62) [right hand only]
  const chordC4: Note = makeNote({
    id: 'P1-M1-N0',
    partId: 'P1',
    midiNumber: 60,
    noteIndex: 0,
    startTick: 0,
  });
  const chordE4: Note = makeNote({
    id: 'P1-M1-N1',
    partId: 'P1',
    midiNumber: 64,
    pitch: { step: 'E', octave: 4 },
    noteIndex: 1,
    startTick: 0,
    isChord: true,
  });
  const leftC3: Note = makeNote({
    id: 'P2-M1-N0',
    partId: 'P2',
    midiNumber: 48,
    pitch: { step: 'C', octave: 3 },
    noteIndex: 0,
    startTick: 0,
  });
  const rightD4: Note = makeNote({
    id: 'P1-M1-N2',
    partId: 'P1',
    midiNumber: 62,
    pitch: { step: 'D', octave: 4 },
    noteIndex: 2,
    startTick: 480,
  });

  const mockNotesMeasure1: Note[] = [chordC4, chordE4, leftC3, rightD4];

  // Measure 2: single group@tick960: P1 D5(74)
  const measure2Note: Note = makeNote({
    id: 'P1-M2-N0',
    partId: 'P1',
    midiNumber: 74,
    pitch: { step: 'D', octave: 5 },
    measureNumber: 2,
    noteIndex: 0,
    startTick: 960,
  });
  const mockNotesMeasure2: Note[] = [measure2Note];

  const mockScore: Score = {
    title: 'Test Score',
    parts: mockParts,
    measures: [
      { number: 1, startTick: 0, notes: mockNotesMeasure1 },
      { number: 2, startTick: 960, notes: mockNotesMeasure2 },
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
      expectedNotes: [chordC4, chordE4, leftC3], // group@tick0
      pressedKeys: new Set(),
      incorrectKeys: new Set(),
      loopEnabled: false,
      loopStart: 1,
      loopEnd: 2,
      stats: {
        totalNotes: 0,
        correctNotes: 0,
        incorrectNotes: 0,
        accuracy: 0,
        consecutiveCorrect: 0,
      },
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
      // playback slice mock (REQ-010-007: 再生中はMIDI判定を停止する)
      playbackState: 'stopped',
      setPlaybackState: (playbackState) => {
        mockStore.playbackState = playbackState;
      },
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
    mockStore.expectedNotes = [rightD4];
    mockStore.currentMeasure = 1;
    mockStore.currentNoteIndex = 1; // group@tick480 (single note)

    const judgement = engine.handleNoteOn({
      midiNumber: 62,
      velocity: 100,
      type: 'note-on',
      timestamp: 0,
    });

    expect(judgement.result).toBe('correct');
    expect(judgement.advanced).toBe(true);
    // measure1 only has 2 groups (index 0, 1); advancing past the last one moves to measure2 group0
    expect(mockStore.currentMeasure).toBe(2);
    expect(mockStore.currentNoteIndex).toBe(0);
    expect(mockStore.stats.correctNotes).toBe(1);
    expect(mockStore.stats.consecutiveCorrect).toBe(1);
  });

  it('誤った音符を押すとwaitモードで位置が進まない', () => {
    mockStore.expectedNotes = [rightD4];
    mockStore.currentMeasure = 1;
    mockStore.currentNoteIndex = 1;
    mockStore.errorMode = 'wait';

    const judgement = engine.handleNoteOn({
      midiNumber: 61,
      velocity: 100,
      type: 'note-on',
      timestamp: 0,
    });

    expect(judgement.result).toBe('incorrect');
    expect(judgement.advanced).toBe(false);
    expect(mockStore.currentMeasure).toBe(1);
    expect(mockStore.currentNoteIndex).toBe(1); // Did not advance
    expect(mockStore.stats.incorrectNotes).toBe(1);
  });

  it('連続正解数(consecutiveCorrect)は正解のたびに加算され、不正解でリセットされる（US-004）', () => {
    // group@tick0 (default mockStore.expectedNotes = [chordC4, chordE4, leftC3])
    engine.handleNoteOn({ midiNumber: 60, velocity: 100, type: 'note-on', timestamp: 0 }); // C4 (right)
    engine.handleNoteOn({ midiNumber: 64, velocity: 100, type: 'note-on', timestamp: 0 }); // E4 (right)
    const judgement = engine.handleNoteOn({
      midiNumber: 48, // C3 (left) - completes the chord and advances
      velocity: 100,
      type: 'note-on',
      timestamp: 0,
    });

    expect(judgement.advanced).toBe(true);
    expect(mockStore.stats.consecutiveCorrect).toBe(1);

    // Now expecting rightD4 (62) at group@tick480; press a wrong note.
    engine.handleNoteOn({ midiNumber: 61, velocity: 100, type: 'note-on', timestamp: 0 });
    expect(mockStore.stats.consecutiveCorrect).toBe(0);
  });

  it('単一パートの和音は全音符が揃ったら正解になる（回帰なし）', () => {
    mockStore.expectedNotes = [chordC4, chordE4]; // right-hand-only chord, C4(60) + E4(64)

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
    mockStore.expectedNotes = [chordC4, chordE4]; // C4 (60), E4 (64)
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

  it('両手同時和音（右手2音＋左手1音）は全3音揃うまで進行しない', () => {
    mockStore.expectedNotes = [chordC4, chordE4, leftC3]; // group@tick0, both mode

    let judgement = engine.handleNoteOn({
      midiNumber: 60, // C4 (right)
      velocity: 100,
      type: 'note-on',
      timestamp: 0,
    });
    expect(judgement.result).toBe('correct');
    expect(judgement.advanced).toBe(false);

    judgement = engine.handleNoteOn({
      midiNumber: 64, // E4 (right)
      velocity: 100,
      type: 'note-on',
      timestamp: 0,
    });
    expect(judgement.result).toBe('correct');
    expect(judgement.advanced).toBe(false); // Left hand note still missing

    judgement = engine.handleNoteOn({
      midiNumber: 48, // C3 (left)
      velocity: 100,
      type: 'note-on',
      timestamp: 0,
    });
    expect(judgement.result).toBe('correct');
    expect(judgement.advanced).toBe(true); // All 3 notes across both hands now pressed
  });

  it('Bothモードで両手同時和音が揃った瞬間に次グループへ進行する', () => {
    mockStore.expectedNotes = [chordC4, chordE4, leftC3];

    engine.handleNoteOn({ midiNumber: 60, velocity: 100, type: 'note-on', timestamp: 0 });
    engine.handleNoteOn({ midiNumber: 64, velocity: 100, type: 'note-on', timestamp: 0 });
    const judgement = engine.handleNoteOn({
      midiNumber: 48,
      velocity: 100,
      type: 'note-on',
      timestamp: 0,
    });

    expect(judgement.advanced).toBe(true);
    expect(mockStore.currentMeasure).toBe(1);
    expect(mockStore.currentNoteIndex).toBe(1); // group@tick480 (rightD4)
    // updateExpectedNotes() should have refreshed expectedNotes to the raw next group
    expect(mockStore.expectedNotes).toEqual([rightD4]);
  });

  it('Rightモードで両手同時グループのうち右手音のみ判定され、左手音は無視される', () => {
    mockStore.practiceMode = 'right';
    mockStore.currentMeasure = 1;
    mockStore.currentNoteIndex = 0;
    // expectedNotes holds the raw (unfiltered) group, per data-model-v2 design
    mockStore.expectedNotes = [chordC4, chordE4, leftC3];

    let judgement = engine.handleNoteOn({
      midiNumber: 60, // C4 (right)
      velocity: 100,
      type: 'note-on',
      timestamp: 0,
    });
    expect(judgement.result).toBe('correct');
    expect(judgement.advanced).toBe(false);

    judgement = engine.handleNoteOn({
      midiNumber: 64, // E4 (right) - completes the right-hand-filtered group
      velocity: 100,
      type: 'note-on',
      timestamp: 0,
    });
    expect(judgement.result).toBe('correct');
    expect(judgement.advanced).toBe(true); // Left hand note (C3) was never required
    expect(mockStore.currentMeasure).toBe(1);
    expect(mockStore.currentNoteIndex).toBe(1);
  });

  it('右手モードでは左手パートのみの判定グループが自動的にスキップされる', () => {
    // A measure with 3 distinct-time groups: right-only, left-only, right-only.
    const rOnly1 = makeNote({ id: 'P1-M1-N0', partId: 'P1', midiNumber: 60, startTick: 0 });
    const lOnly = makeNote({ id: 'P2-M1-N0', partId: 'P2', midiNumber: 48, startTick: 480 });
    const rOnly2 = makeNote({ id: 'P1-M1-N1', partId: 'P1', midiNumber: 62, startTick: 960 });

    const scoreWithSkippableGroup: Score = {
      ...mockScore,
      measures: [{ number: 1, startTick: 0, notes: [rOnly1, lOnly, rOnly2] }],
    };

    mockStore.score = scoreWithSkippableGroup;
    mockStore.practiceMode = 'right';
    mockStore.currentMeasure = 1;
    mockStore.currentNoteIndex = 0;
    mockStore.expectedNotes = [rOnly1];

    const judgement = engine.handleNoteOn({
      midiNumber: 60,
      velocity: 100,
      type: 'note-on',
      timestamp: 0,
    });

    expect(judgement.result).toBe('correct');
    expect(judgement.advanced).toBe(true);
    // The left-only group (index 1) must be skipped automatically; position lands on index 2
    expect(mockStore.currentMeasure).toBe(1);
    expect(mockStore.currentNoteIndex).toBe(2);
    expect(mockStore.expectedNotes).toEqual([rOnly2]);
  });

  it('フィルタでグループが空になった場合にresetToMeasureで自動的に非空グループへ進む', () => {
    const lOnly = makeNote({ id: 'P2-M1-N0', partId: 'P2', midiNumber: 48, startTick: 0 });
    const rOnly = makeNote({ id: 'P1-M1-N0', partId: 'P1', midiNumber: 60, startTick: 480 });

    const scoreLeftFirst: Score = {
      ...mockScore,
      measures: [{ number: 1, startTick: 0, notes: [lOnly, rOnly] }],
    };

    mockStore.score = scoreLeftFirst;
    mockStore.practiceMode = 'right';

    engine.resetToMeasure(1);

    expect(mockStore.currentMeasure).toBe(1);
    expect(mockStore.currentNoteIndex).toBe(1); // skipped the left-only group@tick0
    expect(mockStore.expectedNotes).toEqual([rOnly]);
  });

  it('ループ終端で先頭に戻り、部分押下状態が破棄される', () => {
    mockStore.expectedNotes = [measure2Note];
    mockStore.currentMeasure = 2;
    mockStore.currentNoteIndex = 0; // only group of measure 2 (last measure)
    mockStore.loopEnabled = true;
    mockStore.loopStart = 1;
    mockStore.loopEnd = 2;
    mockStore.incorrectKeys = new Set([99]); // stale incorrect key from before the loop wrap

    engine.handleNoteOn({ midiNumber: 74, velocity: 100, type: 'note-on', timestamp: 0 });

    expect(mockStore.currentMeasure).toBe(1); // looped back to 1
    expect(mockStore.currentNoteIndex).toBe(0);
    expect(mockStore.incorrectKeys.has(99)).toBe(false); // discarded on loop boundary
    expect(mockStore.expectedNotes).toEqual([chordC4, chordE4, leftC3]);
  });

  it('曲の再生中（playbackState=playing）はMIDI入力を判定せずignoredを返す（REQ-010-007）', () => {
    mockStore.playbackState = 'playing';
    mockStore.expectedNotes = [chordC4, chordE4, leftC3];
    const pressedKeysBefore = new Set(mockStore.pressedKeys);
    const statsBefore = { ...mockStore.stats };

    const judgement = engine.handleNoteOn({
      midiNumber: 60,
      velocity: 100,
      type: 'note-on',
      timestamp: 0,
    });

    expect(judgement).toEqual({ result: 'ignored', note: null, advanced: false });
    // No side effects: position/pressedKeys/stats are left untouched.
    expect(mockStore.currentMeasure).toBe(1);
    expect(mockStore.currentNoteIndex).toBe(0);
    expect(mockStore.pressedKeys).toEqual(pressedKeysBefore);
    expect(mockStore.stats).toEqual(statsBefore);
  });

  it('再生停止/一時停止後（playbackState!==playing）はMIDI判定が再開される', () => {
    mockStore.playbackState = 'paused';
    mockStore.expectedNotes = [chordC4, chordE4, leftC3];

    engine.handleNoteOn({ midiNumber: 60, velocity: 100, type: 'note-on', timestamp: 0 });
    const judgement = engine.handleNoteOn({
      midiNumber: 64,
      velocity: 100,
      type: 'note-on',
      timestamp: 0,
    });

    expect(judgement.result).toBe('correct');
  });

  it('advanceToPlaybackPosition()は指定した小節・グループへ位置とexpectedNotesを更新する（REQ-010-005）', () => {
    engine.advanceToPlaybackPosition(2, 0);

    expect(mockStore.currentMeasure).toBe(2);
    expect(mockStore.currentNoteIndex).toBe(0);
    expect(mockStore.expectedNotes).toEqual([measure2Note]);
  });

  describe('resetToPosition (TASK-051, 音単位カーソル移動)', () => {
    it('指定した小節・判定グループindexへ直接移動する（小節頭への丸めなし）', () => {
      engine.resetToPosition(1, 1); // group@tick480 (rightD4) within measure1

      expect(mockStore.currentMeasure).toBe(1);
      expect(mockStore.currentNoteIndex).toBe(1);
      expect(mockStore.expectedNotes).toEqual([rightD4]);
    });

    it('resetToMeasureと同様に、練習モードフィルタで空になったグループは自動的にスキップする', () => {
      const lOnly = makeNote({ id: 'P2-M1-N0', partId: 'P2', midiNumber: 48, startTick: 0 });
      const rOnly = makeNote({ id: 'P1-M1-N0', partId: 'P1', midiNumber: 60, startTick: 480 });

      mockStore.score = {
        ...mockScore,
        measures: [{ number: 1, startTick: 0, notes: [lOnly, rOnly] }],
      };
      mockStore.practiceMode = 'right';

      engine.resetToPosition(1, 0); // pointing at the left-only group@tick0

      expect(mockStore.currentMeasure).toBe(1);
      expect(mockStore.currentNoteIndex).toBe(1); // skipped to the right-only group
      expect(mockStore.expectedNotes).toEqual([rOnly]);
    });

    it('移動時に押鍵状態（pressedKeys/incorrectKeys）をリセットする', () => {
      mockStore.pressedKeys = new Set([60]);
      mockStore.incorrectKeys = new Set([61]);

      engine.resetToPosition(1, 1);

      expect(mockStore.pressedKeys.size).toBe(0);
      expect(mockStore.incorrectKeys.size).toBe(0);
    });

    it('スコア未読み込み時は指定位置をそのまま設定する', () => {
      mockStore.score = null;

      engine.resetToPosition(3, 2);

      expect(mockStore.currentMeasure).toBe(3);
      expect(mockStore.currentNoteIndex).toBe(2);
      expect(mockStore.expectedNotes).toEqual([]);
    });
  });

  describe('getCurrentPositionTick (TASK-051, カーソル位置から再生)', () => {
    it('現在の判定グループのstartTickを返す', () => {
      mockStore.currentMeasure = 1;
      mockStore.currentNoteIndex = 1; // group@tick480

      expect(engine.getCurrentPositionTick()).toBe(480);
    });

    it('小節先頭のグループ（tick0）ではその小節のstartTickを返す', () => {
      mockStore.currentMeasure = 1;
      mockStore.currentNoteIndex = 0; // group@tick0

      expect(engine.getCurrentPositionTick()).toBe(0);
    });

    it('スコア未読み込み時はnullを返す', () => {
      mockStore.score = null;

      expect(engine.getCurrentPositionTick()).toBeNull();
    });

    it('現在の小節がスコアに存在しない場合はnullを返す', () => {
      mockStore.currentMeasure = 999;

      expect(engine.getCurrentPositionTick()).toBeNull();
    });
  });

  it('passモードでは誤りでもグループ単位で次に進む', () => {
    mockStore.expectedNotes = [rightD4];
    mockStore.currentMeasure = 1;
    mockStore.currentNoteIndex = 1;
    mockStore.errorMode = 'pass';

    const judgement = engine.handleNoteOn({
      midiNumber: 61,
      velocity: 100,
      type: 'note-on',
      timestamp: 0,
    });

    expect(judgement.result).toBe('incorrect');
    expect(judgement.advanced).toBe(true); // Advanced despite incorrect
    expect(mockStore.currentMeasure).toBe(2);
    expect(mockStore.currentNoteIndex).toBe(0);
  });
});
