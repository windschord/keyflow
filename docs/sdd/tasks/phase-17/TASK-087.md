# TASK-087: ウィンドウナビゲーション強化（openExternalスキーム検証・will-navigate・sandbox試行）

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-087 |
| タイプ | fix（セキュリティ強化） |
| ステータス | TODO |
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
  - `isAllowedNavigationUrl(url: string, devServerUrl: string | undefined): boolean` — 開発時のHMR URL（`ELECTRON_RENDERER_URL` 配下）および本番の `file:` プロトコル（自身のindex.html）のみ true
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

- [ ] `shell.openExternal` に渡るURLが http/https のみに制限されている（テストで検証）
- [ ] `will-navigate` で許可外ナビゲーションが `preventDefault` される
- [ ] 開発モード（HMR）と本番（loadFile）の両方でアプリが正常動作する
- [ ] sandbox: true の採否が検証結果に基づいて決定され、完了サマリーに記録されている
- [ ] `npm run test` / `npm run typecheck` / `npm run lint` / `npm run test:e2e` がすべて通過する

## テスト項目

- [ ] `isAllowedExternalUrl`: `https://example.com` → true、`http://example.com` → true、`file:///etc/passwd` → false、`smb://host/share` → false、`javascript:alert(1)` → false、空文字/不正URL → false
- [ ] `isAllowedNavigationUrl`: devサーバーURL配下 → true、`file:` → true、外部 `https://` → false
- [ ] E2E: 既存スイート全件通過（ナビゲーション制御追加によるリグレッションなし）

## 情報の明確性

### 明示された情報

- `setWindowOpenHandler` の現実装（`src/main/index.ts:30-33`、実ファイル確認済み）
- `will-navigate` 未実装であること（調査エージェントによる全体検索で確認済み）
- 許可スキームは http/https のみ（ユーザー承認済みの修正方針。アプリ内に mailto 等の利用箇所はない）

### 不明/要確認の情報

- sandbox: true でpreload（`@electron-toolkit/preload` / `webUtils`）が動作するか（本タスク内で実測検証し採否を決める方針をユーザーが承認済み）
