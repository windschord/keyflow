import { describe, it, expect } from 'vitest';
import { parse, parseMxl, MusicXMLParseError } from './parser';
import { detectHand } from './hand-detector';
import { toMidiNumber } from './midi-utils';
import { zipSync } from 'fflate';

describe('MusicXML Parser', () => {
  const SIMPLE_XML = `<?xml version="1.0"?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>Piano Right</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration></note>
    </measure>
  </part>
</score-partwise>`;

  const REST_XML = `<?xml version="1.0"?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>Bass</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <note><rest/><duration>4</duration></note>
    </measure>
  </part>
</score-partwise>`;

  it('parses C4 as MIDI 60', () => {
    const score = parse(SIMPLE_XML);
    expect(score.measures[0].notes[0].midiNumber).toBe(60);
    expect(score.measures[0].notes[0].pitch.step).toBe('C');
    expect(score.measures[0].notes[0].pitch.octave).toBe(4);
  });

  it('detects "Piano Right" as right hand', () => {
    const score = parse(SIMPLE_XML);
    expect(score.parts[0].hand).toBe('right');
  });

  it('throws MusicXMLParseError for invalid XML', () => {
    expect(() => parse('<invalid-xml>')).toThrow(MusicXMLParseError);
    expect(() => parse('')).toThrow(MusicXMLParseError);
  });

  it('parses rest notes correctly', () => {
    const score = parse(REST_XML);
    const note = score.measures[0].notes[0];
    expect(note.isRest).toBe(true);
    expect(note.duration).toBe(4);
  });

  it('parseMxl unzips and parses a .mxl buffer', () => {
    const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container>
  <rootfiles>
    <rootfile full-path="score.xml" media-type="application/vnd.recordare.musicxml+xml"/>
  </rootfiles>
</container>`;

    const zipped = zipSync({
      'META-INF/container.xml': new TextEncoder().encode(containerXml),
      'score.xml': new TextEncoder().encode(SIMPLE_XML),
    });

    const score = parseMxl(zipped.buffer);
    expect(score.parts[0].id).toBe('P1');
    expect(score.measures[0].notes[0].midiNumber).toBe(60);
  });

  it('parses work-title as score title', () => {
    const xml = `<?xml version="1.0"?>
<score-partwise>
  <work><work-title>Test Sonata</work-title></work>
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1"><measure number="1"><note><rest/><duration>4</duration></note></measure></part>
</score-partwise>`;
    const score = parse(xml);
    expect(score.title).toBe('Test Sonata');
  });

  it('parses time signature and key from attributes', () => {
    const xml = `<?xml version="1.0"?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <time><beats>3</beats><beat-type>4</beat-type></time>
        <key><fifths>2</fifths></key>
      </attributes>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>2</duration></note>
    </measure>
  </part>
</score-partwise>`;
    const score = parse(xml);
    expect(score.timeSignature.beats).toBe(3);
    expect(score.timeSignature.beatType).toBe(4);
    expect(score.keySignature).toBe(2);
  });

  it('parses tempo from direction/sound element', () => {
    const xml = `<?xml version="1.0"?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <direction><sound tempo="96"/></direction>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration></note>
    </measure>
  </part>
</score-partwise>`;
    const score = parse(xml);
    expect(score.tempo).toBe(96);
  });

  it('parses accidentals (alter) correctly', () => {
    const xml = `<?xml version="1.0"?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <note><pitch><step>C</step><octave>4</octave><alter>1</alter></pitch><duration>4</duration></note>
    </measure>
  </part>
</score-partwise>`;
    const score = parse(xml);
    expect(score.measures[0].notes[0].midiNumber).toBe(61);
    expect(score.measures[0].notes[0].pitch.alter).toBe(1);
  });

  it('parses chord notes', () => {
    const xml = `<?xml version="1.0"?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration></note>
      <note><chord/><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration></note>
    </measure>
  </part>
</score-partwise>`;
    const score = parse(xml);
    expect(score.measures[0].notes[1].isChord).toBe(true);
  });

  it('throws MusicXMLParseError when no score-partwise root', () => {
    expect(() => parse('<root><other/></root>')).toThrow(MusicXMLParseError);
  });

  it('parseMxl falls back to .xml file when no container.xml', () => {
    const zipped = zipSync({
      'score.xml': new TextEncoder().encode(SIMPLE_XML),
    });
    const score = parseMxl(zipped.buffer);
    expect(score.parts[0].id).toBe('P1');
  });

  it('parses part-name with print-object attribute (MuseScore format)', () => {
    const xml = `<?xml version="1.0"?>
<score-partwise>
  <part-list>
    <score-part id="P1">
      <part-name print-object="no">Piano Right</part-name>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration></note>
    </measure>
  </part>
</score-partwise>`;
    const score = parse(xml);
    expect(score.parts[0].name).toBe('Piano Right');
    expect(score.parts[0].hand).toBe('right');
  });

  it('parseMxl throws MusicXMLParseError when no xml file found', () => {
    const zipped = zipSync({
      'readme.txt': new TextEncoder().encode('no xml here'),
    });
    expect(() => parseMxl(zipped.buffer)).toThrow(MusicXMLParseError);
  });

  it('detects bass clef part as left hand', () => {
    const xml = `<?xml version="1.0"?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><clef><sign>F</sign></clef></attributes>
      <note><pitch><step>C</step><octave>3</octave></pitch><duration>4</duration></note>
    </measure>
  </part>
</score-partwise>`;
    const score = parse(xml);
    expect(score.parts[0].hand).toBe('left');
    expect(score.parts[0].clef).toBe('bass');
  });

  it('parses multiple measures', () => {
    const xml = `<?xml version="1.0"?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>Piano Right</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1"><note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration></note></measure>
    <measure number="2"><note><pitch><step>G</step><octave>4</octave></pitch><duration>4</duration></note></measure>
  </part>
</score-partwise>`;
    const score = parse(xml);
    expect(score.measures).toHaveLength(2);
    expect(score.measures[1].notes[0].midiNumber).toBe(67);
  });
});

describe('hand-detector', () => {
  it('detects right by name keywords', () => {
    expect(detectHand('Piano Right', undefined, 0)).toBe('right');
    expect(detectHand('右手', undefined, 0)).toBe('right');
    expect(detectHand('Soprano', undefined, 0)).toBe('right');
    expect(detectHand('Treble', undefined, 0)).toBe('right');
  });

  it('detects left by name keywords', () => {
    expect(detectHand('Piano Left', undefined, 0)).toBe('left');
    expect(detectHand('左手', undefined, 0)).toBe('left');
    expect(detectHand('Bass', undefined, 0)).toBe('left');
  });

  it('detects by clef sign when name is ambiguous', () => {
    expect(detectHand('Piano', 'G', 0)).toBe('right');
    expect(detectHand('Piano', 'F', 0)).toBe('left');
  });

  it('falls back to part index', () => {
    expect(detectHand(undefined, undefined, 0)).toBe('right');
    expect(detectHand(undefined, undefined, 1)).toBe('left');
  });
});

describe('midi-utils', () => {
  it('converts note names to MIDI numbers', () => {
    expect(toMidiNumber('C', 4)).toBe(60);
    expect(toMidiNumber('A', 4)).toBe(69);
    expect(toMidiNumber('C', 4, 1)).toBe(61);
    expect(toMidiNumber('B', 3)).toBe(59);
    expect(toMidiNumber('C', 0)).toBe(12);
  });
});
