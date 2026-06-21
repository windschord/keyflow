# TASK-005: MusicXML Parser実装（.xml / .mxl対応）

**ステータス**: TODO
**推定工数**: 60分
**依存**: TASK-004

---

## 説明

MusicXMLファイルをパースして内部の `Score` データモデルに変換するモジュールを実装する。
非圧縮（.xml）と圧縮（.mxl）の両形式に対応する。

## 対象ファイル

- `src/renderer/src/lib/musicxml-parser/index.ts` — エントリポイント・公開API
- `src/renderer/src/lib/musicxml-parser/parser.ts` — XMLパースコアロジック
- `src/renderer/src/lib/musicxml-parser/midi-utils.ts` — MIDIナンバー計算
- `src/renderer/src/lib/musicxml-parser/hand-detector.ts` — 右手/左手自動判定
- `src/renderer/src/lib/musicxml-parser/parser.test.ts` — テスト

## 依存ライブラリ（インストールが必要）

```bash
npm install fast-xml-parser fflate
```
- `fast-xml-parser`: XMLパーサー
- `fflate`: .mxl（ZIP）解凍（ブラウザ/Node両対応の軽量ZIPライブラリ）

## 参照設計

- [design/components/musicxml-parser.md](../../design/components/musicxml-parser.md)

## 実装すべきインターフェース

```typescript
// src/renderer/src/lib/musicxml-parser/index.ts
export class MusicXMLParseError extends Error {}

export function parse(xmlContent: string): Score;
export function parseMxl(buffer: ArrayBuffer): Score;
```

## 実装詳細

### MIDIナンバー計算（midi-utils.ts）
```typescript
const SEMITONES: Record<string, number> = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };
export function toMidiNumber(step: string, octave: number, alter = 0): number {
  return 12 * (octave + 1) + SEMITONES[step] + alter;
}
// C4 → 60, A4 → 69, C#4 → 61
```

### 右手/左手判定優先順位（hand-detector.ts）
1. `<part-name>` に "Right"/"右"/"Soprano"/"Treble" → `'right'`
2. `<part-name>` に "Left"/"左"/"Bass" → `'left'`
3. `<clef><sign>` が "G" → `'right'`
4. `<clef><sign>` が "F" → `'left'`
5. パートインデックス 0 → `'right'`, 1 → `'left'`

### .mxl解凍（parser.ts）
```typescript
export function parseMxl(buffer: ArrayBuffer): Score {
  const files = unzipSync(new Uint8Array(buffer));
  // rootfiles/rootfile エントリから .xml ファイルを特定
  const xmlEntry = findRootXml(files);
  const xmlText = new TextDecoder().decode(xmlEntry);
  return parse(xmlText);
}
```

## 実装手順（TDD）

1. `parser.test.ts` を作成、最小限のMusicXML文字列でテストを記述（失敗確認）
2. `midi-utils.ts` を実装 → テスト通過
3. `hand-detector.ts` を実装 → テスト通過
4. `parser.ts` のコアパース（音符抽出）を実装 → テスト通過
5. `.mxl` 解凍を追加 → テスト通過

## テストケース例

```typescript
const SIMPLE_XML = `<?xml version="1.0"?>
<score-partwise>
  <part-list><score-part id="P1"><part-name>Piano Right</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration></note>
    </measure>
  </part>
</score-partwise>`;

it('parses C4 as MIDI 60', () => {
  const score = parse(SIMPLE_XML);
  expect(score.measures[0].notes[0].midiNumber).toBe(60);
});
it('detects "Piano Right" as right hand', () => {
  const score = parse(SIMPLE_XML);
  expect(score.parts[0].hand).toBe('right');
});
```

## 受入基準

- [ ] `parse()` が有効なMusicXMLからScoreを返す
- [ ] C4のMIDIナンバーが60として計算される
- [ ] "Piano Right" パートが `hand: 'right'` として識別される
- [ ] 無効なXMLに対して `MusicXMLParseError` がスローされる
- [ ] `parseMxl()` が.mxlバッファを解凍してパースできる
- [ ] テストが5件以上ありすべてパス

**依存関係**: TASK-004
