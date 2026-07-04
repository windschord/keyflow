import { describe, it, expect, beforeEach } from 'vitest';
import { parse, MusicXMLParseError } from '../../lib/musicxml-parser/parser';
import type { Score } from '../../types';

const TWO_PART_XML = `<?xml version="1.0"?>
<score-partwise>
  <work><work-title>Integration Test Score</work-title></work>
  <part-list>
    <score-part id="P1"><part-name>Piano Right</part-name></score-part>
    <score-part id="P2"><part-name>Piano Left</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <clef><sign>G</sign></clef>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
      </attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration><chord/></note>
    </measure>
    <measure number="2">
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration></note>
    </measure>
  </part>
  <part id="P2">
    <measure number="1">
      <attributes>
        <clef><sign>F</sign></clef>
      </attributes>
      <note><rest/><duration>4</duration></note>
    </measure>
    <measure number="2">
      <note><pitch><step>G</step><octave>2</octave></pitch><duration>4</duration></note>
    </measure>
  </part>
</score-partwise>`;

describe('MusicXMLパーサー統合テスト', () => {
  let score: Score;

  beforeEach(() => {
    score = parse(TWO_PART_XML);
  });

  it('2パートのMusicXMLを正しくパースする', () => {
    expect(score.title).toBe('Integration Test Score');
    expect(score.parts).toHaveLength(2);
    expect(score.measures).toHaveLength(2);
  });

  it('パートの手の種別が正しく検出される', () => {
    const rightPart = score.parts.find((p) => p.id === 'P1');
    const leftPart = score.parts.find((p) => p.id === 'P2');

    expect(rightPart?.hand).toBe('right');
    expect(leftPart?.hand).toBe('left');
    expect(rightPart?.clef).toBe('treble');
    expect(leftPart?.clef).toBe('bass');
  });

  it('コード音符が正しくパースされる', () => {
    const measure1 = score.measures.find((m) => m.number === 1);
    const chordNotes = measure1?.notes.filter((n) => n.partId === 'P1');

    expect(chordNotes).toHaveLength(2);

    const secondNote = chordNotes?.find((n) => n.midiNumber === 64);
    expect(secondNote?.isChord).toBe(true);
  });

  it('休符が正しくパースされる', () => {
    const measure1 = score.measures.find((m) => m.number === 1);
    const restNote = measure1?.notes.find((n) => n.partId === 'P2');

    expect(restNote?.isRest).toBe(true);
    expect(restNote?.midiNumber).toBe(0);
  });

  it('音符のMIDI番号が正しく計算される', () => {
    const measure1 = score.measures.find((m) => m.number === 1);
    const c4 = measure1?.notes.find((n) => n.partId === 'P1' && !n.isChord);
    expect(c4?.midiNumber).toBe(60);

    const measure2 = score.measures.find((m) => m.number === 2);
    const g2 = measure2?.notes.find((n) => n.partId === 'P2');
    expect(g2?.midiNumber).toBe(43);
  });

  it('拍子記号とキー情報が正しくパースされる', () => {
    expect(score.timeSignature.beats).toBe(4);
    expect(score.timeSignature.beatType).toBe(4);
    expect(score.keySignature).toBe(0);
  });

  it('不正なXMLに対してMusicXMLParseErrorを投げる', () => {
    expect(() => parse('')).toThrow(MusicXMLParseError);
    expect(() => parse('<invalid>not musicxml</invalid>')).toThrow(MusicXMLParseError);
  });

  it('noteIdが正しいフォーマットで付与される', () => {
    const measure1 = score.measures.find((m) => m.number === 1);
    const firstNote = measure1?.notes[0];

    expect(firstNote?.id).toMatch(/^P\d+-M\d+-N\d+$/);
  });
});
