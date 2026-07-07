# TASK-076: Aboutページ（ライセンス自動生成・バージョン表示・LICENSE追加）

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-076 |
| タイプ | feature |
| ステータス | TODO |
| 優先度 | Medium |
| 見積もり | 60分 |
| 依存タスク | TASK-073（SettingsModal競合回避のため順次）, TASK-071（クレジット対象の音源同梱後） |

## 背景

アプリをApache 2.0で公開するにあたり、アプリ内でバージョン・本体/ライブラリ/音源ライセンスを表示する必要がある（US-015 / DEC-008）。Salamanderのクレジット表記義務（REQ-013-008）の受け皿でもある。

設計: `docs/sdd/design/components/about-page.md`

## 実装内容

### 対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `LICENSE` | 新規。Apache License 2.0全文 |
| `scripts/generate-licenses.mjs` | 新規。`dependencies` を起点に `node_modules/*/package.json` と `LICENSE*` を走査し `src/renderer/src/generated/licenses.json` を出力（自前実装、外部ライブラリ不使用） |
| `package.json` | `"generate:licenses"` scripts追加、`predev` / `prebuild` フック結線 |
| `.gitignore` | `src/renderer/src/generated/` 追加 |
| `electron.vite.config.ts` | `define: { __APP_VERSION__: JSON.stringify(pkg.version) }` 追加（renderer） |
| `src/renderer/src/components/AboutPanel/index.tsx` | 新規。アプリ名・バージョン（`__APP_VERSION__`）・Apache 2.0・Salamanderクレジット・ライブラリ一覧（スクロールリスト、行クリックでライセンス本文アコーディオン展開） |
| `src/renderer/src/components/AboutPanel/credits.ts` | 新規。静的クレジット（本体Apache 2.0 / Salamander CC-BY 3.0） |
| `src/renderer/src/components/SettingsModal/index.tsx` | 「このアプリについて」セクション追加（AboutPanel表示） |
| `README.md` | ライセンスセクション（Apache 2.0 + Salamanderクレジット）追記 |
| 各テストファイル | テスト追加 |

### 実装手順（TDD）

1. generate-licenses のテスト（Red→コミット）: 生成関数を `scripts/` から関数exportし、フィクスチャで dependencies 全件が含まれ devDependencies が含まれないこと / licenseText が取得できること
2. AboutPanel.test.tsx（Red→コミット）: バージョン・「Apache License 2.0」・「Salamander」「Alexander Holm」「CC-BY 3.0」の表示 / ライブラリ行クリックで本文展開
3. 実装 → Green → コミット
4. `npm run dev` と `npm run build` の両方で licenses.json が自動生成されることを確認（predev/prebuild結線の検証）

## 受入基準

- [ ] 全テスト通過
- [ ] `licenses.json` 未生成の状態から `npm run dev` / `npm run build` が成功する（フック結線）
- [ ] 型定義: `__APP_VERSION__` の `declare` 追加で `npm run typecheck` 通過
- [ ] 実起動確認: 設定→このアプリについてでバージョン（package.jsonと一致）とライセンス一覧が表示される

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | Aboutページでアプリライセンス・バージョン・ライブラリライセンスを表示（ユーザー指示）、Apache 2.0で公開予定 |
| 設計判断として決定 | 自前走査スクリプト（DEC-008）、`__APP_VERSION__` define方式、SettingsModal内配置、生成物のgitignore |

## 対応要件

REQ-015-001 / REQ-015-002 / REQ-015-003 / REQ-015-004 / REQ-015-005 / REQ-013-008（Aboutページ側）
