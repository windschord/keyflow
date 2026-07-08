# TASK-083: アプリ名をリポジトリ名「keyflow」へ統一

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-083 |
| タイプ | feature |
| ステータス | REVIEW |
| 優先度 | High |
| 見積もり | 40分 |
| 依存タスク | TASK-082 |

## 背景

2026-07-08のユーザー指示「アプリ名はリポジトリ名と同じにして欲しい」。表示名を「MusicXML Piano Practice」から「keyflow」へ全面的に統一する（US-011 REQ-011-001改訂）。

なお開発モード（`npm run dev`）のメニューバー名はElectronバイナリ由来のため改名後も「Electron」のまま（既知の制約、US-011備考）。「keyflow」が反映されるのはウィンドウタイトル（dev/パッケージ両方）とパッケージ版のメニューバー・Dock・アプリ名。

## 実装内容

### 修正対象

| ファイル | 変更内容 |
|---------|---------|
| `electron-builder.yml` | `productName: keyflow`、`appId: com.windschord.keyflow` |
| `package.json` | `name: keyflow`（現 musicxml-practice-app） |
| `src/renderer/index.html` | `<title>keyflow</title>` |
| `src/main/window-options.ts` | BrowserWindow `title: 'keyflow'` |
| `src/main/menu.ts` | メニューラベル「keyflowについて」（macOS）・ヘルプ「keyflowについて」（Windows/Linux。「バージョン情報」から統一） |
| `src/renderer/src/components/AboutPanel/` | アプリ名表示を「keyflow」へ |
| `README.md` | タイトル・アプリ名記述を「keyflow」へ |
| 各テスト | branding.test.ts / window-options.test.ts / menu.test.ts / AboutPanel.test.tsx / E2E（`page.title()`・About表示）の期待値を「keyflow」へ更新（要件REQ-011-001改訂に基づく期待値変更であり、テストの弱体化ではない） |
| ドキュメント | CLAUDE.md・docs/sdd/design/components/app-branding.md のアプリ名記述を更新 |

### 注意事項

- **設定ファイルの保存先変更**: electron-store の保存先はアプリ名due（userData配下）のため、productName変更で既存設定（音色・鍵盤設定等）は引き継がれず既定値に戻る。リリース前のため許容（ユーザーへ報告事項として明記）
- アイコン（icon.svg等）は変更不要。Salamanderクレジット・ライセンス表記も変更不要

### 実装手順（TDD）

1. テストの期待値を「keyflow」へ更新（Red確認→テストコミット）
2. 実装（設定・タイトル・メニュー・About・README・ドキュメント）→ Green
3. 全ゲート（test / typecheck / lint / format:check / lint:jp / test:e2e）
4. `CSC_IDENTITY_AUTO_DISCOVERY=false npm run build:mac` でdmgを再ビルドする。生成された `.app` の `Info.plist` の `CFBundleName` / `CFBundleDisplayName` が「keyflow」であることを確認する（パッケージ版メニューバー名の機械的検証）
5. コミット → タスクステータス更新

## 受入基準

- [x] ウィンドウタイトルが「keyflow」（E2E `page.title()` 通過）
- [x] メニュー項目が「keyflowについて」でAboutが開く（E2E通過）
- [x] dmg成果物の `.app` 名・`Info.plist` CFBundleNameが「keyflow」
- [x] 全ゲート通過
- [ ] ユーザー実機確認（dmg版でメニューバー名が「keyflow」）

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | アプリ名=リポジトリ名「keyflow」（ユーザー指示、2026-07-08） |
| 設計判断として決定 | appIdをcom.windschord.keyflowへ変更、package.json nameも統一、表記は小文字「keyflow」（リポジトリ名準拠） |

## 対応要件

REQ-011-001（改訂版）
