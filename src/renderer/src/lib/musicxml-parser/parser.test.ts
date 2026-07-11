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

describe('MusicXML Parser - 入力堅牢化（TASK-091）', () => {
  const CONTAINER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<container>
  <rootfiles>
    <rootfile full-path="score.xml" media-type="application/vnd.recordare.musicxml+xml"/>
  </rootfiles>
</container>`;

  const VALID_XML = `<?xml version="1.0"?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1"><measure number="1"><note><rest/><duration>4</duration></note></measure></part>
</score-partwise>`;

  it('上限文字数を超えるXMLを拒否する', () => {
    // MAX_XML_LENGTH（30,000,000文字）を超える入力はメモリ枯渇DoS対策で拒否する。
    const huge = '<score-partwise>' + 'a'.repeat(30_000_001) + '</score-partwise>';
    expect(() => parse(huge)).toThrow(MusicXMLParseError);
  });

  it('外部DTD参照のみのDOCTYPE宣言は許可する（実在のMusicXMLとの互換性維持、非回帰）', () => {
    // 主要な採譜ソフト（MuseScore・Finale・Sibelius）が出力するMusicXMLは、
    // E2Eフィクスチャと同様に外部DTD参照のみのDOCTYPEを持つのが通例である。
    // これを一律拒否すると実在する正常なMusicXMLを開けなくなる。
    // 外部DTDは両パーサとも取得しない（XXE不成立）ため、内部サブセットを
    // 伴わないDOCTYPEにリスクはなく、拒否対象から除外する。
    const withDoctype = `<?xml version="1.0"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise>
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1"><measure number="1"><note><rest/><duration>4</duration></note></measure></part>
</score-partwise>`;
    const score = parse(withDoctype);
    expect(score.parts[0].id).toBe('P1');
  });

  it('内部エンティティ展開（billion laughs）を内部サブセット付きDOCTYPE拒否で遮断する', () => {
    const bomb = `<?xml version="1.0"?>
<!DOCTYPE lolz [
  <!ENTITY lol "lol">
  <!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;">
]>
<score-partwise>&lol2;</score-partwise>`;
    expect(() => parse(bomb)).toThrow(MusicXMLParseError);
  });

  it('予約実体参照（&amp; 等）は従来どおり復号する（processEntities維持の回帰確認）', () => {
    // processEntitiesを既定（true）で維持するため、曲名・歌詞の予約実体参照は
    // 正しく復号される。実体展開DoSは内部サブセット付きDOCTYPE拒否で防いでおり、
    // processEntitiesを無効化しないことで表示の正しさを保つ。
    const xml = `<?xml version="1.0"?>
<score-partwise>
  <work><work-title>Rock &amp; Roll &lt;live&gt;</work-title></work>
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1"><measure number="1"><note><rest/><duration>4</duration></note></measure></part>
</score-partwise>`;
    const score = parse(xml);
    expect(score.title).toBe('Rock & Roll <live>');
  });

  it('展開後サイズが上限を超える.mxlを拒否する（zip爆弾対策）', () => {
    // 高圧縮率のダミーエントリ（ゼロ埋め51MB）を含むzipを合成する。
    // fflateのunzipSyncはfilterコールバックで宣言サイズ（originalSize）を
    // 実際の展開前に検査する。合計がMAX_UNZIPPED_BYTES（50MB）を超えるため、
    // 展開バッファを確保する前に拒否される。
    const bomb = new Uint8Array(51 * 1024 * 1024);
    const zipped = zipSync({
      'META-INF/container.xml': new TextEncoder().encode(CONTAINER_XML),
      'score.xml': new TextEncoder().encode(VALID_XML),
      'bomb.bin': bomb,
    });
    expect(() => parseMxl(zipped.buffer)).toThrow(MusicXMLParseError);
  });

  it('エントリ数が上限（1000件）を超える.mxlを拒否する', () => {
    // 極小エントリを大量に積んだZIPによるセントラルディレクトリ走査コスト増大を
    // 防ぐ、MAX_ZIP_ENTRIES上限のテスト。
    const files: Record<string, Uint8Array> = {
      'META-INF/container.xml': new TextEncoder().encode(CONTAINER_XML),
      'score.xml': new TextEncoder().encode(VALID_XML),
    };
    for (let i = 0; i < 1001; i++) {
      files[`junk/${i}.txt`] = new TextEncoder().encode('x');
    }
    const zipped = zipSync(files);
    expect(() => parseMxl(zipped.buffer)).toThrow(MusicXMLParseError);
  });

  it('上限内の正常な.mxlは従来どおりパースできる', () => {
    const zipped = zipSync({
      'META-INF/container.xml': new TextEncoder().encode(CONTAINER_XML),
      'score.xml': new TextEncoder().encode(VALID_XML),
    });
    const score = parseMxl(zipped.buffer);
    expect(score.parts[0].id).toBe('P1');
  });
});

describe('MusicXML Parser - v2 tick/time model (TASK-031)', () => {
  it('Scoreにticksperquarter=480とtempoMapが付与される', () => {
    const xml = `<?xml version="1.0"?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration></note>
    </measure>
  </part>
</score-partwise>`;
    const score = parse(xml);
    expect(score.ticksPerQuarter).toBe(480);
    expect(score.tempoMap.length).toBeGreaterThanOrEqual(1);
    expect(score.tempoMap[0]).toEqual({ tick: 0, bpm: 120 });
  });

  it('単一パート・単一声部の四分音符4つでstartTickが累積される（divisions=1, PPQ=480）', () => {
    const xml = `<?xml version="1.0"?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration></note>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration></note>
    </measure>
  </part>
</score-partwise>`;
    const score = parse(xml);
    const notes = score.measures[0].notes;
    expect(notes.map((n) => n.startTick)).toEqual([0, 480, 960, 1440]);
    expect(notes.map((n) => n.durationTicks)).toEqual([480, 480, 480, 480]);
    // duration（四分音符=1.0）は durationTicks / ticksPerQuarter に等しい
    expect(notes.map((n) => n.duration)).toEqual([1, 1, 1, 1]);
  });

  it('<chord>を持つ音符は直前音符と同一startTickになり、cursorを進めない', () => {
    const xml = `<?xml version="1.0"?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>
      <note><chord/><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration></note>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration></note>
    </measure>
  </part>
</score-partwise>`;
    const score = parse(xml);
    const notes = score.measures[0].notes;
    const c4 = notes.find((n) => n.pitch.step === 'C')!;
    const e4 = notes.find((n) => n.pitch.step === 'E')!;
    const g4 = notes.find((n) => n.pitch.step === 'G')!;

    expect(c4.startTick).toBe(0);
    expect(e4.startTick).toBe(0);
    expect(e4.isChord).toBe(true);
    expect(g4.startTick).toBe(480); // chordはcursorを進めないのでG4はC4の直後から始まる
  });

  it('<backup>使用後の音符は巻き戻り後のtickから計算される（同一小節内の多声部）', () => {
    const xml = `<?xml version="1.0"?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice></note>
      <backup><duration>2</duration></backup>
      <note><pitch><step>G</step><octave>3</octave></pitch><duration>2</duration><voice>2</voice></note>
    </measure>
  </part>
</score-partwise>`;
    const score = parse(xml);
    const notes = score.measures[0].notes;
    const c4 = notes.find((n) => n.pitch.step === 'C')!;
    const g3 = notes.find((n) => n.pitch.step === 'G')!;

    expect(c4.startTick).toBe(0);
    expect(c4.voice).toBe(1);
    expect(g3.startTick).toBe(0); // backupで巻き戻ったため C4 と同じ tick から開始
    expect(g3.voice).toBe(2);
  });

  it('2パート曲でnoteIdがパート毎連番になる（パート横断連番にならない）', () => {
    const xml = `<?xml version="1.0"?>
<score-partwise>
  <part-list>
    <score-part id="P1"><part-name>Piano Right</part-name></score-part>
    <score-part id="P2"><part-name>Piano Left</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration></note>
    </measure>
  </part>
  <part id="P2">
    <measure number="1">
      <attributes><divisions>1</divisions></attributes>
      <note><pitch><step>C</step><octave>2</octave></pitch><duration>1</duration></note>
      <note><pitch><step>D</step><octave>2</octave></pitch><duration>1</duration></note>
    </measure>
  </part>
</score-partwise>`;
    const score = parse(xml);
    const notes = score.measures[0].notes;
    const p1Notes = notes
      .filter((n) => n.partId === 'P1')
      .sort((a, b) => a.noteIndex - b.noteIndex);
    const p2Notes = notes
      .filter((n) => n.partId === 'P2')
      .sort((a, b) => a.noteIndex - b.noteIndex);

    expect(p1Notes.map((n) => n.id)).toEqual(['P1-M1-N0', 'P1-M1-N1']);
    expect(p2Notes.map((n) => n.id)).toEqual(['P2-M1-N0', 'P2-M1-N1']);
  });

  it('Measure.notesはstartTick昇順（同tickはpartId→noteIndex順）でソートされる（設計書の机上検証例）', () => {
    // divisions=2, 4/4, 右手P1: C4(duration1)→E4(duration1)+G4(chord)、左手P2: C2(duration2)
    const xml = `<?xml version="1.0"?>
<score-partwise>
  <part-list>
    <score-part id="P1"><part-name>Piano Right</part-name></score-part>
    <score-part id="P2"><part-name>Piano Left</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>2</divisions>
        <time><beats>4</beats><beat-type>4</beat-type></time>
      </attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration></note>
      <note><chord/><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration></note>
    </measure>
  </part>
  <part id="P2">
    <measure number="1">
      <attributes><divisions>2</divisions></attributes>
      <note><pitch><step>C</step><octave>2</octave></pitch><duration>2</duration></note>
    </measure>
  </part>
</score-partwise>`;
    const score = parse(xml);
    const notes = score.measures[0].notes;

    expect(notes.map((n) => `${n.partId}:${n.pitch.step}${n.pitch.octave}@${n.startTick}`)).toEqual(
      ['P1:C4@0', 'P2:C2@0', 'P1:E4@240', 'P1:G4@240']
    );

    const c4 = notes.find((n) => n.partId === 'P1' && n.pitch.step === 'C')!;
    const e4 = notes.find((n) => n.partId === 'P1' && n.pitch.step === 'E')!;
    const g4 = notes.find((n) => n.partId === 'P1' && n.pitch.step === 'G')!;
    const c2 = notes.find((n) => n.partId === 'P2')!;

    expect(c4.durationTicks).toBe(240);
    expect(e4.durationTicks).toBe(240);
    expect(c2.durationTicks).toBe(480);
  });

  it('テンポ変化（sound tempo）をまたぐ場合にstartSeconds/durationSecondsが正しく累積される', () => {
    const xml = `<?xml version="1.0"?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration></note>
    </measure>
    <measure number="2">
      <direction><sound tempo="60"/></direction>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration></note>
    </measure>
  </part>
</score-partwise>`;
    const score = parse(xml);
    expect(score.tempo).toBe(120); // 曲頭は既定テンポ（明示的なsound tempoなし）
    expect(score.tempoMap.map((t) => t.tick)).toEqual([0, 1920]);

    const m1Note = score.measures[0].notes[0];
    const m2Note = score.measures[1].notes[0];

    expect(m1Note.startSeconds).toBeCloseTo(0, 5);
    expect(m1Note.durationSeconds).toBeCloseTo(2.0, 5); // 4分音符4つ=1920tick, 120bpmで2秒
    expect(m2Note.startSeconds).toBeCloseTo(2.0, 5);
    expect(m2Note.durationSeconds).toBeCloseTo(4.0, 5); // 60bpmでは同じtick数が倍の時間になる
  });

  it('休符もtickを消費するが判定対象外として扱われる（型上の確認）', () => {
    const xml = `<?xml version="1.0"?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions></attributes>
      <note><rest/><duration>2</duration></note>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>
    </measure>
  </part>
</score-partwise>`;
    const score = parse(xml);
    const notes = score.measures[0].notes;
    const rest = notes.find((n) => n.isRest)!;
    const c4 = notes.find((n) => !n.isRest)!;

    expect(rest.startTick).toBe(0);
    expect(rest.durationTicks).toBe(960);
    expect(c4.startTick).toBe(960); // 休符の分だけcursorが進んでいる
  });
});

describe('MusicXML Parser - divisionsが480の約数でない場合のtick丸め（CodeRabbit指摘）', () => {
  it('divisions=7（480の約数でない）では、音価の合計が同じ2パートのstartTickが浮動小数点誤差で食い違う（丸めなしの回帰再現）', () => {
    // P1: duration [1,1,1,1,3] (合計7=四分音符1つ分)。
    // P2: duration [3,1,1,1,1] (同じ合計7を逆順に並べただけ)。
    // 両者は数学的に全く同じ時刻（合計7/divisions=1拍分）に到達するはずである。
    // しかしtickをMath.roundで整数化せず浮動小数のまま加算すると、加算順序の違いにより
    // 480/7の丸め誤差が異なる形で蓄積する。
    // その結果、最終的なcheckpoint音符のstartTickが1ULP未満の差でずれてしまい、
    // 本来"同時"のはずの2音が===で一致しなくなる。
    const xml = `<?xml version="1.0"?>
<score-partwise>
  <part-list>
    <score-part id="P1"><part-name>Piano Right</part-name></score-part>
    <score-part id="P2"><part-name>Piano Left</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>7</divisions></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration></note>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration></note>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>3</duration></note>
      <note><pitch><step>A</step><octave>4</octave></pitch><duration>1</duration></note>
    </measure>
  </part>
  <part id="P2">
    <measure number="1">
      <attributes><divisions>7</divisions></attributes>
      <note><pitch><step>C</step><octave>3</octave></pitch><duration>3</duration></note>
      <note><pitch><step>D</step><octave>3</octave></pitch><duration>1</duration></note>
      <note><pitch><step>E</step><octave>3</octave></pitch><duration>1</duration></note>
      <note><pitch><step>F</step><octave>3</octave></pitch><duration>1</duration></note>
      <note><pitch><step>G</step><octave>3</octave></pitch><duration>1</duration></note>
      <note><pitch><step>A</step><octave>3</octave></pitch><duration>1</duration></note>
    </measure>
  </part>
</score-partwise>`;
    const score = parse(xml);
    const notes = score.measures[0].notes;

    const checkpointP1 = notes.find((n) => n.partId === 'P1' && n.pitch.step === 'A')!;
    const checkpointP2 = notes.find((n) => n.partId === 'P2' && n.pitch.step === 'A')!;

    // 両パートとも「小節頭から合計7/7拍(=四分音符1つ)進んだ位置」のはずなので、
    // startTickは完全に一致しなければならない(同時判定=完全一致で用いられるため)。
    expect(checkpointP1.startTick).toBe(checkpointP2.startTick);
    // tickは整数(PPQ=480の格子上)に丸められていること。
    expect(Number.isInteger(checkpointP1.startTick)).toBe(true);
    expect(Number.isInteger(checkpointP2.startTick)).toBe(true);
  });

  it('divisions=7でbackup/forwardを挟んでも、durationTicksとstartTickは整数(PPQ格子上)になる', () => {
    const xml = `<?xml version="1.0"?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>7</divisions></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>5</duration><voice>1</voice></note>
      <backup><duration>5</duration></backup>
      <note><pitch><step>C</step><octave>3</octave></pitch><duration>3</duration><voice>2</voice></note>
      <forward><duration>2</duration></forward>
      <note><pitch><step>D</step><octave>3</octave></pitch><duration>1</duration><voice>2</voice></note>
    </measure>
  </part>
</score-partwise>`;
    const score = parse(xml);
    const notes = score.measures[0].notes;

    for (const note of notes) {
      expect(Number.isInteger(note.startTick)).toBe(true);
      expect(Number.isInteger(note.durationTicks)).toBe(true);
    }

    // voice1の音符(C4)は小節頭(0)から開始。backupで巻き戻した後のvoice2先頭(C3)も
    // 同じく小節頭(0)から開始するはずである。
    const c4 = notes.find((n) => n.pitch.step === 'C' && n.pitch.octave === 4)!;
    const c3 = notes.find((n) => n.pitch.step === 'C' && n.pitch.octave === 3)!;
    expect(c4.startTick).toBe(0);
    expect(c3.startTick).toBe(0);
  });
});

describe('MusicXML Parser - 2段譜のNote.staff/hand（TASK-048）', () => {
  it('1パート2段譜（staves=2）で、staff1の音はhand=right、staff2の音はhand=leftになる（和音・backup含む）', () => {
    const xml = `<?xml version="1.0"?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <staves>2</staves>
        <clef number="1"><sign>G</sign><line>2</line></clef>
        <clef number="2"><sign>F</sign><line>4</line></clef>
      </attributes>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>1</duration><voice>1</voice><staff>1</staff>
      </note>
      <note>
        <chord/><pitch><step>E</step><octave>4</octave></pitch>
        <duration>1</duration><voice>1</voice><staff>1</staff>
      </note>
      <backup><duration>1</duration></backup>
      <note>
        <pitch><step>C</step><octave>2</octave></pitch>
        <duration>1</duration><voice>2</voice><staff>2</staff>
      </note>
    </measure>
  </part>
</score-partwise>`;
    const score = parse(xml);
    const notes = score.measures[0].notes;

    const c4 = notes.find((n) => n.pitch.step === 'C' && n.pitch.octave === 4)!;
    const e4 = notes.find((n) => n.pitch.step === 'E')!;
    const c2 = notes.find((n) => n.pitch.octave === 2)!;

    expect(c4.staff).toBe(1);
    expect(c4.hand).toBe('right');
    expect(e4.staff).toBe(1);
    expect(e4.hand).toBe('right');
    expect(c2.staff).toBe(2);
    expect(c2.hand).toBe('left');

    // 単一パート内でも両手同時（同一startTick）としてグループ化されること（tick計算は不変）
    expect(c4.startTick).toBe(0);
    expect(c2.startTick).toBe(0);
  });

  it('<staff>未指定または単一staffのパートでは、従来通りPart.handがNoteに継承される（既存2パート譜の回帰確認）', () => {
    const xml = `<?xml version="1.0"?>
<score-partwise>
  <part-list>
    <score-part id="P1"><part-name>Piano Right</part-name></score-part>
    <score-part id="P2"><part-name>Piano Left</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>
    </measure>
  </part>
  <part id="P2">
    <measure number="1">
      <attributes><divisions>1</divisions></attributes>
      <note><pitch><step>C</step><octave>2</octave></pitch><duration>1</duration></note>
    </measure>
  </part>
</score-partwise>`;
    const score = parse(xml);
    const notes = score.measures[0].notes;
    const p1Note = notes.find((n) => n.partId === 'P1')!;
    const p2Note = notes.find((n) => n.partId === 'P2')!;

    expect(score.parts.find((p) => p.id === 'P1')!.hand).toBe('right');
    expect(score.parts.find((p) => p.id === 'P2')!.hand).toBe('left');
    expect(p1Note.staff).toBe(1);
    expect(p1Note.hand).toBe('right'); // Part.hand継承
    expect(p2Note.staff).toBe(1);
    expect(p2Note.hand).toBe('left'); // Part.hand継承
  });

  it('単一staffのパートで<staff>1が明示されていてもPart.handを継承する（staves未指定=1扱い）', () => {
    const xml = `<?xml version="1.0"?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>Bass</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><clef><sign>F</sign></clef></attributes>
      <note><pitch><step>C</step><octave>3</octave></pitch><duration>4</duration><staff>1</staff></note>
    </measure>
  </part>
</score-partwise>`;
    const score = parse(xml);
    const note = score.measures[0].notes[0];
    expect(score.parts[0].hand).toBe('left');
    expect(note.hand).toBe('left');
  });
});

describe('MusicXML Parser - ペダル記号のパース（TASK-069）', () => {
  it('ペダル記号がない楽曲ではpedalSpansが空配列になる', () => {
    const xml = `<?xml version="1.0"?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration></note>
    </measure>
  </part>
</score-partwise>`;
    const score = parse(xml);
    expect(score.pedalSpans).toEqual([]);
  });

  it('start/stopペアで1区間が生成される', () => {
    const xml = `<?xml version="1.0"?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions></attributes>
      <direction><direction-type><pedal type="start"/></direction-type></direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration></note>
      <direction><direction-type><pedal type="stop"/></direction-type></direction>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>2</duration></note>
    </measure>
  </part>
</score-partwise>`;
    const score = parse(xml);
    // divisions=1, PPQ=480 → duration2 = 960tick
    expect(score.pedalSpans).toEqual([{ startTick: 0, endTick: 960 }]);
  });

  it('start/change/stopで2区間に分割され、境界tickが一致する', () => {
    const xml = `<?xml version="1.0"?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions></attributes>
      <direction><direction-type><pedal type="start"/></direction-type></direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration></note>
      <direction><direction-type><pedal type="change"/></direction-type></direction>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>2</duration></note>
      <direction><direction-type><pedal type="stop"/></direction-type></direction>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration></note>
    </measure>
  </part>
</score-partwise>`;
    const score = parse(xml);
    expect(score.pedalSpans).toEqual([
      { startTick: 0, endTick: 960 },
      { startTick: 960, endTick: 1920 },
    ]);
  });

  it('stopがないまま曲が終了する場合、最終tick（全ノートのstartTick+durationTicksの最大値）で閉じる', () => {
    const xml = `<?xml version="1.0"?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions></attributes>
      <direction><direction-type><pedal type="start"/></direction-type></direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>2</duration></note>
    </measure>
  </part>
</score-partwise>`;
    const score = parse(xml);
    // 最終ノート(D4) startTick=960, durationTicks=960 → 最終tick=1920
    expect(score.pedalSpans).toEqual([{ startTick: 0, endTick: 1920 }]);
  });

  it('既存フィクスチャ（SIMPLE_XML相当）のパース結果はpedalSpans追加以外は不変（非回帰）', () => {
    const xml = `<?xml version="1.0"?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>Piano Right</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration></note>
    </measure>
  </part>
</score-partwise>`;
    const score = parse(xml);
    expect(score.measures[0].notes[0].midiNumber).toBe(60);
    expect(score.parts[0].hand).toBe('right');
    expect(score.pedalSpans).toEqual([]);
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
