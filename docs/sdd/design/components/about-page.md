# About Page（バージョン・ライセンス表示）

## 概要

**目的**: アプリ内でバージョン・本体ライセンス（Apache 2.0）・サードパーティライブラリのライセンス・同梱音源クレジットを表示する（US-015、[DEC-008](../decisions/DEC-008.md)）。

**責務**:
- アプリ名・バージョン・本体ライセンスの表示（REQ-015-001）
- ビルド時自動生成したライブラリライセンス一覧の表示（REQ-015-002/004/005）
- 音源クレジット（Salamander、CC-BY 3.0）の表示（REQ-015-003）

**実行場所**: Renderer Process（SettingsModal内） + ビルドスクリプト

---

## ライセンスデータの自動生成（REQ-015-004）

### 生成スクリプト

- `scripts/generate-licenses.mjs` を新設し、`npm run generate:licenses` で実行
- `package.json` の `dependencies`（本番依存のみ。devDependenciesは対象外）を起点に `node_modules/*/package.json` と `LICENSE*` ファイルを走査して収集する（外部ライブラリ不使用の自前実装。依存が少ないため十分）
- 出力: `src/renderer/src/generated/licenses.json`（gitignore対象。`predev` / `prebuild` フックで自動再生成）

```typescript
// licenses.json のスキーマ
interface LicenseEntry {
  name: string;         // 例: 'tone'
  version: string;
  license: string;      // SPDX表記。例: 'MIT'
  licenseText: string;  // LICENSE ファイル本文（見つからない場合はSPDX名のみ）
}
```

### 静的データ（自動収集の対象外）

`src/renderer/src/components/AboutPanel/credits.ts` に静的定義:

- 音源: Salamander Grand Piano V3 by Alexander Holm — CC-BY 3.0（REQ-015-003 / REQ-013-008）
- アプリ本体: Apache License 2.0

## UI設計

### 配置（分類基準: 一度決めたら変えないもの）

- `SettingsModal` に「このアプリについて」セクションを追加し、その中に `AboutPanel` を表示する
- TASK-082でAboutを設定モーダルから分離し、メニューバー経由の独立モーダル`AboutModal`から表示する方式へ変更した。
  Main側の`menu.ts`が`menu:open-about`（Main→Renderer）を送信し、preloadの`electronAPI.menu.onOpenAbout`が
  これを購読する。この購読APIは受信専用でありrenderer→mainの送信機能は持たない

```
src/renderer/src/components/AboutPanel/
├── index.tsx      # アプリ名・バージョン・ライセンス一覧・クレジット
└── credits.ts     # 静的クレジットデータ
```

### 表示内容

| 項目 | データソース |
|------|-------------|
| アプリ名 | 「MusicXML Piano Practice」（定数） |
| バージョン | ビルド時define `__APP_VERSION__`（electron-vite設定でpackage.jsonのversionを注入。REQ-015-001の「一致」を機械的に保証） |
| 本体ライセンス | credits.ts（Apache License 2.0） |
| 音源クレジット | credits.ts（Salamander） |
| ライブラリ一覧 | licenses.json（名称・バージョン・ライセンス種別のスクロールリスト） |

- ライブラリ行をクリックすると `licenseText` を展開表示する（REQ-015-005。アコーディオン方式）

## LICENSEファイル

- リポジトリ直下に `LICENSE`（Apache License 2.0全文）を追加する（US-015備考）
- `README.md` にライセンスセクション（Apache 2.0 + Salamanderクレジット）を追記する

---

## テスト観点

- generate-licenses.mjs: dependencies全件が出力に含まれ、devDependenciesが含まれないこと（ユニット: スクリプトを関数化してテスト）
- AboutPanel: バージョン・Apache 2.0・Salamanderクレジットが表示されること（コンポーネントテスト）
- ライセンス本文の展開表示（コンポーネントテスト）
- E2E: 設定モーダル→このアプリについてでバージョンが表示されること

## 対応要件

| 要件ID | 対応設計 |
|--------|---------|
| REQ-015-001 | __APP_VERSION__ define + credits.ts |
| REQ-015-002 | licenses.json 一覧表示 |
| REQ-015-003 | credits.ts のSalamander表記 |
| REQ-015-004 | generate-licenses.mjs（predev/prebuildフック） |
| REQ-015-005 | ライセンス本文アコーディオン |
