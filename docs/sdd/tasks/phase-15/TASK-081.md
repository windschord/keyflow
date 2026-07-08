# TASK-081: [BugFix] 和音を含む譜面でグレーアウトが残留・累積する問題の修正

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-081 |
| タイプ | bugfix |
| ステータス | REVIEW |
| 優先度 | High |
| 見積もり | 40分 |
| 依存タスク | なし（main由来の既存バグ） |

## 背景

### 問題の概要

練習対象を左手/右手に切り替えると楽譜の両段がグレーアウトされる（鍵盤ガイドは正常）。2026-07-08ユーザー実機報告。

（分析レポート: `docs/sdd/troubleshooting/2026-07-08-grayout-chord-residue/analysis.md`）

### 根本原因

`src/renderer/src/components/ScoreRenderer/osmd-controller.ts` のグレーアウト管理（TASK-060導入）は `Map<noteId, {element, originalOpacity}>` と**noteId単位**で管理している。和音（複数noteIdが同一のStaveNote SVG要素を共有するケース）では、「減光済みのopacity=0.5」を元値として誤記録してしまう。復元時に後勝ちで0.5が再適用され、モード切替のたびに減光が残留・累積する。

## 実装内容（承認済み方針A: 要素単位の管理へ変更）

### 修正対象

| ファイル | 変更内容 |
|---------|---------|
| `src/renderer/src/components/ScoreRenderer/osmd-controller.ts` | `grayoutAppliedElements` を**SVG要素単位**（`Map<SVGGElement, string>` 等）へ持ち替える。`renderGrayoutLayer()` は対象noteIdのSVG要素をまず重複排除で集め、各要素につき1回だけ「変更前のopacity」を記録してから0.5を適用する。`restoreGrayoutOpacity()` も要素単位で1回だけ復元する |
| `src/renderer/src/components/ScoreRenderer/osmd-controller.test.ts` | 再発防止テスト追加: 複数noteIdが同一SVG要素を共有するモックで、(1) 適用→復元後にopacityが完全に元へ戻る (2) モード切替を複数回繰り返しても残留しない (3) 元からopacityを持つ要素の元値が保全される |

### 実装手順（TDD）

1. osmd-controller.test.ts に和音共有ケースのテスト追加（Red確認→テストコミット）
2. 要素単位管理へ実装変更 → Green
3. 実バイナリ検証: 調査時の再現スクリプト（scratchpadのrepro7.cjs相当）で「both→左→both→右→both」の各段階で減光数が期待値（0/右手数/0/左手数/0）になることを確認
4. 全ゲート → 実装コミット → タスクステータス更新

## 受入基準

- [x] 和音共有ケースの新規テスト全通過、既存osmd-controller.test非回帰
- [x] 実バイナリ再現スクリプトでモード切替後の残留が0になる
- [x] `npm run test` / `npm run typecheck` / `npm run lint` / `npm run format:check` / `npm run lint:jp` / `npm run test:e2e` 全通過
- [ ] ユーザー実機確認（左手/右手切替で選択した手以外のみ減光され、切替を繰り返しても累積しない）
      ※未実施。開発者による実バイナリ検証（再現スクリプトでboth→左→both→右→bothの残留数が
      0/6/0/4/0になることを確認）までは完了している

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | 事象（両段グレー・鍵盤は正常）、修正方針A（ユーザー承認済み、2026-07-08） |
| 設計判断として決定 | 要素単位Mapのキー形式、重複排除の実装方法 |

## 対応要件

REQ-002-007（回帰修正） / US-003
