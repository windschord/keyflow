# TASK-075: 1行ヘッダー統合（Toolbar・上段バー置換）

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-075 |
| タイプ | feature |
| ステータス | DONE |
| 優先度 | High |
| 見積もり | 90分 |
| 依存タスク | TASK-074 |

## 背景

App.tsx上段バー + Toolbarの2ブロック（実質3〜4行）を、高さ48pxの1行 `Header` に統合する（US-012 / DEC-007）。

設計: `docs/sdd/design/components/header.md`（レイアウト・再生中無効化の節）、コントロール定義は `docs/sdd/design/components/toolbar.md` を正とする。

## 実装内容

### 対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/renderer/src/components/Header/index.tsx` | 新規。1行レイアウト（高さ48px、`flexWrap: nowrap`）: 📂開く / ▶⏸■ / ループ / ♩=BPM+スライダー+リセット / 練習対象 / 右端に⋯（QuickPanel開閉）+⚙ |
| `src/renderer/src/App.tsx` | 上段バー（ファイルを開く+FingeringPanel直書き）を削除し `<Header>` に置換。「ファイルを開く」ハンドラはpropsでHeaderへ |
| `src/renderer/src/components/Toolbar/index.tsx` | 削除（子コンポーネントは残す） |
| `src/renderer/src/components/Toolbar/TempoControl.tsx` | メトロノームUI（チェックボックス2つ）を除去しテンポ系のみに（メトロノームはQuickPanelの `MetronomeToggle` へ移設済み）。高さ36pxコンパクト化 |
| 各子コンポーネント（PlaybackControls / LoopControl / PracticeModeSelector） | 高さ36px・ラベルのツールチップ化などコンパクト表示調整（ロジック・store結線は不変） |
| `src/renderer/src/components/Header/Header.test.tsx` ほか | テスト追加・既存Toolbar.test移行 |
| `tests/e2e/**` | セレクタ追随修正（ボタンの取得方法。テストの期待値・検証内容は弱めない） |

### 実装要点

- 全コントロールの用途・ツールチップ・無効化条件は toolbar.md の定義を維持（REQ-012-004: 機能の喪失禁止）
- テンポUIの再生中無効化（`playbackState === 'playing'`）を維持（REQ-012-006）
- Space再生トグル・L/R/Bショートカット維持
- 極小幅ではテンポスライダーのみ非表示（BPM数値入力は残す）

### 実装手順（TDD）

1. Header.test.tsx 作成（Red→コミット）: 頻用操作（開く/再生/停止/ループ/BPM/練習対象）が全てレンダリングされる / ⋯クリックでQuickPanelが開く / 再生中にテンポUIが無効化される
2. Header実装・App.tsx統合 → Green
3. 既存Toolbar.testの検証内容をHeader.testへ移行（検証を弱めない）、Toolbar/index.tsx削除
4. E2E追随修正 → `npm run test:e2e` 通過確認 → コミット

## 受入基準

- [x] ヘッダーが1行・高さ56px以下（E2E: bounding box検証を追加）
- [x] 現行の全操作がヘッダーまたはQuickPanelから実行可能（E2Eで代表操作: 開く→再生→ループ→音量変更→運指提案）
- [x] Space/L/R/Bショートカット動作維持
- [x] `npm run test` / `npm run test:e2e` / `npm run typecheck` / `npm run lint` 全通過
- [x] 実起動確認（開発モードStrictMode有効）で譜面表示領域が拡大している

## 完了サマリー（2026-07-07）

- `src/renderer/src/components/Header/index.tsx` を新規実装し、App.tsx上段バー
  （ファイルを開く+FingeringPanel直書き）とToolbar/index.tsxの2ブロック構成を
  高さ48px（最大56px）の1行へ統合した。頻用操作（開く/再生/停止/ループ/テンポ/
  練習対象）は常時表示し、右端の`...`ボタンでQuickPanel（音量・表示倍率・運指・
  メトロノーム・成績）をPopover表示する。
- `Toolbar/index.tsx`・`Toolbar.test.tsx`を削除。子コンポーネント
  （PlaybackControls/LoopControl/PracticeModeSelector/TempoControl）は高さ36px
  へコンパクト化し、説明ラベルはtitle属性（ツールチップ）へ集約。用途・
  無効化条件はtoolbar.mdの定義を維持（REQ-012-004）。
- TempoControlからメトロノーム関連チェックボックスを除去（QuickPanelの
  MetronomeToggleへ移設済み、TASK-074）。
- 旧Toolbar.test.tsxの検証内容はすべてHeader.test.tsxへ移行（BPM検証・
  ループエラー・ズーム・Space再生トグル・練習対象ショートカット・設定
  ツールチップ等）。App.test.tsx/practice-flow.test.tsxはHeaderをモックする
  形へ更新し、onOpenFile/onFingeringSuggestedの結線を検証。
- E2E（tests/e2e/app.spec.ts）: ヘッダー高さのbounding box検証、QuickPanel
  経由のズーム・音量変更の代表操作を追加。
- テスト結果: `npm run test` 628 tests passed / `npm run typecheck` エラーなし /
  `npm run lint` エラーなし / `npm run test:e2e` 2 tests passed。

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | 1行+ポップオーバー方式（ユーザー承認済みプレビューのレイアウト）、ヘッダー残留/移設の分類 |
| 設計判断として決定 | コントロール高さ36px、ラベルのツールチップ化、極小幅でのスライダー非表示 |

## 対応要件

REQ-012-001 / REQ-012-004 / REQ-012-005 / REQ-012-006
