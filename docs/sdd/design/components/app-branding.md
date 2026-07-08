# App Branding（アプリアイコン・ウィンドウタイトル）

## 概要

**目的**: アプリのウィンドウタイトルとアイコンをElectronデフォルトから独自ブランディングへ置き換える（US-011）。

**責務**:
- ウィンドウタイトル「keyflow」の設定（REQ-011-001）
- ピアノ+楽譜モチーフの独自アイコンの提供（REQ-011-002）
- 全対象OS向けアイコン形式の生成と配置（REQ-011-003）

**実行場所**: Main Process（BrowserWindow設定）+ ビルドリソース

---

## ウィンドウタイトル

| 設定箇所 | 変更内容 |
|---------|---------|
| `src/renderer/index.html` | `<title>Electron</title>` → `<title>keyflow</title>` |
| `src/main/index.ts` の BrowserWindow options | `title: 'keyflow'` を追加 |

- タイトル文字列は `electron-builder.yml` の `productName`（`keyflow`）と一致させる
- Rendererが `document.title` を変更しない限りHTML側が優先されるため、両方を設定して整合を保つ

## アイコン

### アセット構成

| ファイル | 役割 | 生成方法 |
|---------|------|---------|
| `resources/icon.svg` | マスター（新規作成、1024x1024相当のviewBox） | 手書きSVG（リポジトリにコミット） |
| `resources/icon.png` | Linux実行時・変換元（1024x1024） | 生成スクリプトでSVGからレンダリング |
| `build/icon.icns` | macOSパッケージ用 | 生成スクリプトでPNGから変換 |
| `build/icon.ico` | Windowsパッケージ用（TASK-068で生成・解消済み） | 生成スクリプトでPNGから変換 |

生成物（png/icns/ico）もリポジトリにコミットする（ビルド環境に生成ツールを要求しないため）。

### 生成スクリプト

- `scripts/generate-icons.mjs` を新設し、`npm run generate:icons` で実行
- 使用ライブラリ（devDependencies）:
  - `@resvg/resvg-js`: SVG → PNG レンダリング（1024/512/256px）
  - `png2icons`: PNG → ICNS / ICO 変換（純JS、追加ネイティブ依存なし）
- デザイン制約: 16pxでも判別可能なシンプル図案（鍵盤の白黒コントラスト+音符）。角丸背景+中央モチーフ

### 実行時アイコン

- Linux: 既存どおり BrowserWindow `icon` オプション（`resources/icon.png?asset`）
- Windows: BrowserWindow `icon` にも同PNGを指定（開発モードでのタスクバー表示用）
- macOS: パッケージ版は `icon.icns` が適用される。開発モード（`npm run dev`）のDockアイコンも
  `app.dock.setIcon(resources/icon.png)` により独自アイコンを適用する（TASK-080、`dock-icon.ts`）。
  メニューバーのアプリ名のみ、開発モードのElectronバイナリ由来という制約として許容する（US-011備考）

---

## テスト観点

- `index.html` の `<title>` が「keyflow」であること（ユニットテストまたはE2Eの `title()` 検証）
- E2E: 起動したウィンドウの `page.title()` が「keyflow」であること
- `build/icon.ico` / `build/icon.icns` / `resources/icon.png` が存在すること（生成スクリプトのテストまたはCIチェック）

## 対応要件

| 要件ID | 対応設計 |
|--------|---------|
| REQ-011-001 | index.html `<title>` + BrowserWindow `title` |
| REQ-011-002 | icon.svgマスター+実行時icon指定 |
| REQ-011-003 | generate-icons.mjs による icns/ico/png 生成 |
