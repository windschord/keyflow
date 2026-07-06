# TASK-059: 運指トグルのスイッチ型UI化

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-059 |
| タイプ | feature |
| ステータス | DONE |
| 優先度 | Medium |
| 見積もり | 30分 |
| 依存タスク | TASK-055 |

## 背景

### 問題の概要

TASK-055で追加した「運指」ボタンは、青背景=表示中/白背景=非表示という配色のみで状態を表しており、ボタンの意味と現在の状態が読み取れない（2026-07-06 PR#26実機フィードバック）。

### 関連する仕様

- US-008 / US-009（運指メモ・運指提案の表示）
- `src/renderer/src/components/Toolbar/FingeringToggle.tsx`

## 実装内容

### 修正対象

- ファイル: `src/renderer/src/components/Toolbar/FingeringToggle.tsx` / `FingeringToggle.test.tsx`

### 実装手順

1. ボタンをスイッチ型トグルへ変更する（ユーザー承認済みデザイン）。構成は「運指」ラベル＋ON/OFFスイッチ（トラック＋ノブ）＋状態文言「表示中/非表示」
2. スイッチの色はON=青（#3b82f6）、OFF=灰色とする。ノブ位置がON/OFFで左右に切り替わる
3. 既存の動作（ui-slice結線・electron-store永続化・ツールチップ・`aria-pressed`・`data-testid="fingering-toggle"`）は維持する
4. テスト: 状態文言「表示中」「非表示」の切り替え、既存テスト（永続化・aria-pressed等）の維持

### 注意事項

- クリック可能領域はラベル・スイッチ・状態文言を含む全体とする（操作しやすさの維持）
- 既存のFingeringToggle.test.tsxの検証項目（永続化の直列化・electronAPI未提供時の非クラッシュ等）は仕様として維持し、弱めない

## 受入基準

- [x] トグルが「運指」ラベル＋スイッチ＋状態文言（表示中/非表示）で表示される
- [x] ON/OFFがスイッチのノブ位置・色・文言の3点で視覚的に判別できる
- [x] 既存の永続化・自動ON（運指提案実行時）の挙動が維持されている
- [x] 既存テストが通り、新規テストが追加されている

## テスト項目

- [x] 状態文言の切り替え（ユニット）
- [x] スイッチ状態の視覚属性（aria-pressed等）の維持（ユニット）
- [ ] 実機での見た目（手動E2E）※実機確認は手動E2Eで実施予定

## 完了サマリー

`FingeringToggle.tsx` を配色のみの表現から、「運指」ラベル・ON/OFFスイッチ
（トラック＋ノブ、ON=#3b82f6/OFF=#9ca3af）・状態文言（表示中/非表示）の3要素
構成に変更した。クリック可能領域はこれら3要素を包むbutton要素全体のままとし、
`aria-pressed`・`data-testid="fingering-toggle"`・ツールチップ・
`setShowFingerings`結線・`persistShowFingerings`によるelectron-store永続化
（直列化パターン）は変更していない。

TDD（Red→Green）で、状態文言「表示中」「非表示」の表示・クリック時の切替を
検証する3件のテストを追加し、既存7件（ラベル・ツールチップ・aria-pressed・
トグル動作・永続化マージ・electronAPI未提供時の非クラッシュ）はそのまま維持
した。`FingeringToggle.test.tsx` は10件全て通過。`npm run typecheck` /
`npx eslint` はエラーなし。実機での見た目確認は手動E2Eで実施予定。

## 情報の明確性

### 明示された情報

- 要望: 「『運指』ボタンは何の意味かわからないので、表示/非表示のわかるトグルにしてほしい」（2026-07-06 ユーザー、原文の趣旨を要約）
- デザイン: スイッチ型トグル＋状態文言（AskUserQuestionでユーザー承認済み）

### 不明/要確認の情報

- なし
