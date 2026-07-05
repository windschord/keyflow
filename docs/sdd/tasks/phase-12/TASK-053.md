# TASK-053: ドラッグ＆ドロップでのファイルオープン

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-053 |
| タイプ | feature |
| ステータス | TODO |
| 優先度 | Medium |
| 見積もり | 50分 |
| 依存タスク | なし |

## 背景

### 問題の概要

MusicXMLファイルをウィンドウへドラッグ＆ドロップしても開けない。US-001 の画面/UI要件「ドラッグ&ドロップでのファイル読み込みもサポートする」（US-001.md:23）が未実装。

（分析レポート: `docs/sdd/troubleshooting/2026-07-05-user-feedback/analysis.md` 原因群D「D&Dで開けない」）

### 根本原因

- Renderer にドロップハンドラが存在しない（`App.tsx` にドラッグ関連の処理なし）。楽譜未ロード時のプレースホルダ（`ScoreRenderer/index.tsx:209-213`「楽譜ファイルを開いてください」）もドロップを受け付けない
- ファイルオープン経路はダイアログ経由の `handleOpenFile`（`App.tsx:157-211`）のみで、Main プロセスの `PathAllowlist` への登録（アノテーション書き込み許可、`path-allowlist.ts:12`）も `file:show-open-dialog` ハンドラ内（`main/index.ts:66-69`、`file-handlers.ts`）でしか行われない
- Electron の Renderer では セキュリティ設定（contextIsolation）下で `File.path` が使えない場合があり、ドロップファイルの絶対パス取得に preload 経由の仕組みが必要

### 関連する仕様

- US-001 画面/UI要件（US-001.md:23）: ドラッグ&ドロップでのファイル読み込み — 本タスクで traceability に反映する（必要なら REQ-001-007 として EARS 化）
- REQ-001-001/002: 読み込み・エラー時の挙動は D&D 経路でも同一とする
- CLAUDE.md「Electronセキュリティ設定」: `contextIsolation: true` を維持し、Main↔Renderer は preload の contextBridge 経由のみ

## 実装内容

### 修正対象

- ファイル: `src/renderer/src/App.tsx`（および必要に応じて `ScoreRenderer/index.tsx` のプレースホルダ）
  - 変更内容:
    1. アプリ全体（特に楽譜未ロード時の空領域）で `.xml` / `.musicxml` / `.mxl` のドロップを受け付ける（dragover/drop ハンドラ。対象外拡張子は拒否しトースト/alert で通知）。
    2. ドロップされたパスを既存のオープン経路（パース→`setScore`→`practiceEngine.resetToMeasure(1)` 等の初期化→`audioEngine.loadScore`→アノテーション読込、`App.tsx:174-210`）に合流させる。
    3. `handleOpenFile` のダイアログ後処理と共通化するリファクタ（例: `openMusicXmlFile(filePath)` として抽出し、ダイアログ経路と D&D 経路の両方から呼ぶ）。
    4. 未ロード時にドロップ可能であることを示すプレースホルダ表示（「ここにMusicXMLファイルをドロップ」等。既存の「楽譜ファイルを開いてください」表示を拡張）。
- ファイル: `src/preload/index.ts`（および `src/renderer/src/types/electron-api.d.ts` / `src/preload/index.d.ts`）
  - 変更内容: ドロップされた `File` オブジェクトから絶対パスを取得するAPIを公開する。Electron では `File.path` が使えない場合があるため、`webUtils.getPathForFile`（preload 経由）等の確実な方法を調査して採用する。
- ファイル: `src/main/index.ts`（および `src/main/path-allowlist.ts` / `src/main/file-handlers.ts`）
  - 変更内容: D&D で開いたファイルも `file:write`（アノテーション保存）の allowlist に載るよう、**ドロップパス登録用の安全な IPC** を追加する（例: `file:register-dropped-file`）。Main 側で拡張子検証（`.xml`/`.musicxml`/`.mxl` のみ）を必須とし、検証通過時のみ `pathAllowlist.allowMusicXml` を呼ぶ。あわせて `settingsService.addRecentFile` の呼び出し（ファイル履歴、REQ-001-006）もダイアログ経路と揃える。
- ファイル: `docs/sdd/requirements/traceability.md`（および必要に応じて `US-001.md`）
  - 変更内容: US-001 の D&D 要件の traceability を更新する（EARS 化する場合は REQ-001-007 を追加し行を追加）。

### 実装手順

TDDで進める。

1. 失敗するテストを先に書く: ドロップイベント（`.xml` パス）→オープン経路（パース→setScore→初期化→loadScore→アノテーション読込）の結線と、拒否拡張子（例: `.pdf`）で経路が呼ばれないこと。red を確認してコミット。
2. preload のパス取得APIと Main の登録IPC（拡張子検証つき）を実装する（Main 側は `file-handlers.ts` の既存テスト形式に倣い、検証通過時のみ allowlist 登録・履歴追加されることをテスト）。
3. `handleOpenFile` から共通関数を抽出し、D&D ハンドラを結線して green にする。
4. 未ロード時のプレースホルダ表示（ドロップ可能の明示）を実装する。
5. traceability.md（必要なら US-001.md の EARS 化）を更新する。
6. 全テスト・typecheck・lint を通す。

### 注意事項

- `contextIsolation: true` / `nodeIntegration: false` を維持し、パス取得・登録はすべて preload の contextBridge / IPC 経由で行うこと（CLAUDE.md のセキュリティ方針）。
- Main 側の登録 IPC は Renderer からの任意パス書き込み許可にならないよう、(1) 拡張子検証、(2) `allowMusicXml`（読み込み対象の登録）に限定し、書き込み許可自体は既存の `assertAllowedAnnotationPath`（`path-allowlist.ts:16-29`、`.annotation.json` 派生のみ）の仕組みを変えないこと。
- ブラウザ既定のドロップ挙動（ファイルをそのまま開く/ナビゲーション）を `preventDefault` で抑止すること（dragover 含む）。
- 複数ファイルが同時にドロップされた場合は先頭の対応ファイルのみ開く（または拒否する）方針を実装コメントとテストで明確化する。
- `.mxl` はバイナリ読み込み経路（`file.readBinary` → `extractXmlFromMxl`、`App.tsx:178-181`）を通すこと。
- エラー時はダイアログ経路と同じユーザー通知（alert/トースト）を行う（REQ-001-002 と整合）。

## 受入基準

- [ ] `.xml` / `.musicxml` / `.mxl` ファイルをウィンドウへドロップすると楽譜が開き、ダイアログ経由と同じ初期化（練習位置リセット・再生スケジュール・アノテーション読込）が行われる
- [ ] D&D で開いたファイルでも運指メモの保存（`file:write`）とファイル履歴が機能する（allowlist 登録・addRecentFile）
- [ ] 対象外拡張子のドロップは拒否され、ユーザーに通知される（Main 側でも拡張子検証される）
- [ ] 楽譜未ロード時に「ここにMusicXMLファイルをドロップ」等のドロップ可能表示がある
- [ ] `handleOpenFile` と D&D 経路がオープン処理を共通化している
- [ ] US-001 の D&D 要件が traceability.md に反映されている
- [ ] 既存のテストが通る
- [ ] 新規テストが追加されている（必要な場合）

## テスト項目

- [ ] （新規）ドロップイベント→オープン経路の結線（パース→setScore→初期化→loadScore→アノテーション読込）
- [ ] （新規）拒否拡張子（Renderer 側の受付拒否・Main 側 IPC の検証拒否の両方）
- [ ] （新規）登録 IPC: 検証通過時のみ `allowMusicXml`・`addRecentFile` が呼ばれる
- [ ] （新規）未ロード時のドロッププレースホルダ表示
- [ ] （回帰）ダイアログ経由のオープンが従来どおり動作する。`npm run test` 全件グリーン、`npm run typecheck` / `npm run lint` パス

## 情報の明確性

### 明示された情報

- ドロップハンドラ不在・オープン経路・allowlist の現状（実コードで検証済み: `App.tsx:157-211`、`ScoreRenderer/index.tsx:209-213`、`main/index.ts:66-69, :82`、`path-allowlist.ts:12`、preload にパス取得APIなし）
- 修正方針: D&D→既存オープン経路への合流、`webUtils.getPathForFile` 等の調査採用、拡張子検証つき登録IPC、プレースホルダ、共通化リファクタ（分析レポート承認済み方針 TASK-053）

### 不明/要確認の情報

- なし（ドロップファイルのパス取得方法は「webUtils.getPathForFile 等を調査して採用」と指示されており、実装時調査事項として本文に明記済み）
