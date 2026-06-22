# TASK-001: Electronプロジェクト初期化（Vite + React + TypeScript）

**ステータス**: REVIEW
**推定工数**: 30分
**依存**: なし

---

## 説明

Electron + Vite + React + TypeScript のモノレポ構成でプロジェクトを初期化する。
`electron-vite` テンプレートを使い、Main/Preload/Renderer の3プロセス構成を確立する。

## 技術的文脈

- **ボイラープレート**: `electron-vite` CLI (`npm create @quick-start/electron@latest`)
- **テンプレート**: `react-ts`
- **プロジェクトルート**: `/Users/tsk/Claude/Projects/MusicXMLの練習アプリ/`
- **参照設計**: [design/index.md](../../design/index.md)

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | Electron, React, TypeScript, Vite, npm |
| 決定済み事項 | electron-vite テンプレートを使用 |

## 実装手順（TDD）

1. プロジェクトルートで以下を実行:
   ```bash
   npm create @quick-start/electron@latest . -- --template react-ts
   npm install
   ```
2. 生成されたディレクトリ構造を確認:
   ```
   src/
   ├── main/        # Main Process
   ├── preload/     # Preload Scripts
   └── renderer/    # Renderer (React)
   ```
3. `npm run dev` でElectronウィンドウが起動することを確認
4. `npm run build` でビルドエラーがないことを確認

## 受入基準

- [ ] `npm run dev` でElectronウィンドウが起動する
- [ ] `npm run build` がエラーなく完了する
- [ ] `src/main/`, `src/preload/`, `src/renderer/` の3ディレクトリ構造が存在する
- [ ] `package.json` に `electron`, `react`, `typescript`, `vite` が含まれる

**依存関係**: なし

---

## 実行情報

| 項目 | 値 |
|------|-----|
| 実行方式 | Jules API |
| Jules Session ID | 9597799638685866839 |
| Jules ブランチ名 | jules-9597799638685866839-9984bc54 |
| PR 作成先 | main |
| 開始日時 | 2026-06-22 |
| PR 番号 | #2 |
| PR URL | https://github.com/windschord/keyflow/pull/2 |
| PR 作成日時 | 2026-06-22 |
