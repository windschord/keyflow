# TASK-002: 開発ツール設定（ESLint/Prettier/Vitest/TypeScript strict）

**ステータス**: DONE
**推定工数**: 20分
**依存**: TASK-001

---

## 説明

コード品質ツールを設定し、TypeScript strictモードを有効にする。

## 実装手順

1. 依存をインストール:
   ```bash
   npm install -D eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-plugin-react prettier eslint-config-prettier vitest @vitest/coverage-v8
   ```
2. `.eslintrc.cjs` を作成（typescript-eslint + react推奨設定）
3. `.prettierrc` を作成:
   ```json
   { "semi": true, "singleQuote": true, "tabWidth": 2, "printWidth": 100 }
   ```
4. `tsconfig.json` に `"strict": true` を追加
5. `package.json` に以下のスクリプトを追加:
   ```json
   {
     "lint": "eslint src --ext .ts,.tsx",
     "format": "prettier --write src",
     "test": "vitest run",
     "test:coverage": "vitest run --coverage"
   }
   ```
6. `vitest.config.ts` を作成（jsdom環境設定）

## 受入基準

- [ ] `npm run lint` がエラーなく完了する
- [ ] `npm run test` が実行できる（テストなしでも0件パスで終了）
- [ ] `tsconfig.json` に `"strict": true` が含まれる
- [ ] `npm run format` が正常動作する

**依存関係**: TASK-001

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
