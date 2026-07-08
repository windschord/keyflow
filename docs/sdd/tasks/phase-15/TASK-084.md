# TASK-084: [BugFix] パッケージ版でメインウィンドウが表示されない問題の修正

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-084 |
| タイプ | bugfix |
| ステータス | REVIEW |
| 優先度 | Critical |
| 見積もり | 50分 |
| 依存タスク | TASK-080, TASK-083 |

## 背景

### 問題の概要

dmg版でメニューバーのアプリ名は表示されるがメインウィンドウが表示されない（2026-07-08ユーザー実機報告。ローカルの実バイナリ起動で再現・原因確定済み）。

（分析レポート: `docs/sdd/troubleshooting/2026-07-08-packaged-no-window/analysis.md`）

### 根本原因

`applyDockIcon`（TASK-080）がパッケージ版でapp.asar内のicon.pngパスに対し `dock.setIcon()` を呼んで例外を送出し、`app.whenReady().then()` 内の `createWindow()` より前で処理が中断される。

## 実装内容（承認済み方針A: 三重防御）

### 修正対象

| ファイル | 変更内容 |
|---------|---------|
| `src/main/index.ts` | (1) `createWindow()` とIPCハンドラ登録を装飾的な処理より前へ移動し、起動の主目的（ウィンドウ表示）を最優先にする。(2) `applyDockIcon` は開発モード時のみ呼ぶ（`is.dev`。パッケージ版はicns自動適用のため不要） |
| `src/main/dock-icon.ts` | `dock.setIcon()` をtry/catchで防御し、失敗時は `console.warn` のみで継続（装飾処理の失敗でウィンドウ生成を止めない）。コメントの「常時呼んでも害はない」という誤った記述を実態（パッケージ版ではasarパスで失敗する）へ是正 |
| `src/main/dock-icon.test.ts` | 追加: setIconが例外を投げても関数が例外を伝播しない / warnが出る |
| `src/main/index` 相当のテスト | 起動順序（createWindowが装飾処理より先）の検証が可能なら追加（純関数化されていない場合はE2E/スモークで担保し、その旨を記載） |
| `scripts/smoke-packaged-app.mjs`（新規） | パッケージ版起動スモークテスト: `dist-electron/mac-arm64/keyflow.app/Contents/MacOS/keyflow` をPlaywright `_electron.launch({executablePath})` で起動し、(a) firstWindowが出現する (b) `page.title()` が「keyflow」 (c) stderrにUnhandledPromiseRejectionが出ていない、を検証して終了。`npm run test:packaged` として登録（`build:mac` 実行後にローカルで走らせる前提。CI組み込みは対象外） |
| `README.md` または `CLAUDE.md` | リリース前チェックとして `build:mac` → `test:packaged` の手順を1行追記 |

### 実装手順（TDD）

1. dock-icon.test.ts に例外防御のテスト追加（Red確認→テストコミット）
2. dock-icon.ts / index.ts 修正 → ユニットGreen
3. `npm run build:mac`（CSC_IDENTITY_AUTO_DISCOVERY=false）→ `npm run test:packaged` でウィンドウ出現を確認（修正前は失敗することも確認できればなお良い）
4. 全ゲート（test / typecheck / lint / format:check / lint:jp / test:e2e）→ コミット

## 受入基準

- [x] パッケージ版バイナリ起動でメインウィンドウが表示される（test:packaged通過）
- [x] 起動ログにUnhandledPromiseRejectionが出ない
- [x] 開発モードのDockアイコン適用（TASK-080の機能）が維持される（`is.dev`分岐は既存のTASK-080テストで検証済み。パッケージ版では呼び出し自体を行わない）
- [x] 全ゲート通過（test / typecheck / lint / format:check / lint:jp / test:e2e）
- [ ] ユーザー実機確認（新しいdmgでウィンドウ表示）

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | 事象・根本原因（実バイナリで確定）・修正方針A（ユーザー承認済み、2026-07-08） |
| 設計判断として決定 | スモークテストはローカル実行前提（CIはmacビルド環境がないため対象外）、npm scripts名 test:packaged |

## 対応要件

REQ-011-002（開発モード限定の充足へ整理） / US-010ほか全機能（ウィンドウ表示は前提機能）
