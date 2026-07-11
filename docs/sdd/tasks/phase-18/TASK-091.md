# TASK-091: MusicXML/MXLパースの入力堅牢化（zip爆弾・XMLサイズ/DOCTYPE・二重パース）

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-091 |
| タイプ | fix（セキュリティ強化・DoS耐性） |
| ステータス | DONE |
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

- [x] XMLサイズ上限・DOCTYPE拒否・zip展開サイズ上限が実装され、それぞれのテストがある
- [x] 実体展開DoS（billion laughs）が遮断されている（下記の設計変更参照。`processEntities: false` は不採用）
- [x] 正常なMusicXML/MXL（既存サンプル）が引き続きパースできる（リグレッションなし）
- [x] 拒否時に `MusicXMLParseError` が送出される
- [x] `npm run test` / `npm run typecheck` / `npm run lint` がすべて通過する

## テスト項目

- [x] `MAX_XML_LENGTH` 超過の文字列で `MusicXMLParseError`
- [x] 内部サブセット付きDOCTYPE（billion laughs）で `MusicXMLParseError`
- [x] 外部DTD参照のみのDOCTYPEは許可される（実在MusicXMLとの互換性維持）
- [x] 宣言サイズが `MAX_UNZIPPED_BYTES` を超える細工 `.mxl` で拒否（fflateで高圧縮のダミーを合成してテスト）
- [x] 既存の正常な `.xml` / `.musicxml` / `.mxl` は成功
- [x] 予約実体参照（`&amp;` 等）は従来どおり復号される（processEntities維持の回帰確認）

## 情報の明確性

### 明示された情報

- 攻撃面の内容と該当行（調査レポートで確認済み）
- XXEは成立しないため対象外、対策の主眼はメモリ枯渇DoS耐性
- 二重パースの一本化はスコープ外（DOMParserの必要性が判明済み）

### 不明/要確認の情報

- 上限値の具体値（実サンプル譜面のサイズを確認し、余裕を持った値を実装時に決定する）
  → 完了サマリー参照。既存サンプル（8.7KB）に対し十分な余裕を持つ値を採用した。

## 完了サマリー（2026-07-11）

### 実装内容

- `src/renderer/src/lib/musicxml-parser/parser.ts`:
  - `parse()` 冒頭にXMLサイズ上限（`MAX_XML_LENGTH = 30_000_000` 文字）超過の拒否を追加
  - `parse()` に `hasDoctypeWithInternalSubset` を追加し、内部サブセット付きDOCTYPEのみ拒否する
  - `extractXmlFromMxl()` の `unzipSync` に `filter` コールバックを渡し、展開前に宣言サイズ（`originalSize`）・エントリ数を検査する
- `src/renderer/src/lib/musicxml-parser/parser.test.ts`: 拒否ケースと回帰テスト計7件を追加

### 設計上の要点1: DOCTYPEは内部サブセット付きのみ拒否する

当初は「DOCTYPEを一律拒否」で実装した。
しかし実在の標準MusicXMLは外部DTD参照のDOCTYPEを持つことが判明した。
E2Eフィクスチャ（`tests/e2e/fixtures/sample-two-hands.musicxml`）も
`<!DOCTYPE score-partwise PUBLIC ...>` の形式を含む。
一律拒否は正常な譜面を開けなくするリグレッションになるため、
実体展開DoS（billion laughs）の攻撃面である**内部サブセット（角括弧部分）を伴うDOCTYPEのみ**を
拒否する方式へ是正した。外部DTDは両パーサとも取得しない（XXE不成立）ため許可して問題ない。

### 設計上の要点2: `processEntities` はメインパーサで既定（true）を維持する

`processEntities: false` は `&amp;` / `&lt;` 等の予約実体参照まで復号しなくなり
（`fast-xml-parser` v5で `"Rock &amp; Roll"` が復号されない）、曲名・歌詞の表示を壊す。
実体展開DoSは上記のDOCTYPE内部サブセット拒否で既に防げるため、メインパーサでは
`processEntities` を既定のまま維持し、表示の正しさを保つ。
一方 `container.xml` 用パーサはDOCTYPE検査を通していないため、そこだけ `processEntities: false` として
実体展開を遮断する（container.xmlはパス属性のみで予約実体参照を含む理由がなく副作用もない）。

### 設計上の要点3: zip爆弾は展開前に遮断する

`unzipSync` の `filter` コールバックはエントリの実際の展開（`inflateSync`）の直前に呼ばれるため、
そこでZIPヘッダの宣言サイズ（`originalSize`）と累計・エントリ数を検査し、
巨大バッファを確保する前に `MusicXMLParseError` を投げる。展開後に合計を検査する方式より堅牢。

### 採用した上限値と根拠

- `MAX_XML_LENGTH = 30,000,000` 文字: 既存サンプル（`sample-two-hands.musicxml` = 8.7KB）や
  実在の譜面（数KB〜数百KB規模）に対し十分な余裕。悪意ある巨大入力のみを拒否する
- `MAX_UNZIPPED_BYTES = 50MB` / `MAX_ZIP_ENTRIES = 1000`: 通常の.mxl（数十KB〜数MB）を許容しつつ、
  高圧縮率のzip爆弾を拒否する

### 実装プロセス上の注意（再発防止）

本タスクは当初 task-executing サブエージェントへ委任した。しかし当該エージェントが共有ワーキング
ツリー上で想定外のgit操作をして、未コミットの実装差分を巻き戻す事象が発生した。チームリードが
実装を直接再適用し、コミット（テスト先行→実装）を完了させた。並列委任時は各エージェントを
worktree分離するか、単一ツリーでは同時に1エージェントのみが書き込む運用とすること。

### テスト結果

- `npm run test`: 752件全通過（parser.test.tsは46件）
- `npm run typecheck` / `npm run lint` / `npm run lint:jp:ts`: いずれも通過
