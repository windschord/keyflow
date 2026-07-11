# TASK-089: 開発依存の既知脆弱性解消（textlint 15系ほか）

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-089 |
| タイプ | chore（セキュリティ強化） |
| ステータス | TODO |
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

- [ ] `npm audit`（省略オプションなし）が 0 vulnerabilities となる
- [ ] `npm run lint` が通過する
- [ ] `scripts/lint-jp-ts-comments.mjs` が従来どおり機能する（実行して確認）
- [ ] `npm run test` / `npm run typecheck` が通過する
- [ ] `dependencies`（本番依存）に変更がない

## テスト項目

- [ ] `npm audit` 0件
- [ ] 日本語コメントlintの実行結果が更新前と同等（既存コードで新規エラーが出ない）
- [ ] 既存ユニットテスト全件通過

## 情報の明確性

### 明示された情報

- 脆弱性5件の内訳と修正可能バージョン（`npm audit --json` 出力で確認済み）
- 本番依存に脆弱性がないこと（`npm audit --omit=dev` で確認済み）

### 不明/要確認の情報

- textlint 15系と現行prh等プラグインの互換性（実装時にリリースノートと実行確認で検証する）
