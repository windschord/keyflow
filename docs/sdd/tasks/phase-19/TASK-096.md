# TASK-096: i18n基盤（リソース・型・言語解決・useTranslation・ui-slice）

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-096 |
| タイプ | feat（US-016） |
| ステータス | TODO |
| 優先度 | High |
| 見積もり | 60分 |
| 依存タスク | なし |

## 背景

US-016（UIの多言語対応）の基盤。設計は
[design/components/i18n.md](../../design/components/i18n.md) と
[DEC-009](../../design/decisions/DEC-009.md) を正とする。

## 実装内容

### 新規ファイル（`src/renderer/src/lib/i18n/`）

- `types.ts`: `Language`（`'ja' | 'en'`）と `Messages` 型（`typeof ja` から導出。
  値を `string` へ広げるユーティリティ型を含む）
- `ja.ts`: 日本語リソース。この時点では全文言の洗い出しは不要で、TASK-097/098で
  文言を追加していく。基盤検証用に `settings.language` 等の最小セットを定義する
- `en.ts`: `Messages` 型に適合する英語リソース
- `format.ts`: `formatMessage(template: string, params?: Record<string, string | number>): string`。
  `{name}` プレースホルダを置換する純関数。未知のプレースホルダは残置、paramsなしは原文を返す
- `resolve-language.ts`: `resolveLanguage(stored: unknown, osLocale: string): Language`。
  `'ja'`/`'en'` はそのまま、`'auto'`・不正値・未定義は `osLocale` が `ja` 始まりなら
  `'ja'`、それ以外は `'en'`
- `index.ts`: `getMessages(language: Language): Messages`。`en` を基底に選択言語で
  上書きしたオブジェクトを返す（言語ごとにメモ化）
- `useTranslation.ts`: ui-sliceの `language` を購読し `getMessages` の結果を返すフック

### 既存ファイルの変更

- `src/renderer/src/store/slices/ui-slice.ts`: `language: Language`（初期値 `'ja'`）と
  `setLanguage` を追加
- `src/renderer/src/App.tsx`: 起動時の設定読み込み処理で
  `resolveLanguage(ui.language, navigator.language)` を実行し `setLanguage` へ反映
- `src/renderer/src/types/settings.ts` と `src/main/settings.ts`:
  `ui.language` の型を `'auto' | 'ja' | 'en'` へ変更、既定値を `'auto'` へ変更
- `src/renderer/src/components/SettingsModal/index.tsx`: ローカル既定値の `language: 'ja'`
  を `'auto'` へ追随（言語セレクタUIはTASK-098で追加）

### 注意事項

- 依存パッケージを追加しない（DEC-009）
- `any` 禁止。`Messages` 型はプロパティアクセスの型安全を担保すること
- Reactリソース管理原則（StrictMode耐性）に従う

## 実装手順（TDD）

1. テスト作成: `format.test.ts` / `resolve-language.test.ts` / `getMessages` の
   フォールバックテスト / `ui-slice.test.ts` への `setLanguage` ケース追加
2. `npm run test` で失敗を確認しテストをコミット
3. 実装してテストを通す
4. `npm run test` / `npm run typecheck` / `npm run lint` / `npm run lint:jp:ts` 通過を確認しコミット

## 受入基準

- [ ] `resolveLanguage` がREQ-016-002の規則（ja系→ja、他→en、保存値優先）を満たす
- [ ] `formatMessage` が `{name}` 置換・未知プレースホルダ残置・params省略を扱える
- [ ] `getMessages` が `en` 基底のフォールバックを行う（REQ-016-006）
- [ ] `ui.language` の型が `'auto' | 'ja' | 'en'`、既定値 `'auto'`（main/renderer両方）
- [ ] App.tsx起動時に言語がui-sliceへ反映される（REQ-016-005のRenderer側）
- [ ] 全チェック（test/typecheck/lint/lint:jp:ts）通過

## テスト項目

- [ ] resolveLanguage: 保存値'ja'/'en'優先、'auto'でja-JP→ja、en-US→en、不正値→ロケール判定
- [ ] formatMessage: 置換・複数置換・params省略・未知プレースホルダ残置
- [ ] getMessages: enに存在しjaで未定義のキーが（人工的な部分リソースで）enへフォールバック
- [ ] ui-slice: setLanguageで状態が変わる
