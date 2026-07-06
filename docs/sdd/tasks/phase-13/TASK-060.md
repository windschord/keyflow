# TASK-060: [BugFix] グレーアウト表示を白ベールから音符のグレー描画へ変更

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-060 |
| タイプ | bugfix |
| ステータス | DONE |
| 優先度 | Medium |
| 見積もり | 60分 |
| 依存タスク | なし |

## 背景

### 問題の概要

「運指を非表示にしても白色の透過が残る」という報告があった（2026-07-06 PR#26実機フィードバック）。実起動調査の結果、アプリ内で白半透明を描画するのは片手練習時のグレーアウトベール（REQ-002-007）のみであり、かつこのベールに位置バグがあることを確認した。

### 根本原因

`osmd-controller.ts` の `renderGrayoutLayer` は白半透明の矩形（`rgba(255,255,255,α)`）を `noteIdToSvgCoord` の座標に描画する。しかし `noteIdToSvgCoord` が保持するのは `computeFingeringCoords` が計算した**運指番号の表示位置**（上段=カーソル上端付近、下段=カーソル下端の下）であり、符頭の位置ではない。そのためベールは音符ではなく運指番号の表示位置に重なり、「運指があった場所に白い透過が残る」ように見える。実起動検証では、2パート構成の楽譜で全ベールが同一y座標（上段付近）に集中することも確認した。

### 関連する仕様

- REQ-002-007（片手練習時の非練習側グレーアウト表示）
- `docs/sdd/design/components/score-renderer.md`

## 実装内容

### 修正対象

- ファイル: `src/renderer/src/components/ScoreRenderer/osmd-controller.ts` / `osmd-controller.test.ts`

### 実装手順

1. 白ベール方式を廃止し、非練習側の音符自体を薄く（グレーに）描画する方式へ変更する（ユーザー承認済み方針）
2. `buildNoteIdMap` を拡張し、noteIdごとにOSMDの `GraphicalNote` を解決するマップを追加する。カーソル各ステップで `cursor.GNotesUnderCursor()` を呼び、`GraphicalNote.sourceNote` とVoiceEntryのNoteの同一性で対応付ける
3. `renderGrayoutLayer` を書き換える。対象noteIdの `GraphicalNote.getSVGGElement()` に `opacity` を設定して音符を減光する。適用前に、前回減光した要素の `opacity` を必ず復元する（対象集合の置き換え・全解除に対応）
4. OSMD再描画後の再適用（`reapplyOverlays`）で、`buildNoteIdMap` 再構築後の新しいSVG要素に対して減光が適用されることを維持する
5. `#note-grayout-layer`（白矩形レイヤ）の生成コードとレイヤ削除処理を撤去する
6. テスト: 白矩形が生成されないこと、対象noteIdのSVG要素に減光が適用されること、空集合で全復元されること、再適用の動作

### 注意事項

- `getSVGGElement()` はVexFlowバックエンド固有のAPIのため、取得失敗時（要素なし・例外）は該当ノートをスキップして他のノートの処理を続行する
- 符幹・連桁（beam）が複数音符で共有される場合、減光が部分的になることがある。既知の制限としてコメントに明記する
- `setGrayedOutNotes(noteIds, opacity)` のシグネチャと「空集合で全解除」のセマンティクスは維持する
- 既存テストの白矩形検証は本タスクの仕様変更（ユーザー承認済み）に伴って書き換える。それ以外のテストを弱めない

## 受入基準

- [x] 片手練習モードで非練習側の音符がグレー（減光）表示される（`GraphicalNote.getSVGGElement()`のSVG要素opacityを直接下げる方式で実装。実機確認は手動E2Eで実施予定）
- [x] アプリ内のどの操作でも白半透明の矩形が楽譜上に描画されない（`#note-grayout-layer`の生成コードを撤去済み、ユニットテストで非生成を検証）
- [x] 両手モードへ戻すと減光が全解除される（空集合適用で`restoreGrayoutOpacity`が全要素のopacityを復元することをユニットテストで検証）
- [x] ズーム変更・リサイズ後も減光が正しく再適用される（`reapplyOverlays`経由の`renderGrayoutLayer`呼び出しを維持。`buildNoteIdMap`再構築後の新しい`GraphicalNote`に対して再適用されることをユニットテストで検証）
- [x] 既存テストが通り、新規テストが追加されている（`osmd-controller.test.ts`: 60テスト全通過）

## テスト項目

- [x] 減光の適用・解除・置き換え（ユニット）
- [x] 白矩形レイヤが生成されないこと（ユニット）
- [ ] 実機で片手練習時の見た目と、運指トグルOFF後に白い透過が残らないこと（手動E2E。実機確認は手動E2Eで実施予定、本タスクのスコープでは未実施）

## 完了サマリー（2026-07-06）

- `osmd-controller.ts`: `buildNoteIdMap`で`cursor.GNotesUnderCursor()`から得た`GraphicalNote`群と
  `VoiceEntry.Notes`の要素を`sourceNote`の同一性（`===`）で対応付け、noteIdごとの
  `GraphicalNote`を`noteIdToGraphicalNote`に保持するようにした。
- `renderGrayoutLayer`を全面書き換え。白半透明矩形（`#note-grayout-layer`）の生成を廃止し、
  対象noteIdに対応する`GraphicalNote.getSVGGElement()`のSVG要素の`opacity`を直接変更する
  方式にした。適用前に必ず前回減光した要素のopacityを復元する（`restoreGrayoutOpacity`）。
  `getSVGGElement()`の取得失敗（未実装・例外・null）は該当ノートのみスキップして継続する。
- `dispose()`にも`restoreGrayoutOpacity()`を追加し、破棄時の復元漏れを防止した。
- `setGrayedOutNotes(noteIds, opacity)`のシグネチャと「空集合で全解除」のセマンティクスは維持。
- 符幹・連桁（beam）が複数音符で共有される場合に減光が部分的になる既知の制限をコードコメントに明記した。
- テスト: `osmd-controller.test.ts`に新規/書き換えテストを追加（減光の適用・解除・置き換え、
  白矩形レイヤ非生成、`getSVGGElement`失敗時のスキップ、`GNotesUnderCursor`結線の検証、
  disposeでの復元）。既存の白矩形前提テストは本仕様変更に合わせて書き換えた。
- `npm run typecheck` / `npx eslint`（対象2ファイル） / `npx vitest run
  src/renderer/src/components/ScoreRenderer`（60テスト）を実行し、いずれも成功を確認した。

## 情報の明確性

### 明示された情報

- 報告: 「運指を非表示にしても、運指が表示されていたときの白色の透過が残っている」（2026-07-06 ユーザー）
- 方針: 白ベールをやめて音符自体をグレー色にする（AskUserQuestionでユーザー承認済み）

### 不明/要確認の情報

- 報告時の練習対象は「両手のまま」との回答であり、片手モード限定のベール描画と完全には一致しない。本タスクで白半透明の描画自体を全廃するため、修正後も残留が再現する場合はスクリーンショットで再調査する
