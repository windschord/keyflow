# TASK-087: ウィンドウナビゲーション強化（openExternalスキーム検証・will-navigate・sandbox試行）

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-087 |
| タイプ | fix（セキュリティ強化） |
| ステータス | DONE |
| 優先度 | Medium |
| 見積もり | 30分 |
| 依存タスク | TASK-086（`src/main/index.ts` を共有するため順次実行） |

## 背景

### 問題の概要

2026-07-11のセキュリティ調査で以下2点が判明した。

1. `src/main/index.ts:30-33` の `setWindowOpenHandler` が、受け取ったURLをスキーム検証なしで `shell.openExternal` に渡している。`file://` や任意のカスタムスキームもOSに渡され得る
2. `will-navigate` ハンドラが未実装で、メインウィンドウ自体のトップナビゲーション（`location.href` 書き換え等）を阻止する層がない

いずれも悪用にはレンダラーのコード実行が前提（CSPで塞がれている）だが、多層防御として標準的なElectronハードニングを適用する。

### 関連する仕様

- [Electron公式セキュリティチェックリスト](https://www.electronjs.org/docs/latest/tutorial/security)（12: ナビゲーション制限、13: 新規ウィンドウ制御、14: openExternalの検証）
- CLAUDE.md「Electronセキュリティ設定」節

## 実装内容

### 修正対象

- ファイル: `src/main/navigation-policy.ts`（新規）
  - `isAllowedExternalUrl(url: string): boolean` — `new URL(url).protocol` が `http:` / `https:` の場合のみ true。パース失敗時は false
  - `isAllowedNavigationUrl(url: string, devServerUrl: string | undefined): boolean` を用意する。
    開発時のHMR URL（`ELECTRON_RENDERER_URL` 配下）と本番の `file:` プロトコルのみ true とする
  - 純関数として実装し、Electron APIに依存させない（ユニットテスト容易性のため。`window-options.ts` と同じ既存パターン）
- ファイル: `src/main/navigation-policy.test.ts`（新規）
- ファイル: `src/main/index.ts`
  - `setWindowOpenHandler` 内で `isAllowedExternalUrl` を通過したURLのみ `shell.openExternal` に渡す
  - `mainWindow.webContents.on('will-navigate', ...)` を追加し、`isAllowedNavigationUrl` を満たさないナビゲーションを `event.preventDefault()` で拒否する

### sandbox: true の試行（同タスク内・採否は検証結果次第）

- `webPreferences.sandbox: false` を `true` に変更して以下を検証する:
  1. `npm run dev` でアプリが起動し、ファイルオープン・再生・設定保存が機能する（preloadの `ipcRenderer` / `webUtils` / `@electron-toolkit/preload` がsandbox下で動作するか）
  2. `npm run test:e2e` が全件通過する
- いずれかが失敗する場合は `sandbox: false` のまま維持し、本タスクの完了サマリーに失敗内容と理由を記録する（無理な採用はしない）

## 実装手順（TDD）

1. テスト作成: `src/main/navigation-policy.test.ts`（https許可・http許可・file拒否・カスタムスキーム拒否・不正文字列拒否・devサーバーURL許可・外部httpナビゲーション拒否）
2. テスト実行: `npm run test` で失敗を確認
3. テストコミット
4. 実装: `navigation-policy.ts` を実装し、`index.ts` へ結線
5. sandbox: true を試行し、dev起動確認と `npm run test:e2e` で採否を判定
6. `npm run test` / `npm run typecheck` / `npm run lint` 通過を確認しコミット

## 受入基準

- [x] `shell.openExternal` に渡るURLが http/https のみに制限されている（テストで検証）
- [x] `will-navigate` で許可外ナビゲーションが `preventDefault` される
- [x] 開発モード（HMR）と本番（loadFile）の両方でアプリが正常動作する
- [x] sandbox: true の採否が検証結果に基づいて決定され、完了サマリーに記録されている
- [x] `npm run test` / `npm run typecheck` / `npm run lint` / `npm run test:e2e` がすべて通過する

## テスト項目

- [x] `isAllowedExternalUrl` の許可: `https://example.com` → true、`http://example.com` → true
- [x] `isAllowedExternalUrl` の拒否: `file:///etc/passwd`・`smb://host/share`・`javascript:alert(1)`・空文字/不正URL → いずれも false
- [x] `isAllowedNavigationUrl`: devサーバーURL配下 → true、`file:` → true、外部 `https://` → false
- [x] E2E: 既存スイート全件通過（ナビゲーション制御追加によるリグレッションなし）

## 完了サマリー（2026-07-11）

### 実装内容

- `src/main/navigation-policy.ts`（新規）: `isAllowedExternalUrl`（http/httpsのみ許可）、
  `isAllowedNavigationUrl`（開発時HMR URLと同一オリジン、またはfile:プロトコルのみ許可）を
  Electron API非依存の純粋関数として実装。テスト14件（`navigation-policy.test.ts`）
- `src/main/index.ts`: `setWindowOpenHandler`に`isAllowedExternalUrl`を適用し、
  `will-navigate`ハンドラを新設して`isAllowedNavigationUrl`を満たさないナビゲーションを
  `event.preventDefault()`で拒否

### sandbox: true の採否 — 採用

以下の検証結果に基づき `sandbox: true` を採用した（是正前は `sandbox: false`）。

1. `npm run dev`: `--enable-sandbox`フラグ付きでレンダラープロセスが正常起動し、クラッシュなし
2. `npm run test:e2e`: sandbox: true状態で全4件通過。`file:read`・`file:register-dropped-file`・
   `settings:get`等、preload（`@electron-toolkit/preload`・`webUtils`・`contextBridge`）経由の
   IPC呼び出しがすべて正常動作することを実証した

### 派生して発見・修正した既存不具合（TASK-086由来、本タスクのスコープ外だが完了条件のため対応）

E2E検証中、`tests/e2e/app.spec.ts`のメインシナリオがsandbox設定に関わらず失敗することを発見した。
失敗したのはファイルオープンから楽譜表示までの流れである。
原因はTASK-086で`file:read`系IPCにPathAllowlist検証が導入された点にある。
このE2Eが使う`file:show-open-dialog`モックは固定パスを返すだけの簡易実装で、
本物の`createShowOpenDialogHandler`が行う`pathAllowlist.allowMusicXml`登録を再現していなかった。
そのため以後の`file:read`が拒否されていた（本番のダイアログ経由フローには影響なし、E2Eモックの結線漏れ）。
本物の`file:register-dropped-file` IPC経由でallowlist登録を補う形で`tests/e2e/app.spec.ts`を修正し解消した。

### 完了条件の確認

- `npm run test`: 772件全通過
- `npm run typecheck`: 通過
- `npm run lint`: 通過
- `npm run test:e2e`: 4件全通過（sandbox: true状態）

## 情報の明確性

### 明示された情報

- `setWindowOpenHandler` の現実装（`src/main/index.ts:30-33`、実ファイル確認済み）
- `will-navigate` 未実装であること（調査エージェントによる全体検索で確認済み）
- 許可スキームは http/https のみ（ユーザー承認済みの修正方針。アプリ内に mailto 等の利用箇所はない）

### 不明/要確認の情報

- sandbox: true でpreload（`@electron-toolkit/preload` / `webUtils`）が動作するか（本タスク内で実測検証し採否を決める方針をユーザーが承認済み）
