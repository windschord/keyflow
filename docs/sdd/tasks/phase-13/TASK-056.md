# TASK-056: 画面下キーボードの鍵盤数指定

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-056 |
| タイプ | feature |
| ステータス | DONE |
| 優先度 | Medium |
| 見積もり | 60分 |
| 依存タスク | なし |

## 背景

### 問題の概要

画面下部のピアノ鍵盤は88鍵（A0〜C8）固定である。実際の練習環境は61鍵・76鍵などのキーボードも多く、手元の鍵盤数に表示を合わせたいという要望がある（2026-07-06 ユーザー要望）。

### 関連する仕様

- US-005（画面鍵盤ガイド）
- `src/renderer/src/components/PianoKeyboard/key-layout.ts`（`MIDI_MIN = 21` / `MIDI_MAX = 108` の固定値）

## 実装内容

### 修正対象

- ファイル: `src/renderer/src/components/PianoKeyboard/key-layout.ts`（MIDI範囲を引数化。鍵盤数→範囲のプリセット定義）
- ファイル: `src/renderer/src/components/PianoKeyboard/`（index.tsx / keyboard-renderer.ts の範囲パラメータ伝搬、キャンバス幅・クリック座標の追随）
- ファイル: `src/renderer/src/store/slices/ui-slice.ts` と SettingsModal（鍵盤数の選択UIと永続化）

### 実装手順

1. 鍵盤数プリセットを定義する: 88鍵=A0〜C8（21〜108）、76鍵=E1〜G7（28〜103）、61鍵=C2〜C7（36〜96）、49鍵=C2〜C6（36〜84）
2. key-layout の座標計算・範囲チェックをプリセット範囲で動作するよう引数化する（既定は88鍵で後方互換）
3. SettingsModal に「鍵盤数」選択（日本語ラベル）を追加し、ui-slice と electron-store へ結線する
4. 範囲外ノーツの扱いを実装する: ガイド対象ノーツが表示範囲外の場合、鍵盤の左右端に範囲外を示すインジケータ（例: 端のグラデーション＋矢印）を表示する
5. テスト: 各プリセットでの鍵数・座標、範囲外インジケータ、クリック座標の整合、永続化

### 注意事項

- 表示範囲の変更は判定ロジック（practice-engine）に影響させない。範囲外の音も判定対象のままとする（表示だけの制約）
- キャンバス幅が変わるため、`totalWidth` の算出（現状 `52 * WHITE_KEY_WIDTH` 固定）もプリセットから導出すること

## 受入基準

- [x] 設定で88/76/61/49鍵を切り替えられ、表示が即時追随する
- [x] 範囲外のガイド対象ノーツが存在する場合、端のインジケータで示される
- [x] 鍵盤クリックの座標→MIDI変換が全プリセットで正しい
- [x] 設定が永続化される。既存テストが通り、新規テストが追加されている

## テスト項目

- [x] プリセットごとの白鍵数・範囲境界の座標（ユニット。key-layout.test.ts）
- [x] 範囲外ノーツのインジケータ表示（ユニット。keyboard-renderer.test.ts、PianoKeyboard.test.tsxの結線テスト）
- [ ] 実機での切替と見た目（手動E2E）: 実機確認は手動E2Eで実施予定

## 完了サマリー（2026-07-06）

- `key-layout.ts`: `KEYBOARD_PRESETS`（88=A0〜C8/76=E1〜G7/61=C2〜C7/49=C2〜C6）を追加。`getNotePosition`にmidiMin/midiMax引数を追加（既定値は既存のMIDI_MIN/MIDI_MAX=88鍵で後方互換）。白鍵数を数える`countWhiteKeys`を追加
- `keyboard-renderer.ts`: `renderKeyboard`にmidiMin/midiMax引数を追加（既定88鍵）。ガイド対象ノーツ（expectedNotes）が表示範囲外の場合、鍵盤左右端にグラデーション＋矢印（◀/▶）のインジケータを描画する`drawOutOfRangeIndicators`を追加。表示だけの制約でありexpectedNotes自体・正誤判定には影響しない
- `PianoKeyboard/index.tsx`: `keyboardSize?: KeyboardSize`プロパティを追加（既定88）。totalWidth・クリック座標→MIDI変換・renderKeyboard呼び出しをすべてプリセットのmidiMin/midiMaxで駆動するよう変更
- `types/keyboard.ts`（新規）: `KeyboardSize`型（88|76|61|49）と`KEYBOARD_SIZES`をrenderer層（store/components/settings）で共有する単一の型定義として追加
- `store/slices/ui-slice.ts`: `keyboardSize`（初期値88）と`setKeyboardSize`（未知の値は88へフォールバックする防御的実装）を追加
- `SettingsModal`: 「表示」セクションに「鍵盤数」selectを追加し、選択即座にui-slice.setKeyboardSizeへ反映＋electron-store永続化（既存のpianoHeightパターンを踏襲、保存失敗時ロールバックあり）
- `main/settings.ts` / `renderer/types/settings.ts`: `ui.keyboardSize`（既定88）を追加
- `App.tsx`: keyboardSizeをPianoKeyboardへ実際に渡すよう結線。起動時ロード（electron-store `ui.keyboardSize`）をui-slice.setKeyboardSizeへ反映
- 表示範囲の変更はpractice-engineの判定ロジックに影響させない（expectedNotes自体・正誤判定は変更なし。あくまでPianoKeyboardの表示範囲のみの制約）
- 関連: docs/sdd/tasks/index.md（TASK-056ステータス更新）、docs/sdd/requirements/traceability.md（REQ-005-005へ追記）

## 情報の明確性

### 明示された情報

- 要望: 「画面下部のキーボードで鍵盤数を指定できるようにして欲しい」（2026-07-06 ユーザー）

### 不明/要確認の情報

- プリセットの範囲（一般的な電子キーボードの範囲を採用。実装時にユーザーの機種に合わせた調整余地をコメントで明記する）
