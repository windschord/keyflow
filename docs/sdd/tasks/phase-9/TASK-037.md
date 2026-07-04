# TASK-037: 鍵盤上の指番号描画（PianoKeyboard）

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-037 |
| タイプ | feature |
| ステータス | TODO |
| 優先度 | Medium |
| 見積もり | 30分 |
| 依存タスク | TASK-033 |

## 背景

### 問題の概要

REQ-005-007（鍵盤上の指番号表示）のうち、TASK-033でApp.tsx側の配線（annotation-storeの実データを `PianoKeyboard` の `annotations` プロパティへ渡す）までは完了したが、`src/renderer/src/components/PianoKeyboard/keyboard-renderer.ts` は受け取ったannotationsを描画していない（受領のみで未使用）。

### 根本原因

- TASK-012実装時からannotationsの描画ロジックが未実装のまま（分析レポート原因6の一部）。
- TASK-033実行セッションでは `src/renderer/src/components/PianoKeyboard/` 配下がセッションの権限設定によりRead/Edit不可だったため、本体実装を分離した。

### 関連する仕様

- REQ-005-007 / US-005: 鍵盤上の指番号表示
- `docs/sdd/design/components/piano-keyboard.md`

## 実装内容

### 修正対象

- ファイル: `src/renderer/src/components/PianoKeyboard/keyboard-renderer.ts`（指番号描画ロジック追加）
- ファイル: `src/renderer/src/components/PianoKeyboard/index.tsx`（必要に応じてprops伝搬の確認）

### 実装手順

1. 現在の判定グループ（expectedNotes）に対応するannotationの `fingerNumber` を、該当鍵の上（白鍵は下部、黒鍵は中央など視認しやすい位置）にCanvas 2Dで描画する
2. ガイド表示（次に弾く鍵の光り）と重ならない配色・フォントサイズにする
3. TDD: keyboard-rendererのユニットテストで、annotations付きノーツの描画呼び出し（fillText等）を検証する

### 注意事項

- 実行前に `src/renderer/src/components/PianoKeyboard/` への読み書き権限があるセッション設定で行うこと（2026-07-04のセッションでは同ディレクトリがdeny設定だった）

## 受入基準

- [ ] 現在の判定グループのノーツに指番号アノテーションがある場合、対応する鍵に指番号が描画される
- [ ] アノテーションのないノーツでは描画されない
- [ ] 既存のテストが通る
- [ ] 新規テストが追加されている

## テスト項目

- [ ] 指番号付きノーツで fillText 相当の描画が呼ばれる（ユニット）
- [ ] 実機で指番号が視認できる（手動E2E）

## 情報の明確性

### 明示された情報

- App.tsx側の配線はTASK-033（コミット bc494ee）で完了済み
- 描画先: keyboard-renderer.ts（Canvas 2D / 88鍵）

### 不明/要確認の情報

- なし（すべて確認済み）
