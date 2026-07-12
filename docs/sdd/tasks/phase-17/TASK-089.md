# TASK-089: 開発依存の既知脆弱性解消（textlint 15系ほか）

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-089 |
| タイプ | chore（セキュリティ強化） |
| ステータス | DONE |
| 優先度 | Low |
| 見積もり | 30分 |
| 依存タスク | なし（TASK-086〜088と並列実行可能） |

## 背景

### 問題の概要

2026-07-11のセキュリティ調査（`npm audit`）で、devDependenciesに既知脆弱性5件が検出された。

| パッケージ | 深刻度 | 内容 | 経路 |
|-----------|--------|------|------|
| flatted | high×2 | プロトタイプ汚染（GHSA-rf6f-7fwh-wjgh）、再帰DoS（GHSA-25h7-pfq9-p65f） | textlint → flat-cache → flatted |
| flat-cache / file-entry-cache | high×2 | 上記flattedへの依存 | textlint |
| js-yaml | moderate | マージキー処理の計算量DoS（GHSA-h67p-54hq-rp68） | @textlint/linter-formatter、prh |

本番依存（dependencies）の脆弱性は0件であり配布物への影響はないが、開発環境の健全性のため解消する。textlintの脆弱性は `textlint@15.7.1` へのメジャーアップデートで解消できる（`npm audit` の fixAvailable 情報）。

### 関連する仕様

- `scripts/lint-jp-ts-comments.mjs` — textlintを利用する日本語コメントチェックスクリプト（互換性確認対象）
- textlint設定ファイル（`.textlintrc` 等。実装時に配置を確認すること）

## 実装内容

### 修正対象

- ファイル: `package.json` / `package-lock.json`
  1. `textlint` を15系（15.7.1以上）へ更新する
  2. textlint関連プラグイン・ルール（prh等）も15系と互換のあるバージョンへあわせて更新する
  3. 残る js-yaml 系は `npm audit fix`（非破壊）で解消する
  4. 最終的に `npm audit`（devDependencies込み）が0件になることを確認する

### 注意事項

- textlint 15系はメジャーアップデートのため、設定ファイル形式・CLIオプション・Node.js要件の互換性を確認すること（[textlint 15リリースノート](https://github.com/textlint/textlint/releases)を参照）
- 更新後、`scripts/lint-jp-ts-comments.mjs` を実際に実行し、既存TypeScriptコメントのチェックが従来どおり機能する（誤検出・エラーなし）ことを確認する
- `npm audit fix --force` は使用しない（意図しないメジャー更新を避ける。textlintの更新はpackage.jsonの明示的な変更で行う）

## 実装手順

> 依存更新タスクのためTDDの新規テスト作成は不要。既存のテスト・lintスイートを回帰確認として使う。

1. textlint関連パッケージの現行バージョンと15系互換性を確認する
2. `package.json` を更新し `npm install` で lockfile を更新する
3. `npm audit fix` で残余（js-yaml系）を解消する
4. `npm audit` が0件であることを確認する
5. `npm run lint` / `scripts/lint-jp-ts-comments.mjs` の実行 / `npm run test` / `npm run typecheck` で回帰確認する
6. コミット

## 受入基準

- [x] `npm audit`（省略オプションなし）が 0 vulnerabilities となる
- [x] `npm run lint` が通過する
- [x] `scripts/lint-jp-ts-comments.mjs` が従来どおり機能する（実行して確認）
- [x] `npm run test` / `npm run typecheck` が通過する
- [x] `dependencies`（本番依存）に変更がない

## テスト項目

- [x] `npm audit` 0件
- [x] 日本語コメントlintの実行結果が更新前と同等（既存コードで新規エラーが出ない）
- [x] 既存ユニットテスト全件通過

## 情報の明確性

### 明示された情報

- 脆弱性5件の内訳と修正可能バージョン（`npm audit --json` 出力で確認済み）
- 本番依存に脆弱性がないこと（`npm audit --omit=dev` で確認済み）

### 不明/要確認の情報

- textlint 15系と現行prh等プラグインの互換性（実装時にリリースノートと実行確認で検証する）→ 実装時に検証済み（下記サマリー参照）

## 完了サマリー（2026-07-11）

### 変更内容

- `textlint`: `^13.4.0` → `^15.7.1`
- `textlint-rule-preset-ja-technical-writing`: `^10.0.0` → `^12.0.2`
- 残余の`js-yaml`系moderate脆弱性は `npm audit fix`（非破壊）で解消
- `package.json`のprh依存は元々存在せず（本タスク背景記載のprhは`@textlint/linter-formatter`経由の間接依存であり、textlint本体の更新で解消）

### npm audit結果

- 更新前: high 4件（flatted / flat-cache / file-entry-cache / textlint本体, すべてtextlint 15.7.1へのアップデートで解消可能）+ moderate 1件（js-yaml）
- 更新後: `npm audit` で **0 vulnerabilities**

### 互換性確認

- `.textlintrc.json`（`rules.preset-ja-technical-writing`形式）はtextlint 15系でもそのまま動作することを実行確認した
- `textlint --config .textlintrc.json` のCLIオプションも変更なく動作
- Node.js要件: textlint 15系は`engines.node: >=20.0.0`。本プロジェクトの`engines.node`（`^20.19.0 || >=22.12.0`）と実行環境（v22.19.0）はいずれも満たす
- prhプラグインは本プロジェクトのdevDependenciesに存在せず、互換性確認は不要だった（タスク背景の記載を実装時に精査し、直接依存していないことを確認）

### 回帰確認結果

- `npm run lint`（ESLint）: 通過
- `scripts/lint-jp-ts-comments.mjs`: 実行し、既存の2件のエラー（`usePractice.test.ts`・`App.test.tsx`内の全角括弧誤検知）を確認。旧バージョン（textlint 13.4.0 + preset 10.0.0）で同一の一時ファイルを検査し、更新前から存在する既知の誤検知であり新規エラーではないことを確認済み（本タスクのスコープ外）
- `npm run lint:jp:md`（受入基準外・参考確認）: 既存ドキュメント9件のエラーを確認したが、同様に旧バージョンでも同一の9件が検出されることを確認済み。新規エラーなし
- `npm run test`: 全55ファイル・777テスト成功
- `npm run typecheck`: エラーなし
- `dependencies`（本番依存）: 変更なし（`git diff`で確認済み）

### 残件

- なし（受入基準はすべて満たされた）
