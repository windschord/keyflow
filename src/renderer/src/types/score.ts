export type Hand = 'right' | 'left' | 'unknown';

export interface Score {
  title: string;
  parts: Part[];
  measures: Measure[];
  tempo: number;
  /** 正規化PPQ（Pulses Per Quarter note）。定数480（DEC-005）。 */
  ticksPerQuarter: number;
  /** テンポ変化列。曲頭（tick=0）を含め最低1要素。 */
  tempoMap: TempoEvent[];
  timeSignature: { beats: number; beatType: number };
  keySignature: number;
}

export interface Part {
  id: string;
  name: string;
  hand: Hand;
  clef: 'treble' | 'bass';
}

/**
 * MusicXMLの `<sound tempo>` / metronome指示に由来するテンポ変化イベント。
 */
export interface TempoEvent {
  /** 絶対tick（曲頭=0） */
  tick: number;
  bpm: number;
}

export interface Measure {
  number: number;
  /** 小節頭の絶対tick */
  startTick: number;
  /** 全パート混在。startTick昇順（同tickはpartId→noteIndex順）でソート済み。 */
  notes: Note[];
}

/**
 * Represents a musical note.
 * id format: `{partId}-M{measureNumber}-N{noteIndex}` (e.g. `P1-M3-N0`)
 * noteIndex はパート内・小節内の `<note>` 出現順連番（0始まり、休符・和音構成音を含む）。
 */
export interface Note {
  id: string;
  partId: string;
  measureNumber: number;
  noteIndex: number;
  pitch: { step: string; octave: number; alter?: number };
  midiNumber: number;
  /** 四分音符=1.0。durationTicks / ticksPerQuarter に等しい。 */
  duration: number;
  /** 絶対tick（曲頭=0） */
  startTick: number;
  durationTicks: number;
  /** tempoMapに基づく楽譜記載テンポでの秒 */
  startSeconds: number;
  durationSeconds: number;
  /** MusicXML <voice>。既定1。 */
  voice: number;
  isChord: boolean;
  isRest: boolean;
}
