# TASK-078: [BugFix] QuickPanelがヘッダーのoverflow:hiddenでクリップされ表示されない

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-078 |
| タイプ | bugfix |
| ステータス | REVIEW |
| 優先度 | High |
| 見積もり | 40分 |
| 依存タスク | TASK-075 |

## 背景

### 問題の概要

ヘッダー右上の⋯ボタンをクリックしてもQuickPanelが表示されず、移設したメトロノーム操作に到達できない（2026-07-08ユーザー実機報告）。

（分析レポート: `docs/sdd/troubleshooting/2026-07-08-quickpanel-clipped/analysis.md`）

### 根本原因

- Headerルート（`components/Header/index.tsx:78`）の `overflow: 'hidden'` が、`top: 100%` でヘッダー外（下）に絶対配置されるPopoverをクリップしている。stateのトグルとDOM挿入は正常で、視覚上のみ約2pxに切り取られていた（実バイナリのヒットテストで実証済み）
- E2Eは `toBeVisible()`（祖先クリップ非考慮）と `fill()`/`selectOption()`（座標ヒットテスト不要）で検証していたためすり抜けた

### 関連する仕様

- REQ-012-002: ポップオーバーボタンクリックで低頻度操作を含むポップオーバーを表示しなければならない
- テスト方針の追加原則（2026-07-05）: E2Eはユーザー観測可能な結果を合格条件にする

## 実装内容（承認済み方針C: Popoverをoverflow:hiddenの外へ移動）

### 修正対象

| ファイル | 変更内容 |
|---------|---------|
| `src/renderer/src/components/Header/index.tsx` | 構造を「外側ラッパー（`position: relative`、overflowなし、`data-testid="app-header"` 維持）＞ 内側1行row（現行のflex行スタイル+`overflow: hidden`、高さ48px）」へ再構成し、`Popover` を外側ラッパー直下（rowの兄弟）に移動。位置は `top: 100%; right: 12px` 相当でヘッダー右端に揃える。`anchorRef` は⋯ボタンのまま |
| `src/renderer/src/components/Header/Header.test.tsx` | 構造テスト追加: パネルを開いた状態で、popover要素から `app-header` までの祖先に `overflow: hidden` を持つ要素が存在しないこと |
| `tests/e2e/app.spec.ts` | QuickPanel検証を強化: パネルを開いた後、メトロノームチェックボックスを実クリック（`click()`、座標ヒットテストを伴う）し、チェック状態の変化（ユーザー観測可能な結果）とストアの `metronomeEnabled` 反転を検証。クリップ再発時はここで失敗する |

### 実装手順（TDD）

1. Header.test.tsx に構造テストを追加し、Red確認 → テストコミット
2. E2Eにメトロノーム実クリック検証を追加（この時点では実行しない）→ 同コミットに含めてよい
3. Header/index.tsx の構造修正 → ユニットGreen
4. `npm run test:e2e` 実行（buildを含む）→ 全通過確認
5. 実バイナリでのヒットテスト検証（分析時のscratchpadスクリプト相当）で `hitIsInsidePopover: true` を確認
6. 実装コミット、タスクステータス更新

## 受入基準

- [x] ⋯クリックでQuickPanelが視覚的に表示される（実バイナリのヒットテストで popover 内要素が返る）
- [x] E2Eのメトロノーム実クリック検証が通過（`click()` + チェック状態変化）
- [x] ヘッダー高さ56px以下のE2E検証が引き続き通過（外側ラッパー化で退行しない）
- [x] `npm run test` / `npm run typecheck` / `npm run lint` / `npm run format:check` / `npm run lint:jp` / `npm run test:e2e` 全通過
- [ ] ユーザー実機確認（⋯クリック→パネル表示→メトロノーム操作）※未実施。開発者による実バイナリ検証（ヒットテストスクリプト・E2E）までは完了している

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | 事象（⋯無反応・メトロノーム不達）、修正方針C（ユーザー承認済み、2026-07-08） |
| 設計判断として決定 | 外側ラッパー+内側rowの2層構造、Popover位置 right:12px |

## 対応要件

REQ-012-002 / REQ-012-003（回帰確認）
