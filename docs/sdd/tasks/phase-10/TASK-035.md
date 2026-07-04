# TASK-035: macOSパッケージングの追加

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-035 |
| タイプ | chore |
| ステータス | TODO |
| 優先度 | Medium |
| 見積もり | 30分 |
| 依存タスク | TASK-028（フェーズA完了） |

## 背景

### 問題の概要

`electron-builder.yml` には Windows（NSIS）向けの設定のみが存在し、macOS向けターゲットが定義されていない。一方でユーザーの実行環境は `darwin`（macOS）であり、`docs/sdd/troubleshooting/2026-07-04-app-unusable/analysis.md` の発生環境欄にも「macOS 12+（darwin）、開発ビルド（`npm run dev`）」と明記されている。CLAUDE.mdでは「Phase 2 対象OS: macOS 12+（将来）」とされているが、開発中のユーザー自身が実際にはmacOSで動作確認・利用しており、パッケージ済みアプリでの検証手段が存在しない状態が、他の結線漏れ（原因1〜4）を「実機でのQAなしにDONE判定してしまう」プロセス上の一因になっていた。

### 根本原因

- `analysis.md:37` 「環境: macOS 12+（darwin）、開発ビルド（`npm run dev`）」
- `analysis.md:91` 「パッケージングはWindows NSISのみでユーザー環境（macOS）では未検証。」
- `electron-builder.yml:9-14` に `win` セクションのみが存在し、`mac` セクションが定義されていない（実ファイル確認済み）。
- `package.json:13` の `build:win` スクリプトのみが存在し、`build:mac` に相当するスクリプトがない（実ファイル確認済み）。

### 関連する仕様

- CLAUDE.md「Phase 2 対象OS: macOS 12+（将来）」— 本タスクはパッケージング基盤の先行整備であり、Phase 2の正式な機能要件化・署名/公証対応そのものではない。
- `docs/sdd/tasks/phase-7/TASK-021.md`（electron-builder設定・Windows NSISインストーラー）— 本タスクはこのタスクのmacOS版に相当する。
- `docs/sdd/requirements/nfr/compatibility.md`（NFR-C-006〜010、Windows向けの互換性要件が中心）。macOS向けの同等要件は未定義であり、Phase 2の要件定義で別途扱う。

## 実装内容

### 修正対象

- ファイル: `electron-builder.yml`
  - 変更内容: `mac` セクションを追加し、`target: dmg` および `target: zip`、`arch: [arm64, x64]` を設定する。アイコンは `build/icon.icns`（新規または既存流用）を指定する。
- ファイル: `package.json`
  - 変更内容: `"build:mac": "npm run build && electron-builder --mac"` スクリプトを追加する。
- ファイル: `build/icon.icns`（未存在の場合は新規追加）
  - 変更内容: macOS用アイコンファイルを配置する。

### 実装手順

1. `electron-builder.yml` に以下のような `mac` セクションを追加する。

   ```yaml
   mac:
     target:
       - target: dmg
         arch: [x64, arm64]
       - target: zip
         arch: [x64, arm64]
     icon: build/icon.icns
     category: public.app-category.music
     hardenedRuntime: false
     gatekeeperAssess: false
   ```

2. `build/icon.icns` が存在しない場合は、既存の `build/icon.ico` 等から変換するか仮アイコンを配置する（本番品質のアイコン制作は本タスクのスコープ外）。
3. `package.json` の `scripts` に `"build:mac": "npm run build && electron-builder --mac"` を追加する。
4. `node-midi`（`midi` パッケージ、ネイティブモジュール）のmacOSビルドが `postinstall` の `electron-rebuild -f -w midi` で正しく動作することを確認する。arm64/x64のクロスビルドで問題が出る場合は、暫定的に実行環境と同一アーキテクチャのみでのローカル検証に留め、その旨を注意事項に記載する。
5. `npm run build:mac` を実行し、`dist-electron/` にdmg/zipが生成されることを確認する（ローカルmacOS環境での実行確認）。
6. 生成物からアプリを起動し、最低限「起動してMusicXMLを開ける」ことを手動確認する。

### 注意事項

- コード署名（Apple Developer証明書によるcodesign）およびNotarization（公証）は本タスクのスコープ外とする。署名なしの場合、macOS Gatekeeperにより初回起動時に警告が出るが、これは既知の制約として許容する。
- `hardenedRuntime` はNotarizationを行わない前提で `false` とする。将来Notarizationに対応する場合は別タスクで見直す。
- `node-midi`のネイティブバイナリはアーキテクチャ依存（x64/arm64）のため、`electron-rebuild`がユニバーサルビルドに対応しない場合、arm64版とx64版を別々にビルドする運用になる可能性がある。CIでのクロスビルドが困難な場合はローカルビルドのみとし、その旨をREADMEに記載する。
- Windows向け設定（`win`セクション、`build:win`スクリプト）には手を加えない。

## 受入基準

- [ ] `electron-builder.yml` に `mac` セクション（dmg/zip、arm64+x64）が追加されている
- [ ] `package.json` に `build:mac` スクリプトが追加されている
- [ ] `npm run build:mac` がmacOS環境で成功し、`dist-electron/` にdmgおよびzipが生成される
- [ ] 生成されたアプリがmacOS上で起動し、MusicXMLファイルを開ける（手動確認）
- [ ] 署名・公証はスコープ外であることがコメントまたはドキュメントに明記されている
- [ ] 既存の `build:win` の挙動に影響がない

## テスト項目

- [ ] `npm run build:mac` の実行が成功する
- [ ] `dist-electron/` にdmg/zip（arm64・x64それぞれ、またはユニバーサル）が生成される
- [ ] 生成されたdmgをマウントしてアプリをインストール・起動できる
- [ ] 起動後、Web MIDI API経由でMIDIデバイス一覧が取得できる（node-midiは未結線のため対象外、`src/renderer/src/lib/midi/web-midi.ts`の動作確認）
- [ ] 既存の `npm run build:win`（Windows環境またはCI）に影響がないことを確認する

## 情報の明確性

### 明示された情報

- ユーザーの実行環境がmacOS（darwin）であること（`analysis.md:37`）
- 現状 `electron-builder.yml` にはWindows NSISターゲットのみが存在すること（実ファイル確認済み、`electron-builder.yml:9-14`）
- `package.json` に `build:win` のみが存在し `build:mac` がないこと（実ファイル確認済み、`package.json:13`）
- macターゲットはdmg/zip、arch: arm64+x64
- npmスクリプト名は `build:mac`
- 署名・公証はスコープ外

### 不明/要確認の情報

- macOS用アイコン（`build/icon.icns`）が既に用意されているか未確認。未存在の場合は仮アイコンで代替する
- `node-midi`のarm64/x64クロスビルドがローカル環境（実行アーキテクチャ）でのみ可能か、CI（`ubuntu-latest`はmacOSビルド不可のため対象外）でのmacOSビルド環境が別途必要かは、実施時にローカルmacOS環境で確認する
