# TASK-055: 運指の一括表示/非表示トグル

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-055 |
| タイプ | feature |
| ステータス | DONE |
| 優先度 | Medium |
| 見積もり | 40分 |
| 依存タスク | なし |

## 背景

### 問題の概要

運指提案や手動運指メモを一度表示すると、非表示へ戻す手段がない。楽譜を運指なしで確認したい場面や、指番号が譜面の可読性を下げる場面で不便である（2026-07-06 ユーザー要望）。

### 関連する仕様

- US-008 / US-009（運指メモ・運指提案の表示）
- `docs/sdd/design/components/toolbar.md`（ツールバー構成）

## 実装内容

### 修正対象

- ファイル: `src/renderer/src/store/slices/ui-slice.ts`（`showFingerings: boolean` と setter を追加。初期値 true）
- ファイル: `src/renderer/src/components/Toolbar/` に運指表示トグル（日本語ラベル「運指」・ツールチップ・トグル状態が視覚的に分かる表示）
- ファイル: `src/renderer/src/App.tsx`（OFF時は ScoreRenderer / PianoKeyboard へ空のアノテーションを渡す、または各コンポーネントへ表示フラグを伝搬）
- ファイル: `src/main/settings.ts` / `src/renderer/src/types/settings.ts`（`ui.showFingerings` の永続化と起動時ロード）

### 実装手順

1. ui-slice に `showFingerings` / `setShowFingerings` を追加する（TDD）
2. ツールバーへトグルボタンを追加し、storeへ結線する
3. OFF時に楽譜上の指番号（`fingering-layer`）と鍵盤上の指番号の両方が消えることを結線する。アノテーションのデータ自体は保持し、ONで即再表示できること
4. electron-store への永続化と起動時ロードを既存パターン（volume等）に合わせて実装する
5. テスト: トグル操作で両表示が消灯/点灯すること、永続化、日本語ラベルの存在

### 注意事項

- 非表示はあくまで表示レイヤの制御とする。annotation-store のデータや保存ファイルには影響させない
- 運指提案の実行自体はトグルと独立して可能とする（実行時にOFFなら自動でONへ切り替える挙動を推奨。理由をコメントに明記）

## 受入基準

- [x] ツールバーのトグルで楽譜上・鍵盤上の指番号が一括で表示/非表示になる
- [x] OFFでもアノテーションデータは保持され、ONで即再表示される
- [x] 設定が永続化され、再起動後も維持される
- [x] 既存テストが通り、新規テストが追加されている

## テスト項目

- [x] トグルOFFで `fingering-layer` が描画されない（ユニット）。App.test.tsxのTASK-055結線テストでScoreRendererへ空配列が渡ることを検証する。加えて既存のScoreRenderer.test.tsxの空アノテーション時テストでclearFingerings呼び出しを検証する
- [x] トグルOFFで keyboard-renderer の指番号 fillText が呼ばれない（ユニット）。App.test.tsxでPianoKeyboardへ空配列が渡ることを検証する。加えて既存のPianoKeyboard.test.tsx「アノテーションのないノーツには指番号を描画しない」でfillText未呼び出しを検証する
- [x] 永続化の読み書き（ユニット。FingeringToggle.test.tsx、App.test.tsx起動時ロードテスト）
- [ ] 実機での表示切替（手動E2E）: 実機確認は手動E2Eで実施予定

## 完了サマリー（2026-07-06）

- ui-slice に `showFingerings`（初期値true）と `setShowFingerings` を追加（TDD、ui-slice.test.ts）
- ツールバーに `FingeringToggle`（日本語ラベル「運指」・ツールチップ・aria-pressedによる視覚的トグル状態・electron-store永続化）を新設
- App.tsx で `displayedAnnotations = showFingerings ? keyboardAnnotations : []` を計算する。これをScoreRenderer/PianoKeyboardの両方へ渡すことで表示レイヤのみを制御する（annotation-store本体・保存ファイルは無変更）
- 運指提案（FingeringPanel.onSuggested→handleFingering）の実行時、OFFであれば自動でONへ切り替え（結果が見えなくならないようにするため。理由をコード内コメントに明記）
- electron-store（`ui.showFingerings`）への永続化と起動時ロードをvolume等と同一パターンで実装
- 関連: docs/sdd/tasks/index.md（TASK-055ステータス更新）、docs/sdd/requirements/traceability.md（REQ-005-007/REQ-008-002へ追記）

## 情報の明確性

### 明示された情報

- 要望: 「運指を一括で表示非表示できるボタンが欲しい」（2026-07-06 ユーザー）

### 不明/要確認の情報

- なし（配置はツールバー、既存トグル群と同一パターンとする）
