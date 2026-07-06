# TASK-048: [BugFix] 2段譜対応: Note.staff/hand導入と手判定のNote単位化

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-048 |
| タイプ | bugfix |
| ステータス | DONE |
| 優先度 | High |
| 見積もり | 90分 |
| 依存タスク | なし |

## 背景

### 問題の概要

MuseScore製の標準的なピアノ譜（1パート・2段譜: `<attributes><staves>2</staves>`、各音符に`<staff>1|2</staff>`）を開くと、手の判定に依存する機能が全滅する。

- 運指提案で「左手」を選ぶと「対象パートが見つかりません」になる
- 練習対象の左手モードが機能せず、右手モードは両手の全音を要求する
- 鍵盤ガイドの左右色分けが全て右手色になる
- 片手モード時の楽譜グレーアウトを段単位にできない

（分析レポート: `docs/sdd/troubleshooting/2026-07-05-user-feedback/analysis.md` 原因群A）

### 根本原因

現アプリは「右手=1パート目、左手=2パート目」という**パート単位の手判定**を前提としており、1パート2段譜に対応していない。

- `src/renderer/src/lib/musicxml-parser/parser.ts` は `<staff>` 要素を一切読まない（note処理 `parser.ts:269-319` に staff の抽出がない）。`Note` 型（`src/renderer/src/types/score.ts:45-64`）にも staff フィールドがない
- 単一パート譜では先頭小節の clef 配列の**先頭**（=上段のG音部記号）だけを見て（`parser.ts:124-146`）、`detectHand` が `clefSign === 'G'` で `Part.hand='right'` を返す（`hand-detector.ts:21-23`）
- 消費側は全てパート単位である。`note-grouping.ts:49-64` の `filterNotesByPracticeMode` は `Part.hand` から partId 集合を作って判定する。`keyboard-renderer.ts:30` は `handByPartId` マップを使う。`FingeringPanel/index.tsx:36-46` は `score.parts` のフィルタである。`osmd-controller.ts:122-168` の `setPartOpacity` はパート単位の矩形オーバーレイである
- なお tick 計算と両手同時グループ化（`<backup>`処理）は既に正しく、壊れているのは hand の付与と消費のみ（分析レポートで机上検証済み）

### 関連する仕様

- REQ-001-003: MusicXMLを読み込んだ時、システムはパート情報（右手・左手）を自動的に識別しなければならない
- REQ-003-001〜003: 右手/左手/両手の練習モードフィルタ
- REQ-005-001/002: 鍵盤ガイドの右手=青系/左手=緑系の色分け
- REQ-002-007: 非練習パートのグレーアウト表示
- `docs/sdd/design/components/data-model-v2.md`: Note型v2定義（本タスクで staff/hand を追補する）

## 実装内容

### 修正対象

- ファイル: `src/renderer/src/types/score.ts`
  - 変更内容: `Note` に `staff: number`（MusicXML `<staff>`。未指定は1）と `hand: Hand` を追加する。
- ファイル: `src/renderer/src/lib/musicxml-parser/parser.ts`
  - 変更内容: `<attributes><staves>` をパート・小節走査中に追跡し、各 `<note>` の `<staff>` を読む。手の決定規則:
    - `staves >= 2` のパート: staff 1 = `'right'`、staff 2以降 = `'left'`
    - `<staff>` 未指定、または単一 staff のパート: 従来の `Part.hand`（`detectHand` によるパート単位判定）をそのまま Note に継承する
- ファイル: `src/renderer/src/lib/practice-engine/note-grouping.ts`
  - 変更内容: `filterNotesByPracticeMode`（`:49-64`）を partId 集合判定から `note.hand` の直接比較へ変更する（`parts` 引数は不要になるため、呼び出し元 `practice-engine/index.ts:49-53, :254` も追随）。
- ファイル: `src/renderer/src/components/PianoKeyboard/keyboard-renderer.ts`
  - 変更内容: `handByPartId` マップ（`:30`）と `expectedNote.partId` 参照（`:61`）を `expectedNote.hand` 直接参照へ変更する（`parts` prop は除去可。`PianoKeyboard/index.tsx`・`App.tsx:400` の受け渡しも整理）。
- ファイル: `src/renderer/src/components/FingeringPanel/index.tsx`
  - 変更内容: `:36-46` のパートフィルタ（`score.parts.filter((p) => p.hand === hand || p.hand === 'unknown')` → partId 集合 → notes）を、ノートの `hand` による直接フィルタへ変更する。`p.hand === 'unknown'` 分岐はデッドコード（`detectHand` は right/left しか返さない）なので整理し、エラー文言「対象パートが見つかりません」を実態（例: 「右手/左手の音符が見つかりません」）に合わせて更新する。
- ファイル: `src/renderer/src/components/ScoreRenderer/osmd-controller.ts`（および `ScoreRenderer/index.tsx:126-141` の結線）
  - 変更内容: `setPartOpacity`（`osmd-controller.ts:122-168`、パート単位のY座標クラスタ矩形）を、note 単位のグレーアウト（グレーアウト対象の noteId 集合を受け取り、`noteIdToSvgCoord` の該当座標にのみベールを掛ける）へ変更する。ScoreRenderer 側は practiceMode に応じて非練習側の hand を持つノートの noteId 集合を渡す。
- ファイル: `docs/sdd/design/components/data-model-v2.md`
  - 変更内容: Note 型定義に `staff`/`hand` の追補（フィールド差分サマリ含む）を記載する。
- ファイル: テスト（`parser.test`、`note-grouping.test`、`keyboard-renderer`（PianoKeyboard.test）、`FingeringPanel.test`、`osmd-controller.test`/`ScoreRenderer.test` の各該当スイート）
  - 変更内容: 1パート2段・和音・`<backup>` を含む**合成MusicXMLフィクスチャ**を追加し、staff→hand 判定・左手フィルタ・鍵盤色分け・note単位グレーアウトを検証する。

### 実装手順

TDDで進める。

1. 1パート2段譜（`staves=2`、`<staff>1|2</staff>`、和音、`<backup>` を含む）の合成MusicXMLフィクスチャを作成する（ユーザーの実楽譜はコミットしない）。
2. 失敗するテストを先に書く: パーサが staff1 の音に `hand='right'`、staff2 の音に `hand='left'` を付与すること、`<staff>` 未指定の単一パート譜では従来の `Part.hand` を継承すること。red を確認してコミット。
3. `types/score.ts` に `staff`/`hand` を追加し、`parser.ts` で `<staves>`/`<staff>` を読んで hand を決定して green にする。
4. `filterNotesByPracticeMode` を `note.hand` 比較へ変更するテスト→実装（左手モードで staff2 の音のみ残ることをフィクスチャで検証）。
5. `keyboard-renderer.ts` を `expectedNote.hand` 参照へ変更するテスト→実装（2段譜で上段=青系/下段=緑系）。
6. `FingeringPanel/index.tsx` のフィルタをノート hand ベースへ変更するテスト→実装（左手選択で staff2 の音が DP に渡ること、'unknown' 分岐の整理、エラー文言更新）。
7. `osmd-controller.ts` のグレーアウトを noteId 集合ベースへ変更するテスト→実装。
8. `data-model-v2.md` に Note.staff/hand の追補を記載する。
9. 全テスト・typecheck・lint を通す。

### 注意事項

- noteId 採番（`{partId}-M{measureNumber}-N{noteIndex}`）は変更しないこと。アノテーション互換に影響なし（分析レポート原因群A）。
- tick 計算・`<backup>` 処理・判定グループ化は既に正しいため触らないこと。
- 複数パート譜（従来の2パート形式）では従来どおり `Part.hand` によるパート単位判定が Note に継承され、既存の挙動が変わらないこと（回帰確認）。
- `Hand` 型の `'unknown'` は `detectHand` が返さないため、消費側の 'unknown' 分岐はデッドコードとして整理する（型自体の扱いは既存互換を優先し、無理に削除しない）。
- TASK-049（noteIdマッピング照合ベース化）・TASK-050（和音DP）・TASK-051（再生フィルタ）が本タスクの `Note.hand`/`Note.staff` を前提とする。

## 受入基準

- [x] 1パート2段譜フィクスチャで、staff1 の音が `hand='right'`、staff2 の音が `hand='left'` になる
- [x] `<staff>` 未指定または単一 staff のパートでは従来の `Part.hand` が Note に継承される（既存2パート譜の挙動不変）
- [x] 左手練習モードで 2段譜の下段（staff2）の音のみが判定対象になる
- [x] 鍵盤ガイドが 2段譜で上段=右手色/下段=左手色に塗り分けられる
- [x] 運指提案で「左手」を選ぶと 2段譜の下段の音が計算対象になり、エラーにならない（文言も更新済み）
- [x] 片手モード時のグレーアウトが note 単位（非練習側の音のみ）で適用される
- [x] `data-model-v2.md` に Note.staff/hand の追補が記載されている
- [x] ユーザーの実楽譜（musescore.com由来）がリポジトリにコミットされていない
- [x] 既存のテストが通る
- [x] 新規テストが追加されている（必要な場合）

## テスト項目

- [x] （新規）parser: 2段譜フィクスチャで staff→hand 判定（和音・`<backup>` 含む）
- [x] （新規）parser: `<staff>` 未指定/単一 staff で `Part.hand` 継承
- [x] （新規）note-grouping: `filterNotesByPracticeMode` が `note.hand` で左右フィルタする
- [x] （新規）keyboard-renderer: `expectedNote.hand` に基づく guidRight/guidLeft 色分け
- [x] （新規）FingeringPanel: 左手選択時に staff2 の音が計算対象になる
- [x] （新規）osmd-controller/ScoreRenderer: noteId 集合ベースのグレーアウト適用・解除
- [x] （回帰）`npm run test` 全件グリーン、`npm run typecheck` / `npm run lint` パス

## 完了サマリ（2026-07-05）

`Note` 型に `staff?: number` / `hand?: Hand`（後方互換のためoptional）を追加した。`parser.ts` で
`<attributes><staves>` を追跡・`<note><staff>` を読み取り、`staves>=2` のパートは
staff番号から直接note単位でhandを決定する（staff1='right'、staff2以降='left'）。それ以外は従来通り
`Part.hand` を継承するようにした。tick/backup/chord計算・noteId採番は変更していない。

消費側4箇所をパート単位（`Part.hand`/partId）判定からNote単位（`note.hand`）判定へ移行した。

- `practice-engine/note-grouping.ts`: `filterNotesByPracticeMode(notes, practiceMode)` にシグネチャ変更（`parts`引数を削除）。`index.ts` の呼び出し元（`resolvePosition`/`advancePosition`/`resetToMeasure`）も追随。
- `PianoKeyboard/keyboard-renderer.ts`: `expectedNote.hand` を直接参照。`parts` propは
  `PianoKeyboard`/`App.tsx` から除去。
- `FingeringPanel/index.tsx`: `score.parts` フィルタ（`'unknown'`デッドコード含む）を
  `note.hand === hand` の直接フィルタへ変更。エラー文言を「右手/左手の音符が見つかりません」に更新。
- `ScoreRenderer/osmd-controller.ts`: `setPartOpacity(partId, opacity)`（Y座標クラスタ矩形）を
  `setGrayedOutNotes(noteIds, opacity)`（note単位の小さなベール）に置換。`ScoreRenderer/index.tsx`
  はpracticeModeに応じた非練習側handのnoteId集合を渡すよう結線。

TDDで進め、各ステップで red→green→commit を実施した。コミットは 7a3f019 / e6e5da5 / 296ae81 /
8689deb / add4ffa / 68f54db / 5a059b7 / 26a5469 / 96c1822 / a814020 / 583786c / c13a66a /
02ce600 の13件。

合成MusicXMLフィクスチャ（1パート2段譜、和音、`<backup>`含む）でTDD検証した。ユーザーの実楽譜
（`/Users/tsk/Desktop/無題のスコア.musicxml`）はコミットせず、手動検証用の一時テストで
parse結果を確認（right: 798件、left: 546件のnoteが正しく分離されることを確認後、削除）。

`npm run test`（354 tests / 36 files）・`npm run typecheck`・`npm run lint` すべて通過。

## 情報の明確性

### 明示された情報

- 根本原因の file:line を実コードで検証済み。`parser.ts:269-319` に staff 抽出なし、`parser.ts:124-146` の先頭 clef 参照、`hand-detector.ts:21-23` を確認した。加えて `note-grouping.ts:49-64`、`keyboard-renderer.ts:30`、`FingeringPanel/index.tsx:36-46`、`osmd-controller.ts:122-168` も確認した
- 修正方針: Note単位の staff/hand 導入（staves>=2 は staff1=right/staff2=left、それ以外は Part.hand 継承）— 分析レポート承認済み方針 TASK-048
- テストは合成フィクスチャで行い、ユーザーの実楽譜はコミットしない（分析レポート備考）

### 不明/要確認の情報

- なし（すべて確認済み）
