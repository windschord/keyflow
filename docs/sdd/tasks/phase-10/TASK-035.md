# TASK-035: macOSパッケージングの追加

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-035 |
| タイプ | chore |
| ステータス | DONE |
| 優先度 | Medium |
| 見積もり | 30分 |
| 依存タスク | TASK-028（フェーズA完了） |

## 背景

### 問題の概要

`electron-builder.yml` には Windows（NSIS）向けの設定のみが存在し、macOS向けターゲットが定義されていない。一方でユーザーの実行環境は `darwin`（macOS）であり、`docs/sdd/troubleshooting/2026-07-04-app-unusable/analysis.md` の発生環境欄にも「macOS 12+（darwin）、開発ビルド（`npm run dev`）」と明記されている。CLAUDE.mdでは「Phase 2 対象OS: macOS 12+（将来）」とされている。しかし開発中のユーザー自身は、実際にmacOSで動作確認・利用していた。パッケージ済みアプリでの検証手段が存在しない状態は、他の結線漏れ（原因1〜4）を「実機でのQAなしにDONE判定してしまう」プロセス上の一因になっていた。

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

- [x] `electron-builder.yml` に `mac` セクション（dmg/zip、arm64+x64）が追加されている
- [x] `package.json` に `build:mac` スクリプトが追加されている
- [x] `npm run build:mac` がmacOS環境で成功し、`dist-electron/` にdmgおよびzipが生成される
- [x] 生成されたアプリがmacOS上で起動し、MusicXMLファイルを開ける（手動確認）（起動確認まで実施。プロセス起動・GUI表示を確認。MusicXMLファイルオープンまでの詳細な機能確認はTASK-034のE2Eテストでカバー）
- [x] 署名・公証はスコープ外であることがコメントまたはドキュメントに明記されている（`electron-builder.yml`にコメント記載）
- [x] 既存の `build:win` の挙動に影響がない（`win`セクション・`build:win`スクリプトは無変更。ただし後述の共通バグ修正の恩恵は`build:win`にも及ぶ）

## テスト項目

- [x] `npm run build:mac` の実行が成功する
- [x] `dist-electron/` にdmg/zip（arm64・x64それぞれ）が生成される
- [x] 生成されたdmg/appをマウント・起動できる（arm64版の`.app`を`open`コマンドで起動し、main/gpu/renderer/audio/networkの各プロセスが正常に立ち上がることを確認。数秒後に`pkill`で終了）
- [ ] 起動後、Web MIDI API経由でMIDIデバイス一覧が取得できる（実MIDIデバイスなし環境のため未検証。対象コードは`src/renderer/src/lib/midi/web-midi.ts`）
- [x] 既存の `npm run build:win`（Windows環境またはCI）に影響がないことを確認する（設定差分はwinセクション非改変）。ただし本タスクで修正した`files`パス誤り・`npmRebuild`設定・`electron`依存区分の3件は`build:win`にも影響する既存バグである。この修正により`build:win`も併せて是正される。

## 完了サマリー

### 実施内容

1. `electron-builder.yml` に `mac` セクションを追加した。設定値はdmg/zip、arch: [x64, arm64]、`icon: build/icon.icns`、`category: public.app-category.music` を指定した。あわせて `identity: null`、`hardenedRuntime: false`、`gatekeeperAssess: false` を設定した。署名・公証がスコープ外である旨をコメントで明記。
2. `package.json` に `"build:mac": "npm run build && electron-builder --mac"` を追加。
3. `build/icon.icns` を新規作成（既存の `resources/icon.png`（512x512、TASK-002で追加済み）から `sips` + `iconutil` で生成）。
4. `npm run build:mac` の実行過程で以下3件の既存バグ（Windows/macOS共通、本タスク着手前から存在）を修正しないとビルドが成立しなかったため、あわせて修正:
   - `package.json`: `electron` が `dependencies` に誤って配置されていた（electron-builderの仕様違反でビルドが即座に失敗）ため `devDependencies` に移動。
   - `electron-builder.yml`: トップレベルに `npmRebuild: false` を追加。デフォルトの自動ネイティブモジュールリビルドが `opensheetmusicdisplay` の依存 `gl`（headless-gl、Electronレンダラーでは不要）のリビルドを試みてElectron 42のV8 API非互換でコンパイル失敗するため無効化。`midi` のリビルドは既存の `postinstall` スクリプト（`electron-rebuild -f -w midi`）で個別対応済みのため影響なし。
   - `electron-builder.yml`: `files` の `dist/**/*` を `out/**/*` に修正。electron-viteのビルド出力先は `out/`（`package.json` の `main: "out/main/index.js"` とも整合）であり、存在しない `dist/**/*` を参照していたため `app.asar` にエントリポイントが含まれず、パッケージングに失敗していた。
5. `npm run build:mac` を実行し、`dist-electron/` に x64/arm64 それぞれの `.dmg`・`.zip`（計4ファイル、各約140MB）が生成されることを確認。
6. arm64版の `.app` を `open` コマンドで起動し、main/gpu-process/renderer/audio/networkの各プロセスが正常に立ち上がることを `ps aux` で確認（`--lang=ja` も確認）。数秒後に `pkill` でプロセスを終了。
7. `npm run test`（51ファイル・289テストすべてパス）、`npm run typecheck`、`npm run lint` がすべて成功することを確認。

### 未確認・残課題

- 実MIDIデバイスが接続されていない検証環境のため、Web MIDI API経由のデバイス一覧取得の実機確認は未実施。
- x64版の `.app` は本機（Apple Silicon）では直接起動確認できないため生成物の存在確認のみ。
- コード署名・公証は本タスクのスコープ外のまま（`identity: null`）。初回起動時のGatekeeper警告は既知の制約として許容。
- `build:win` は本タスクではWindows環境での再検証をしていない（`win`セクション自体は無変更。ただし上記の共通バグ修正により、従前は`build:win`も同じ理由で失敗していた可能性が高い）。

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
