# MusicXML Parser

## 概要

**目的**: MusicXMLファイルを内部の`Score`データモデルに変換する

**責務**:
- `.xml`（非圧縮）および`.mxl`（ZIP圧縮）形式のMusicXMLを読み込む
- MusicXML 3.1仕様に従ってパート・小節・音符・テンポ情報を抽出する
- 右手・左手のパート自動識別（`<part-name>`, `<clef>`から判定）
- MIDIノートナンバーの計算（ピッチ + オクターブ + alter）

**実行場所**: Renderer Process（IPC経由でMain Processからファイルを受け取る）

---

## インターフェース

### 主要メソッド

#### `parse(xmlContent: string): Score`

**パラメータ**:
| 名前 | 型 | 説明 |
|------|-----|------|
| xmlContent | string | MusicXMLの文字列コンテンツ |

**戻り値**: `Score` — 内部データモデル

**例外**:
- `MusicXMLParseError`: XML構文エラーまたはMusicXML必須要素の欠如

#### `parseMxl(buffer: ArrayBuffer): Score`
`.mxl`（ZIP圧縮）を解凍してから`parse()`に委譲する。

---

## 内部設計

### パースライブラリ
- **fast-xml-parser** v4: 高速なXMLパーサー（Electronにバンドル）

### MIDIナンバー計算

```typescript
function toMidiNumber(step: string, octave: number, alter: number = 0): number {
  const SEMITONES: Record<string, number> = {
    C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11
  };
  return 12 * (octave + 1) + SEMITONES[step] + alter;
}
// 例: C4 → 60, A4 → 69
```

### 右手/左手判定ロジック

```
1. <part-name> に "Right" / "右" / "treble" が含まれる → right
2. <part-name> に "Left" / "左" / "bass" が含まれる → left
3. <clef><sign> が "G" → right
4. <clef><sign> が "F" → left
5. 判定不能 → パートインデックス 0 = right, 1 = left
```

---

## エラー処理

| エラー種別 | 発生条件 | 対処方法 |
|-----------|---------|---------|
| MusicXMLParseError | XML構文エラー | UIエラーダイアログを表示し、前の状態を維持 |
| UnsupportedFeatureWarning | Grace notes等の未実装要素 | 警告ログを出力してスキップ |

---

## テスト観点

- [ ] 正常系: サンプルMusicXMLから全小節・音符が正しく抽出される
- [ ] 正常系: MIDIナンバーがC4=60として計算される
- [ ] 正常系: .mxlファイルが正しく展開・解析される
- [ ] 正常系: フラット/シャープ音のalterが正しく適用される
- [ ] 異常系: 壊れたXMLに対してMusicXMLParseErrorがスローされる

---

## 関連要件

- [US-001](../../requirements/stories/US-001.md) @../../requirements/stories/US-001.md: MusicXMLインポート
- [REQ-001-003〜004](../../requirements/stories/US-001.md) @../../requirements/stories/US-001.md: パート自動識別、テンポ解析
