# TASK-025: 楽譜スクロールのCSSレイアウト修正

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-025 |
| タイプ | bugfix |
| ステータス | TODO |
| 優先度 | High |
| 見積もり | 30分 |
| 依存タスク | なし |

## 背景

### 問題の概要

楽譜をマウスホイールなどで手動スクロールできない。3段目以降の楽譜がピアノ鍵盤の下に隠れて見切れる。自動スクロール（カーソル追従）は動作するが、手動スクロールだけが利かないという非対称な状態になっている。

（分析レポート: `docs/sdd/troubleshooting/2026-07-04-app-unusable/analysis.md` 原因3）

### 根本原因

- `src/renderer/src/App.tsx:153` — 高さが確定する唯一のコンテナ `<div style={{ flexGrow: 1, minHeight: 0, overflow: 'hidden' }}>` が `overflow: 'hidden'` になっており、内部の楽譜を可視域外でクリップしている。
- `src/renderer/src/components/ScoreRenderer/index.tsx:89` の外側div `overflow: 'auto'` は親（App.tsx:153のdiv）がflexコンテナではないため `flexGrow: 1` が効かず高さが未確定になり、スクロールが発火しない。
- 同ファイル95-105行の内側div（`osmd-container`、`height: '100%'`）も、外側の高さが未確定のため解決不能で同様に無効。
- 自動スクロールは `src/renderer/src/components/ScoreRenderer/osmd-controller.ts:78-91` の `cursorElement.scrollIntoView(...)` がoverflow: hidden要素に対してもプログラム的に有効なため動作しており、「自動は動くが手動は不可」という非対称の原因になっている。
- 「鍵盤との重なり」は実際の要素重なりではなく、overflow: hiddenの境界でのクリップがそう見えているだけ。
- 付随: `src/renderer/src/assets/main.css` にelectron-viteテンプレートの残骸が残存し、レイアウトに悪影響を与えている。
  - 3-11行目: `body { display: flex; align-items: center; justify-content: center; overflow: hidden; ... }`
  - 29-35行目: `#root { display: flex; align-items: center; justify-content: center; flex-direction: column; margin-bottom: 80px; }`
- TASK-023（自動スクロール・カーソル追従実装）の受入基準「手動でもスクロールできる」はチェック済み（`[x]`）だが実際には未達（QA漏れ）。

### 関連する仕様

- US-001（楽譜表示）: 手動スクロールで全小節を閲覧できることが前提
- TASK-023: 自動スクロールの受入基準に手動スクロールとの両立が含まれていたが未検証だった

## 実装内容

### 修正対象

- ファイル: `src/renderer/src/App.tsx`
  - 変更内容: 153行目のスコア表示用コンテナをflex化し、`overflow: hidden` を撤廃または適切な位置（横方向クリップのみ等）に限定する。高さが確定するflexコンテナ構造に修正する。
- ファイル: `src/renderer/src/components/ScoreRenderer/index.tsx`
  - 変更内容: 89行目の外側divと95-105行目の内側divによる二重スクロールコンテナを解消し、スクロールコンテナを一本化する（実際にスクロールする要素を1つに絞る）。
- ファイル: `src/renderer/src/assets/main.css`
  - 変更内容: 3-11行目の `body` の中央寄せ・`overflow: hidden` と、29-35行目の `#root { ... margin-bottom: 80px; }` を除去する（electron-viteテンプレートの残骸）。

### 実装手順

1. `App.tsx:112` のルートdiv（`display: flex; flexDirection: column; height: 100vh`）を起点に、153行目のコンテナがflexアイテムとして正しく高さを継承しているか確認する。
2. `App.tsx:153` の `overflow: 'hidden'` を撤廃し、スクロール可否は `ScoreRenderer` 側の単一コンテナに委譲する構造に変更する（例: `overflow: 'hidden'` を `minHeight: 0` のみに変更し、高さ確定の役割だけを持たせる）。
3. `ScoreRenderer/index.tsx:88-106` の二重div構造を見直し、外側divに `overflow: 'auto'`（スクロール担当）、内側の `osmd-container` divからは `overflow: 'auto'`（102行目 `overflowY: 'auto'`）を削除し `height: '100%'` の依存関係を整理する。もしくは内外を1つのdivに統合しても良い。
4. `main.css` から electron-vite テンプレート残骸（body中央寄せ・`#root` の `margin-bottom: 80px`）を除去する。
5. `npm run dev` を起動し、手動ホイールスクロールで全小節が閲覧できること、かつ自動スクロール（カーソル追従、`osmd-controller.ts:78-91`）が引き続き動作することを確認する。
6. 既存のレイアウト関連テスト（`ScoreRenderer.test.tsx`）を実行し、スタイル変更によるスナップショット崩れがないか確認する。

### 注意事項

- `osmd-controller.ts` の `scrollIntoView` はDOM要素の `overflow` プロパティに依存して動作するため、修正後も自動スクロールが機能する組み合わせ（`overflow: auto` かつ高さ確定）を維持すること。
- ピアノ鍵盤（`App.tsx:167` の `flexShrink: 0` フッター）の高さは可変（`pianoHeight`）のため、スコア表示エリアの高さ計算がこれに依存しないこと（flexGrowで自動調整されること）を確認する。
- `main.css` の他のスタイル（`.logo`, `.action` 等）はデモ用HTML要素の名残で使われていない可能性があるが、本タスクでは「レイアウトに悪影響を与えている」と明記された `body` / `#root` のみ除去範囲とする（過剰な削除をしない）。

## 受入基準

- [ ] マウスホイール操作で楽譜を手動スクロールでき、全小節（3段目以降含む）を閲覧できる
- [ ] 自動スクロール（`osmd-controller.ts` の `scrollIntoView` によるカーソル追従）が手動スクロール修正後も動作する
- [ ] 楽譜がピアノ鍵盤の下にクリップされて見切れない
- [ ] `main.css` からelectron-viteテンプレート残骸（body中央寄せ、`#root` の `margin-bottom: 80px`）が除去されている
- [ ] 既存のテストが通る
- [ ] 新規テストが追加されている（必要な場合）

## テスト項目

- [ ] （手動E2E）`npm run dev` で複数段にわたる楽譜を開き、マウスホイールで最終小節までスクロールできる
- [ ] （手動E2E）MIDI/画面鍵盤で演奏を進め、カーソルが画面外に出る際に自動スクロールが発生する
- [ ] （回帰）`ScoreRenderer.test.tsx` がグリーン
- [ ] （回帰）`npm run test` 全件グリーン、`npm run typecheck` / `npm run lint` パス

## 情報の明確性

### 明示された情報

- 根本原因のfile:line（分析レポート原因3、実コードで検証済み: App.tsx:153, ScoreRenderer/index.tsx:89-105, osmd-controller.ts:78-91, main.css:3-11,29-35）
- 修正方針: App.tsx:153のflex化・overflow整理、ScoreRendererの二重スクロールコンテナ解消、main.cssのテンプレート残骸除去（分析レポート「フェーズA-3」承認済み方針）
- 受入基準: 手動スクロールと自動追従（scrollIntoView）の両立

### 不明/要確認の情報

- なし（すべて確認済み）
