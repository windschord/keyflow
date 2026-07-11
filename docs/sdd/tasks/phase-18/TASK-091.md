# TASK-091: MusicXML/MXLパースの入力堅牢化（zip爆弾・XMLサイズ/DOCTYPE・二重パース）

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-091 |
| タイプ | fix（セキュリティ強化・DoS耐性） |
| ステータス | TODO |
| 優先度 | High |
| 見積もり | 60分 |
| 依存タスク | なし |

## 背景

### 問題の概要

2026-07-11のサプライチェーン・脆弱性調査で、`src/renderer/src/lib/musicxml-parser/parser.ts` に「悪意ある入力ファイルによるメモリ枯渇DoS」の攻撃面が判明した（XXE自体は両パーサとも成立しないことを確認済み）。

1. **A-2 zip爆弾**: `.mxl` 展開（`extractXmlFromMxl`、`parser.ts:486` 付近）で `fflate.unzipSync` が全エントリを一括メモリ展開する。解凍後サイズ・圧縮率・エントリ数の上限チェックがなく、高圧縮率の細工 `.mxl` でメモリ枯渇が起こり得る
2. **A-1 XMLパースDoS**: `parse()` が入力サイズ・要素数の上限チェックを持たない（`parser.ts:98-100` は空文字チェックのみ）。
   さらに同一の `xmlContent` を fast-xml-parser（`:102`）と DOMParser（`:200`）で二重にフルパースするためピークメモリが増幅する。
   `processEntities` の明示もなく、DOCTYPE検出時の拒否もない

### 関連する仕様

- `docs/sdd/requirements/nfr/compatibility.md`（MusicXML入力の扱い）
- CLAUDE.md「MusicXML → Score変換」節、`parser.ts`
- 調査所見: A-2（zip爆弾）・A-1（パースDoS）を要注意と評価

## 実装内容

### 修正対象

- ファイル: `src/renderer/src/lib/musicxml-parser/parser.ts`
  - **XMLサイズ上限**: `parse(xmlContent)` の冒頭で `xmlContent` のバイト長（またはstring長）が定数上限（例: `MAX_XML_BYTES = 30 * 1024 * 1024` = 30MB）を超える場合、`MusicXMLParseError` で拒否する。上限値は定数として明示しコメントで根拠を書く
  - **DOCTYPE拒否**: パース前に `<!DOCTYPE` を含む場合は拒否する（内部エンティティ展開DoS・XXE試行の予防的遮断。MusicXMLは実務上DOCTYPE不要）。大文字小文字・前後空白を考慮した検出にする
  - **processEntities無効化**: 両方の `XMLParser` 生成箇所（`:102`, `:493`）に `processEntities: false` を明示する
  - **zip爆弾対策**: `extractXmlFromMxl` で、`unzipSync` 後の対象エントリの展開後サイズが定数上限（例: `MAX_UNZIPPED_BYTES = 50 * 1024 * 1024`）を超える場合に拒否する。可能であればエントリ数上限（例: 1000）も設ける。`fflate` の `unzipSync` は同期一括展開のため、まず `unzip` されたエントリのサイズ合計または対象エントリのサイズを検査してから `TextDecoder` に渡す
- ファイル: `src/renderer/src/lib/musicxml-parser/parser.test.ts`
  - 上限・DOCTYPE・zip爆弾拒否のテストを追加する

### 二重パースについて

- fast-xml-parser と DOMParser の二重フルパースは、DOMParserが `<backup>/<forward>/<chord>` の兄弟出現順序保持に必要なため即座には一本化できない。本タスクではサイズ上限で実効的にメモリ増幅を抑える方針とし、一本化は行わない（スコープ外・将来課題としてコメントに残す）

### 注意事項

- 既存のサンプル譜面・E2Eで使うMusicXML/MXLが上限に掛からないことを確認する（上限値は実在の楽譜が余裕で収まる値にする）
- 拒否時はユーザーに分かるエラーメッセージ（`MusicXMLParseError`）とし、既存のエラー表示（ダイアログ/トースト）に載ることを確認する
- 上限値はマジックナンバーを避け、名前付き定数＋根拠コメントで表す

## 実装手順（TDD）

1. テスト作成: `parser.test.ts` に「サイズ上限超過で拒否」「DOCTYPE含有で拒否」「巨大展開の.mxlで拒否」「正常な譜面・mxlは従来どおり成功」を追加
2. テスト実行: `npm run test` で失敗を確認
3. テストコミット
4. 実装: `parser.ts` に定数・検査を追加しテストを通過させる
5. `npm run test` / `npm run typecheck` / `npm run lint` 通過を確認しコミット

## 受入基準

- [ ] XMLサイズ上限・DOCTYPE拒否・zip展開サイズ上限が実装され、それぞれのテストがある
- [ ] 両 `XMLParser` に `processEntities: false` が明示されている
- [ ] 正常なMusicXML/MXL（既存サンプル）が引き続きパースできる（リグレッションなし）
- [ ] 拒否時に `MusicXMLParseError` が送出される
- [ ] `npm run test` / `npm run typecheck` / `npm run lint` がすべて通過する

## テスト項目

- [ ] `MAX_XML_BYTES` 超過の文字列で `MusicXMLParseError`
- [ ] `<!DOCTYPE ...>` を含むXMLで `MusicXMLParseError`
- [ ] 展開後サイズが `MAX_UNZIPPED_BYTES` を超える細工 `.mxl` で拒否（fflateで高圧縮のダミーを合成してテスト）
- [ ] 既存の正常な `.xml` / `.musicxml` / `.mxl` は成功
- [ ] `processEntities: false` により内部エンティティが展開されない（`&entity;` がそのまま扱われる）ことの確認

## 情報の明確性

### 明示された情報

- 攻撃面の内容と該当行（調査レポートで確認済み）
- XXEは成立しないため対象外、対策の主眼はメモリ枯渇DoS耐性
- 二重パースの一本化はスコープ外（DOMParserの必要性が判明済み）

### 不明/要確認の情報

- 上限値の具体値（実サンプル譜面のサイズを確認し、余裕を持った値を実装時に決定する）
