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
  /**
   * MusicXML `<staff>`（1始まり）。未指定は1（TASK-048）。
   * 1パート2段譜（`<attributes><staves>2</staves>`）の判定に使用する。
   * オプショナルなのは、本フィールド導入前に構築された既存のテスト用Noteリテラル
   * との後方互換性を保つため（実運用のパーサー出力では常に設定される）。
   */
  staff?: number;
  /**
   * 音符単位の手（右手/左手）。TASK-048で導入。
   * - 1パート2段譜（`staves>=2`）: staff 1 = 'right'、staff 2以降 = 'left'
   * - それ以外（`<staff>`未指定/単一staffのパート）: 所属する `Part.hand` を継承する。
   * 消費側（practice-engine/keyboard-renderer/FingeringPanel/osmd-controller）は
   * 本フィールドで判定し、`Part.hand`によるパート単位判定は行わない。
   * オプショナルなのは、本フィールド導入前に構築された既存のテスト用Noteリテラル
   * との後方互換性を保つため（実運用のパーサー出力では常に設定される。未設定時は
   * 消費側で左手色/対象外にフォールバックする）。
   */
  hand?: Hand;
}
