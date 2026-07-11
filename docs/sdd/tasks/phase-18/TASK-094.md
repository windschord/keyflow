# TASK-094: 依存自動更新体制（Dependabot）とElectronパッチ更新

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-094 |
| タイプ | chore（サプライチェーン・脆弱性管理） |
| ステータス | DONE |
| 優先度 | Low |
| 見積もり | 30分 |
| 依存タスク | なし |

## 背景

### 問題の概要

2026-07-11の調査で、以下が判明した。

1. `.github/dependabot.yml`（依存自動更新設定）が未配置で、依存パッケージ・GitHub Actionsの脆弱性追随が手動任せになっている
2. Electron が `42.4.1`（現行）で、同メジャーの `42.6.1` へのパッチ更新余地がある。現行でも既知のDependabotアラート（use-after-free等多数）は解消済みだが、パッチ追随が望ましい

### 関連する仕様

- `.github/workflows/ci.yml` / `release.yml` — Actionsのバージョン追随対象
- `package.json` — electron ^42.4.1
- 調査所見: B-6/B-9補足（Electronパッチ更新余地・自動更新未設定）

## 実装内容

### 修正対象

- ファイル: `.github/dependabot.yml`（新規）
  - `package-ecosystem: npm`（ルート、weekly）と `package-ecosystem: github-actions`（weekly）の2エコシステムを設定する
  - `open-pull-requests-limit` を控えめ（例: 5）に設定する
  - セキュリティ更新は既定で有効。バージョン更新のノイズを抑えたい場合はグルーピング（例: devDependencies をまとめる）を検討してもよい
- ファイル: `package.json` / `package-lock.json`
  - electron を `42.4.1` → `42.6.1`（同メジャー最新パッチ）へ更新する。`npm install electron@^42.6.1` 相当
  - 更新後にビルド・型・テストの回帰確認を行う

### 注意事項

- Electronのメジャー更新（43.x）は互換性影響が大きいためスコープ外。**同メジャーのパッチ更新のみ**に留める
- electron更新後は `npm run build`（electron-vite build）と可能なら `npm run test:e2e` で起動回帰を確認する。E2E初回は `npx playwright install chromium` が必要な場合がある
- dependabot.yml は設定ファイルのため、マージ後にGitHub側で有効化される。ローカルでは構文（YAML妥当性・schema準拠）を確認する
- SHAピン留め方針（既存Actions）とDependabotのactions更新は両立する（DependabotはピンされたSHAをコメントのバージョンごと更新するPRを出す）

## 実装手順

> 設定追加・依存パッチ更新のためTDDの新規テストは対象外。既存スイートを回帰確認に使う。

1. `.github/dependabot.yml` を作成する（npm + github-actions、weekly）
2. electron を `^42.6.1` へ更新し lockfile を更新する
3. `npm run typecheck` / `npm run test` / `npm run build` で回帰確認する（可能なら `npm run test:e2e` も）
4. `npm audit` に新規脆弱性が出ていないことを確認する
5. コミットする

## 受入基準

- [x] `.github/dependabot.yml` が npm と github-actions の2エコシステムを weekly で設定している
- [x] electron が `^42.6.1`（同メジャー最新パッチ）へ更新されている
- [x] `npm run typecheck` / `npm run test` / `npm run build` が通過する
- [x] `npm audit` に新規の脆弱性が増えていない
- [x] dependabot.yml がYAMLとして妥当である

## テスト項目

- [x] dependabot.yml のYAML構文・schema妥当性
- [x] electron 42.6.1 でビルド・型・既存テストが通過
- [ ] （可能なら）E2E起動回帰が通過 → TASK-095の統合検証でまとめて実施する

## 情報の明確性

### 明示された情報

- dependabot.yml未配置・electronパッチ更新余地（調査で確認済み）
- メジャー更新（43.x）はスコープ外、パッチ更新のみ

### 不明/要確認の情報

- 特になし（パッチ更新のため互換性リスクは小。回帰確認で担保する）

## 完了サマリー（2026-07-11）

### 実装内容

- `.github/dependabot.yml` を新設。`npm`（ルート）と `github-actions` の2エコシステムを
  weekly で更新する。`open-pull-requests-limit: 5`。npmのdevDependenciesはminor/patchを
  グループ化してPRノイズを抑える
- `package.json` / `package-lock.json`: electron を `^42.4.1` → `^42.6.1` へ更新
  （インストール版も 42.6.1）。メジャー更新（43.x）はスコープ外

### 検証結果

- `dependabot.yml`: js-yamlでパースし version 2・2エコシステムを確認
- `npm run typecheck`: 通過
- `npm run test`: 759件全通過
- `npm run build`（electron-vite build）: 成功
- `npm audit`: 本番依存（`--omit=dev`）0件。全体では既存のtextlint系5件のみで、
  electron更新による新規の脆弱性増加はなし（textlint系はPhase 17 / TASK-089で解消予定）

### 残件

- E2E起動回帰（`npm run test:e2e`）はTASK-095の統合検証でまとめて確認する
- Phase 18ブランチはmain基点のため、textlint系5件の脆弱性はこのブランチには残る
  （Phase 17 PRのマージで解消。本タスクのスコープ外）
