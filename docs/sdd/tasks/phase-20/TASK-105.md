# TASK-105: ライブラリ画面から元の楽譜表示へ戻る導線（REQ-017-012）

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-105 |
| タイプ | feat（US-017、2026-07-13実機フィードバック） |
| ステータス | DONE |
| 優先度 | High |
| 見積もり | 45分 |
| 依存タスク | TASK-103 |

## 背景

実機確認で「ライブラリ画面を開いたあと、楽譜を選び直さないと元の楽譜表示へ
戻れない」というフィードバックを受けた。REQ-017-012として要件化済み。
設計は [design/components/score-library.md](../../design/components/score-library.md) の
「画面切り替え」節を正とする。

## 実装内容

### Headerボタンのトグル化

- App.tsxの `onOpenLibrary` を、楽譜読み込み済みかつ `activeView === 'library'` の
  場合は `setActiveView('score')` へ切り替えるトグルにする
- Headerへライブラリ表示中かどうかを示すpropsを追加し、ボタンのラベル・
  aria-label・titleを「ライブラリ」⇔「楽譜へ戻る」系で切り替える（i18nキー追加）

### LibraryView内の戻るボタン

- `onReturnToScore?: () => void` のオプショナルpropsを追加し、指定時のみ
  画面上部に「楽譜へ戻る」ボタンを表示する（i18n対応）
- App.tsxは楽譜読み込み済みのときのみコールバックを渡す

### 注意事項

- `setActiveView('score')` を呼ぶだけとし、楽譜の再読み込み・状態リセットを発生させない
- 楽譜未読み込み時は両導線とも表示しない（既存挙動の維持）

## 実装手順（TDD）

1. テスト先行: LibraryView（onReturnToScore指定時のみボタン表示・クリックで呼ばれる）、
   App（楽譜ありでライブラリ表示中のヘッダーボタンがscoreへ戻す・楽譜なしでは戻らない）、
   Header（ライブラリ表示中のaria-label切り替え）
2. 失敗確認→実装→通過
3. E2E: library.spec.tsの一連操作へ「楽譜を開く→ライブラリ→戻るボタンで楽譜表示へ復帰
   （再パースなし）」を組み込む
4. 全チェック（test/typecheck/lint/lint:jp/format:check/test:e2e）通過を確認しコミット

## 受入基準

- [x] 楽譜を開いた状態でライブラリ画面から、楽譜を選び直さずに元の楽譜表示へ戻れる
- [x] Headerボタンがトグルとして機能し、表示中はラベルが「楽譜へ戻る」系になる
- [x] LibraryView上部の戻るボタンは楽譜読み込み済みのときのみ表示される
- [x] 戻る操作で楽譜の再読み込みが発生しない
- [x] 文言がja/en両対応
- [x] 全チェック通過

## テスト項目

- [x] LibraryView: onReturnToScore指定時のみボタン表示、クリックでコールバック
- [x] App: 楽譜あり+ライブラリ表示中→ヘッダーボタンでscoreへ復帰
- [x] App: 楽譜なし→ヘッダーボタンはライブラリ表示のまま（戻らない）
- [x] E2E: ライブラリ→戻るボタン→楽譜表示への復帰

## 完了サマリー

Header・LibraryView・App.tsxへ楽譜表示への復帰導線を実装した。Headerのライブラリ
ボタンは`isReturnToScoreMode`propsでトグル表示になり、楽譜読み込み済み+ライブラリ
表示中のみ「楽譜へ戻る」ラベルへ切り替わる。LibraryViewは`onReturnToScore`指定時
のみ上部にボタンを表示する。いずれも`setActiveView('score')`のみを呼び、再読み込み
は発生しない。E2Eでテンポ変更値が往復後も保持されることで再パースなしを確認した。

- 変更ファイル: `src/renderer/src/App.tsx`、`src/renderer/src/components/Header/index.tsx`、
  `src/renderer/src/components/LibraryView/index.tsx`、
  `src/renderer/src/lib/i18n/ja.ts`、`src/renderer/src/lib/i18n/en.ts`、
  `tests/e2e/library.spec.ts`
- 追加i18nキー: `header.returnToScoreAriaLabel`、`header.returnToScoreTitle`、
  `library.returnToScoreButton`（ja/en両方）
- ユニットテスト: 918件全通過（新規追加10件超を含む）
- E2E: `tests/e2e/library.spec.ts` 2件全通過
- 各チェック: test/typecheck/lint/lint:jp/format:check/test:e2e すべて通過
