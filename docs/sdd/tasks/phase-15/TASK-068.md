# TASK-068: アプリのブランディング（アイコン生成・ウィンドウタイトル）

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-068 |
| タイプ | feature |
| ステータス | IN_PROGRESS |
| 優先度 | Medium |
| 見積もり | 60分 |
| 依存タスク | なし |

## 背景

ウィンドウタイトルが「Electron」のまま、Windows用アイコン `build/icon.ico` が欠落しており、タスクバー/Dockでの識別性と完成度に課題がある（US-011）。

設計: `docs/sdd/design/components/app-branding.md`

## 実装内容

### 対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/renderer/index.html` | `<title>Electron</title>` → `<title>MusicXML Piano Practice</title>` |
| `src/main/index.ts` | BrowserWindow optionsに `title: 'MusicXML Piano Practice'` を追加。Windows開発モード用に `icon` 指定をwin32にも拡張 |
| `resources/icon.svg` | 新規作成。ピアノ鍵盤+音符モチーフ、viewBox 1024x1024、16pxでも判別可能なシンプル図案、角丸背景 |
| `scripts/generate-icons.mjs` | 新規作成。SVG→PNG（`@resvg/resvg-js`）→ICNS/ICO（`png2icons`）変換。出力: `resources/icon.png`(1024px)、`build/icon.icns`、`build/icon.ico` |
| `package.json` | devDependenciesに `@resvg/resvg-js` `png2icons` を追加。scriptsに `"generate:icons": "node scripts/generate-icons.mjs"` を追加 |
| `build/icon.icns` / `build/icon.ico` / `resources/icon.png` | スクリプトで生成してコミット（ビルド環境に生成ツールを要求しない） |

### 実装手順（TDD）

1. テスト作成: `src/renderer/src/tests/branding.test.ts`（新規）
   - `index.html` を読み込み `<title>` が「MusicXML Piano Practice」であること
   - `src/main/index.ts` のBrowserWindow生成テスト（既存の `main` プロセステストがあれば拡張）で `title` オプションが渡ること
   - `build/icon.icns` / `build/icon.ico` / `resources/icon.png` が存在しサイズ>0であること
2. テスト実行 → Red確認 → テストコミット
3. icon.svg作成 → generate-icons.mjs実装 → `npm run generate:icons` 実行 → title変更
4. テスト通過確認 → 実装コミット

## 受入基準

- [ ] `npm run dev` 起動時のウィンドウタイトルが「MusicXML Piano Practice」
- [ ] `build/icon.ico` が存在する（electron-builder.ymlの参照欠落解消）
- [ ] `npm run generate:icons` で全アイコンが再生成できる
- [ ] `npm run test` / `npm run typecheck` / `npm run lint` が通過
- [ ] E2Eの `page.title()` 検証を追加（既存E2Eスイートに1ケース）

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | タイトル文字列（productName一致）、アイコンモチーフ（ピアノ+楽譜）、全OS形式生成 |
| 設計判断として決定 | 生成ライブラリ（@resvg/resvg-js + png2icons）、生成物のコミット方針、macOS開発モードDockはデフォルト許容 |

## 対応要件

REQ-011-001 / REQ-011-002 / REQ-011-003
