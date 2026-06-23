import { describe, it, expect } from 'vitest';
import { parse, parseMxl, MusicXMLParseError } from './parser';
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
});
