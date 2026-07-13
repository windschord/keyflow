# TASK-096: i18n基盤（リソース・型・言語解決・useTranslation・ui-slice）

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-096 |
| タイプ | feat（US-016） |
| ステータス | DONE |
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

- [x] `resolveLanguage` がREQ-016-002の規則（ja系→ja、他→en、保存値優先）を満たす
- [x] `formatMessage` が `{name}` 置換・未知プレースホルダ残置・params省略を扱える
- [x] `getMessages` が `en` 基底のフォールバックを行う（REQ-016-006）
- [x] `ui.language` の型が `'auto' | 'ja' | 'en'`、既定値 `'auto'`（main/renderer両方）
- [x] App.tsx起動時に言語がui-sliceへ反映される（REQ-016-005のRenderer側）
- [x] 全チェック（test/typecheck/lint/lint:jp:ts）通過

## テスト項目

- [x] resolveLanguage: 保存値'ja'/'en'優先、'auto'でja-JP→ja、en-US→en、不正値→ロケール判定
- [x] formatMessage: 置換・複数置換・params省略・未知プレースホルダ残置
- [x] getMessages: enに存在しjaで未定義のキーが（人工的な部分リソースで）enへフォールバック
- [x] ui-slice: setLanguageで状態が変わる

## 完了サマリー（2026-07-12）

### 実装内容

- `src/renderer/src/lib/i18n/`（新規）:
  - `types.ts`: `Language`（`'ja' | 'en'`）、`DeepStringify<T>`（値を`string`へ広げる
    ユーティリティ型）、`Messages`（`typeof ja`から導出）
  - `ja.ts`: 日本語リソース。基盤検証用に`settings.title`/`settings.language`の
    最小セットを定義（構造のソースオブトゥルース、`as const satisfies`で型を固定）
  - `en.ts`: `Messages`型への適合を型チェックで強制する英語リソース
  - `format.ts`: `formatMessage(template, params?)`。`{name}`プレースホルダを
    置換する純関数。未知プレースホルダは残置、params省略時は原文を返す
  - `resolve-language.ts`: `resolveLanguage(stored, osLocale)`。保存値
    `'ja'`/`'en'`を優先し、それ以外（`'auto'`・不正値・未定義）はosLocaleが
    `ja`始まりなら`'ja'`、それ以外は`'en'`
  - `index.ts`: `getMessages(language)`。内部の`mergeMessages(base, override)`
    （再帰的な深いマージの純関数、DeepPartial型でoverrideの部分欠落を許容）で
    `en`を基底に選択言語のリソースを上書きし、言語ごとにメモ化して返す
  - `useTranslation.ts`: ui-sliceの`language`を購読し`getMessages`の結果を返すフック
- `src/renderer/src/store/slices/ui-slice.ts`: `language: Language`（初期値`'ja'`）と
  `setLanguage`を追加
- `src/renderer/src/App.tsx`: 起動時の設定読み込みuseEffect内で
  `resolveLanguage(uiSettings.language, navigator.language)`を実行し
  `setLanguage`へ反映（`setLanguage`をdeps配列にも追加）
- `src/renderer/src/types/settings.ts` / `src/main/settings.ts`: `ui.language`の型を
  `string`から`'auto' | 'ja' | 'en'`へ、既定値を`'ja'`から`'auto'`へ変更
- `src/renderer/src/components/SettingsModal/index.tsx`: ローカル既定値
  `DEFAULT_SETTINGS.ui.language`を`'auto'`へ追随（言語セレクタUI自体はTASK-098で追加）

### テスト結果

- 新規: `format.test.ts`（7件）・`resolve-language.test.ts`（8件）・`index.test.ts`
  （`mergeMessages`のフォールバック検証3件＋`getMessages`のメモ化検証含む3件）・
  `ui-slice.test.ts`への`language`/`setLanguage`ケース追加（2件）
- `npm run test`: 全58ファイル・814件通過（既存テストの破壊・弱体化なし）

### 各チェックコマンドの結果

- `npm run test`: 通過（814件）
- `npm run typecheck`: 通過（node/web両方）
- `npm run lint`: 通過
- `npm run lint:jp:ts`: 通過
- `npx prettier --check src`: 通過

### 未解決事項

- なし。言語セレクタUI（SettingsModalへの選択肢追加）・実際のUI文言の外部化は
  TASK-097/098のスコープであり、本タスクでは未着手（設計どおり）
