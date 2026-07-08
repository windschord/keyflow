# TASK-085: リリースワークフローへのmacOSビルドジョブ追加

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-085 |
| タイプ | chore |
| ステータス | REVIEW |
| 優先度 | Medium |
| 見積もり | 40分 |
| 依存タスク | TASK-035（macOSパッケージング基盤） |

## 背景

### 問題の概要

`.github/workflows/release.yml` はタグ（`v*`）のpush時に `windows-latest` ランナーで `npm run build:win` を実行し、NSISインストーラー（.exe）のみをGitHub Releaseへ添付している。一方、TASK-035で `npm run build:mac` スクリプトと `electron-builder.yml` の `mac` セクション（dmg/zip、x64+arm64）は整備済みだが、CIからは呼び出されておらず、macOS向け成果物はローカルビルドでしか得られない。ユーザーの実行環境はmacOSであり、リリースのたびに手元でビルドする運用は再現性・配布性の面で望ましくない。

### 関連する仕様

- `docs/sdd/tasks/phase-10/TASK-035.md` — macOSパッケージング（`build:mac`・`mac`セクション・`icon.icns`）の整備。本タスクはそのCI組み込みに相当する。
- `electron-builder.yml` — `identity: null`（未署名）のため、CI上でもApple Developer証明書なしでビルドが完結する。署名・公証（Notarization）は引き続きスコープ外。
- CLAUDE.md「Phase 2 対象OS: macOS 12+（将来）」— 本タスクは配布基盤の整備であり、macOS向け機能要件の正式化ではない。

## 実装内容

### 修正対象

- ファイル: `.github/workflows/release.yml`
  - 変更内容: ジョブ構成を「ビルド2並列 + リリース作成1」の3ジョブへ再編する。
    1. `build-windows`（windows-latest）: `npm run build:win` を実行し、`dist-electron/*.exe` をartifactとしてアップロードする。
    2. `build-macos`（macos-latest）: `npm run build:mac` を実行し、`dist-electron/*.dmg` と `dist-electron/*.zip` をartifactとしてアップロードする。
    3. `release`（ubuntu-latest、`needs: [build-windows, build-macos]`）: 両ジョブのartifactをダウンロードし、`gh release create` で全成果物を添付した単一のReleaseを作成する。

### 実装手順

1. 既存の `release-windows` ジョブを `build-windows` に改名し、Release作成ステップを削除して `actions/upload-artifact` によるアップロードステップへ置き換える。
2. `build-macos` ジョブを追加する。`macos-latest`（Apple Siliconランナー）上で `npm ci` → `npm run build:mac` を実行する。`electron-builder.yml` は `npmRebuild: false` でありネイティブモジュールのクロスコンパイルが発生しないため、arm64ランナー上でx64向けdmg/zipも生成できる（TASK-035でApple Silicon実機により確認済みの挙動と同一）。
3. `release` ジョブを追加する。`actions/download-artifact`（`merge-multiple: true`）で全成果物を1ディレクトリへ集約し、既存と同じ `gh release create --generate-notes` で添付する。
4. 追加するアクション（upload-artifact / download-artifact）は既存記述と同様にコミットSHAでピン留めする。

### 注意事項

- Release作成を単一ジョブへ集約するのは、WindowsとmacOSの2ジョブが同一タグへ同時に `gh release create` を実行して競合するのを避けるためである。
- コード署名・公証は本タスクのスコープ外のまま（`identity: null`）。未署名ビルドのため初回起動時にGatekeeper警告が出るが、既知の制約として許容する（TASK-035と同一方針）。
- macOSランナーはGitHub Actionsの課金分数消費がLinuxの10倍換算だが、タグpush時のみの実行であり影響は限定的とする。
- `permissions: contents: write` はRelease作成に必要なため維持する。ビルドジョブ側はartifactアップロードのみで書き込み権限を使用しない。

## 受入基準

- [x] `release.yml` に `build-macos` ジョブ（macos-latest、`npm run build:mac`）が追加されている
- [x] Windows（.exe）とmacOS（.dmg/.zip）の成果物が単一のGitHub Releaseに添付される構成である
- [x] Release作成が単一ジョブに集約され、複数ジョブによる同一タグへのRelease作成競合が発生しない
- [x] 追加アクションがコミットSHAでピン留めされている（既存記述と同一方針）
- [x] 既存のWindowsビルド手順（`npm ci` → `npm run build:win`）に変更がない

## テスト項目

- [x] `release.yml` がYAMLとして構文妥当である（ローカルでパース確認）
- [x] `npm run build:mac` がローカルmacOS環境で成功し、`dist-electron/` にdmg/zip（x64・arm64）が生成される（CIジョブと同一コマンドの事前検証）
- [ ] タグ（`v*`）push時にワークフローが起動し、3ジョブすべてが成功してReleaseに .exe/.dmg/.zip が添付される（次回リリースタグ発行時に確認する運用検証）

## 完了サマリー

### 実施内容

1. `release.yml` を3ジョブ構成（`build-windows` / `build-macos` / `release`）へ再編した。
2. ビルド2ジョブは並列実行され、成果物を `actions/upload-artifact`（v4.6.2、SHAピン留め）でアップロードする。`if-no-files-found: error` を指定し、成果物が生成されなかった場合はジョブを失敗させる。
3. `release` ジョブは `actions/download-artifact`（v4.3.0、SHAピン留め、`merge-multiple: true`）で成果物を集約し、`gh release create --generate-notes` で単一Releaseに全ファイルを添付する。
4. ローカルmacOS環境で `npm run build:mac` を実行し、dmg/zip（x64・arm64）の生成を確認した。

### 未確認・残課題

- 実際のタグpushによるワークフロー全体の通し実行は、次回リリースタグ発行時に確認する。
- コード署名・公証は引き続きスコープ外。将来対応する場合は別タスクで `hardenedRuntime` とあわせて見直す。

## 情報の明確性

### 明示された情報

- `release.yml` がWindowsのみ対応であること（実ファイル確認済み）
- `build:mac` スクリプトと `mac` セクションが整備済みであること（TASK-035、実ファイル確認済み）
- 未署名ビルド（`identity: null`）のためCI上で署名情報が不要であること
- ユーザーがmacOSビルドのCI追加を承認したこと（AskUserQuestionで確認済み）

### 不明/要確認の情報

- タグpushによる通し実行の成否は次回リリース時まで確認できない（テスト項目に運用検証として明記）
