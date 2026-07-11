# TASK-093: リリース成果物の完全性（SHA256チェックサム + build provenance attestation）

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-093 |
| タイプ | chore（サプライチェーン完全性） |
| ステータス | TODO |
| 優先度 | Medium |
| 見積もり | 50分 |
| 依存タスク | なし |

## 背景

### 問題の概要

2026-07-11の調査で、`.github/workflows/release.yml` のリリース経路に完全性検証手段が欠けていることが判明した（B-9）。

1. 成果物（.exe/.dmg/.zip）の**チェックサム・署名・provenance（attestation）が生成されない**ため、ダウンロード者が完全性を検証できない
2. コード署名は本Phaseのスコープ外（ユーザー承認済み。`identity: null` のまま維持）だが、**GitHub artifact attestation とSHA256チェックサムで代替の完全性保証を付与する**方針
3. CIは全ジョブ `npm ci --ignore-scripts` を使う。一方でリリースの `build-windows` / `build-macos` は素の `npm ci`（installスクリプト実行あり）であり、信頼境界が最も広い非対称になっている

### 関連する仕様

- `.github/workflows/release.yml` — 現行の3ジョブ構成（build-windows / build-macos / release）
- `docs/sdd/tasks/phase-16/TASK-085.md` — release.ymlの現行設計（SHAピン留め・単一Release集約）
- コード署名はスコープ外（TASK-085と同一方針、ユーザー再承認済み）

## 実装内容

### 修正対象

- ファイル: `.github/workflows/release.yml`
  1. **SHA256チェックサム生成**: `release` ジョブで、集約した全成果物の `SHA256SUMS.txt`（または各ファイルの `.sha256`）を生成し、`gh release create` の添付ファイルに含める。Windows成果物・macOS成果物の両方を対象にする
  2. **build provenance attestation**: `actions/attest-build-provenance`（コミットSHAピン留め）を各ビルドジョブに追加し、成果物の来歴証明を生成する。attestation生成には `permissions: id-token: write` と `attestations: write` が必要なため、当該ジョブに最小権限で付与する
  3. **リリースジョブの `--ignore-scripts` 検討**: `build-windows` / `build-macos` の `npm ci` へ `--ignore-scripts` を付けられるか検証する。electronバイナリ取得（`postinstall: node node_modules/electron/install.js`）が必要になる。
   このため `--ignore-scripts` にすると electron バイナリを取得できず、ビルド失敗につながる可能性がある。その場合は代替手段を検証する。例として「`npm ci --ignore-scripts` の後に `node node_modules/electron/install.js` を明示実行してelectronのinstallスクリプトのみ動かす」方法が挙げられる。可否を完了サマリーへ記録し、実現不可なら現状維持として理由を明記する
  4. 追加アクションはコミットSHAでピン留めする（既存方針）

### 注意事項

- 本タスクはCIワークフローの変更が主で、**実際のタグpushによる通し実行検証はユーザーの操作を要する**。ローカルでは `actionlint`（あれば）またはYAML構文チェックと、各ステップのコマンドを手元で（可能な範囲で）ドライ確認する
- attestation は公開リポジトリでは無料。生成された attestation は `gh attestation verify <file> --repo windschord/keyflow` で検証できる旨をREADMEまたはリリースノートに追記する
- チェックサム生成コマンドはOS非依存にする（`release` ジョブは ubuntu-latest のため `sha256sum` が使える）

## 実装手順

> CI設定変更のためTDDの新規ユニットテストは対象外。YAML妥当性と各コマンドの整合を確認する。

1. `release.yml` を読み、現行の3ジョブ構成とpermissionsを把握する
2. `release` ジョブにSHA256SUMS生成ステップと、添付対象への追加を実装する
3. `build-windows` / `build-macos` に `attest-build-provenance`（SHAピン留め、必要permissions付与）を追加する
4. `--ignore-scripts` 化の可否を検証し、結果に応じて実装または現状維持＋理由記録する
5. YAML構文を確認し、READMEに検証手順（`gh attestation verify` / SHA256照合）を追記する
6. コミットする

## 受入基準

- [ ] `release` ジョブが `SHA256SUMS.txt`（または各 `.sha256`）を生成しReleaseに添付する
- [ ] 各ビルドジョブに `actions/attest-build-provenance`（SHAピン留め・最小permissions）が追加されている
- [ ] リリースジョブの `--ignore-scripts` 化の可否が検証され、実装または理由記録されている
- [ ] 追加アクションがコミットSHAでピン留めされている
- [ ] READMEに成果物の完全性検証手順が追記されている
- [ ] `release.yml` がYAMLとして妥当である

## テスト項目

- [ ] `release.yml` のYAML構文が妥当（ローカルでパース確認）
- [ ] permissions が各ジョブで最小限（build側は id-token/attestations、release側は contents:write）
- [ ] SHA256生成コマンドが release ジョブ（ubuntu）で有効

## 情報の明確性

### 明示された情報

- 完全性検証手段の欠如（調査で確認済み）
- コード署名はスコープ外、attestation + SHA256で代替（ユーザー承認済み）
- 現行release.ymlの3ジョブ構成（TASK-085）

### 不明/要確認の情報

- リリースジョブの `--ignore-scripts` 化がelectronバイナリ取得と両立するか（実装時に検証。不可なら現状維持）
- タグpushによる通し実行の最終確認はユーザー操作が必要（残件として明記する）
