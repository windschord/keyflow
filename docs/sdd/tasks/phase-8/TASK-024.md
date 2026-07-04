# TASK-024: スコア読み込み後の練習セッション初期化

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-024 |
| タイプ | bugfix |
| ステータス | TODO |
| 優先度 | High |
| 見積もり | 30分 |
| 依存タスク | なし |

## 背景

### 問題の概要

MusicXMLファイルを開いて楽譜が表示されても、MIDIキーボード（または画面鍵盤）を弾いた際の正誤判定・鍵盤ガイド・カーソル進行・統計・ループが一切動作しない。練習機能のすべてが体感上死んでいる。

（分析レポート: `docs/sdd/troubleshooting/2026-07-04-app-unusable/analysis.md` 原因1）

### 根本原因

- `src/renderer/src/App.tsx:85` の `handleOpenFile` は `setScore(parsedScore, filePath, xmlContent)` を呼ぶだけで、その後に `practiceEngine.resetToMeasure(1)` を呼ぶコードがアプリのどこにも存在しない。
- `src/renderer/src/store/slices/score-slice.ts:15-16` の `setScore` も `expectedNotes` を初期化しないため、`expectedNotes` はストア初期値 `[]` のまま。
- その結果、MIDIイベントは `src/renderer/src/lib/practice-engine/index.ts:22-25` の空チェックで即 `'ignored'` になる。
- 統合テスト `src/renderer/src/tests/integration/practice-flow.test.ts:73` は `engine.resetToMeasure(1)` を**テスト側で手動呼び出し**しており、アプリ本体に存在しない初期化をテストが補完してグリーンになっていた（欠落の隠蔽）。
- 付随: 楽譜由来のテンポ（`Score.tempo`、`src/renderer/src/types/score.ts:7`、パーサーは `parser.ts:158-159` で `<sound tempo>` を解析済み）がストアの `originalBpm` / `bpm` に反映されず、120固定のまま（`src/renderer/src/store/slices/ui-slice.ts:15-16`）。

### 関連する仕様

- US-004（正誤判定）: 要件あり・エンジン実装あり・初期化欠落で全く動作せず
- US-005（鍵盤ガイド）: 同上
- US-006（テンポ調整）: Reset の戻し先 `originalBpm` が楽譜から設定される前提

## 実装内容

### 修正対象

- ファイル: `src/renderer/src/App.tsx`
  - 変更内容: `handleOpenFile` 内の `setScore` 成功後に `practiceEngine.resetToMeasure(1)` を呼び、`expectedNotes` を初期化する。あわせて楽譜のテンポ（`parsedScore.tempo`）を `originalBpm` / `bpm` としてストアに設定する。
- ファイル: `src/renderer/src/store/slices/ui-slice.ts`
  - 変更内容: `originalBpm` を設定する手段の追加（例: `setOriginalBpm` アクション、または `setScore` 時に一括設定）。現状 `setBpm` / `setMetronomeEnabled` / `setZoom` しか存在しない。
- ファイル: `src/renderer/src/tests/integration/practice-flow.test.ts`
  - 変更内容: アプリ経路（スコア読み込み→初期化）を検証するテストを追加する。

### 実装手順

TDDで進める。

1. 失敗するテストを先に書く: 「`setScore` 後にアプリの初期化経路を通すと `expectedNotes` が空でなくなり、`originalBpm` / `bpm` が楽譜のテンポになる」ことを、テスト側で `resetToMeasure` を手動で呼ばずに検証するテストを `practice-flow.test.ts` に追加する（App.tsx の `handleOpenFile` 相当のロジックを関数として切り出してテスト対象にするか、Testing Library で App コンポーネント経由で検証する）。
2. テストを実行し、失敗（red）を確認してコミットする。
3. `App.tsx` の `handleOpenFile` を修正: `setScore(...)` の直後に `practiceEngine.resetToMeasure(1)` を呼ぶ。`usePractice()` から得ている `practiceEngine`（`App.tsx:19`）をそのまま使用する。
4. `parsedScore.tempo` を `originalBpm` / `bpm` に反映する（ui-slice にアクションを追加、または score-slice の `setScore` に統合）。
5. テストが通る（green）ことを確認する。
6. 既存テスト・型チェック・lint を実行して回帰がないことを確認する。

### 注意事項

- 既存テストの `resetToMeasure(1)` 手動呼び出し（`practice-flow.test.ts:73` ほか）は「エンジン単体の振る舞い検証」としては有効なので削除不要。ただし「アプリ経路の初期化」を検証する新テストは手動初期化に依存しないこと（欠落隠蔽の再発防止）。
- `resetToMeasure` の呼び出しは `setScore` がストアに反映された**後**である必要がある（`resetToMeasure` は `store.getState().score` を参照するため）。Zustand の `set` は同期なので直列呼び出しで問題ないが、順序を入れ替えないこと。
- `.mxl` と `.xml` の両分岐（`App.tsx:77-84`）どちらでも初期化が走ることを確認する。
- ファイル読み込み失敗時（catchブロック）には初期化を行わないこと。

## 受入基準

- [ ] MusicXMLを開いた直後にMIDI入力（画面鍵盤クリック含む）で正誤判定が行われ、カーソルが進行する
- [ ] スコア読み込み直後の `expectedNotes` が1小節目の音符で初期化されている
- [ ] 楽譜に `<sound tempo>` がある場合、`originalBpm` / `bpm` がその値になる（ない場合はパーサーのデフォルト120）
- [ ] アプリ経路（スコア読み込み→初期化）を検証するテストが追加され、テスト側の手動 `resetToMeasure` 呼び出しに依存していない
- [ ] 既存のテストが通る
- [ ] 新規テストが追加されている（必要な場合）

## テスト項目

- [ ] （新規・統合）`setScore` 後のアプリ初期化経路で `expectedNotes.length > 0` になる
- [ ] （新規・統合）テンポ指定ありのMusicXMLで `originalBpm` / `bpm` が楽譜の値になる
- [ ] （新規・統合）テンポ指定なしのMusicXMLで `originalBpm` / `bpm` がデフォルト値になる
- [ ] （手動E2E）`npm run dev` でファイルを開き、画面鍵盤クリックで鍵盤ハイライトとカーソル進行が起きる
- [ ] （回帰）`npm run test` 全件グリーン、`npm run typecheck` / `npm run lint` パス

## 情報の明確性

### 明示された情報

- 根本原因のfile:line（分析レポート原因1、実コードで検証済み）
- 修正方針: `setScore` 後の `resetToMeasure(1)` 呼び出しとテンポのストア反映（分析レポート「フェーズA-1」承認済み方針）
- TDDで進めること（テスト先行）
- テストが手動初期化で欠落を隠蔽していた問題への対処として、アプリ経路を検証するテストを追加すること

### 不明/要確認の情報

- なし（すべて確認済み）
