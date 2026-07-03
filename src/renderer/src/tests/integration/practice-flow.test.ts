import { describe, it, expect, beforeEach } from 'vitest';
import { parse } from '../../lib/musicxml-parser/parser';
import { usePracticeStore } from '../../store';
import { PracticeEngineService } from '../../lib/practice-engine';

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
    stats: { totalNotes: 0, correctNotes: 0, incorrectNotes: 0, accuracy: 0 },
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
