# TASK-054: [BugFix] チェックボックスラベルの視認性修正とテンプレートCSS残骸整理

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-054 |
| タイプ | bugfix |
| ステータス | DONE |
| 優先度 | Medium |
| 見積もり | 30分 |
| 依存タスク | なし |

## 背景

### 問題の概要

ツールバーのチェックボックスラベル「メトロノーム」「ループ」が薄いグレーでほぼ読めない。

（分析レポート: `docs/sdd/troubleshooting/2026-07-05-user-feedback/analysis.md` 原因群D「チェックボックスのラベルが読めない」）

### 根本原因

- electron-vite テンプレート残骸の `src/renderer/src/assets/base.css` が、ダークテーマ用のほぼ白のテキスト色 `--ev-c-text-1: rgba(255, 255, 245, 0.86)`（`base.css:14`）を `--color-text`（`:31`）として `body` の `color` に設定している（`:46-48`）
- アプリのUIはライト前提（白背景）だが、色指定のないラベルがこの body 色を継承して薄グレー化する。`TempoControl.tsx:91-109` の「メトロノーム」ラベルと `LoopControl.tsx:46-64` の「ループ」ラベルは `color` 未指定（同ファイル内の他のラベルは `color: '#374151'` を明示しており読める）。`LoopControl.tsx:78` の「–」span も同様に `color` 未指定
- ツールチップは既に存在する（`title` 属性、`TempoControl.tsx:92` / `LoopControl.tsx:47`）ため対応不要

### 関連する仕様

- NFR（usability）: ツールバーの日本語ラベルの可読性（Phase 8 TASK-028 で確立した方針）
- REQ-006 系（メトロノーム切替）・REQ-007 系（ループ設定）のUI操作対象

## 実装内容

### 修正対象

- ファイル: `src/renderer/src/components/Toolbar/TempoControl.tsx`
  - 変更内容: メトロノームのチェックボックスラベル（`:91-109`）の style に明示色 `color: '#374151'` を追加する。
- ファイル: `src/renderer/src/components/Toolbar/LoopControl.tsx`
  - 変更内容: ループのチェックボックスラベル（`:46-64`）と「–」span（`:78`）の style に明示色 `color: '#374151'` を追加する。
- ファイル: `src/renderer/src/assets/base.css`
  - 変更内容: 根本対応として、ダークテーマ用のテンプレ残骸をライトUI前提の値に是正する。`--color-text`（`:31`、現在 `rgba(255,255,245,0.86)`）や `--color-background`（`:27`、現在 `--ev-c-black`）等の `--ev-c-*` 変数群（`:1-24`）を整理し、body の既定文字色をライトUIで可読な色にする。他画面（SettingsModal・StatsDisplay・FingeringPanel 等）への影響がないことを確認する。

### 実装手順

TDDで進める（UIスタイルは可能な範囲でテストする）。

1. 失敗するテストを先に書く: 「メトロノーム」「ループ」ラベルに明示色（`#374151`）が設定されていることを検証する（Toolbar.test / TempoControl / LoopControl の既存テスト形式に倣い、style 属性をアサート）。red を確認してコミット。
2. `TempoControl.tsx` / `LoopControl.tsx` に明示色を追加して green にする。
3. `base.css` の `--ev-c-*` / `--color-*` テンプレ残骸をライトUI前提の値へ是正する（不要変数の削除または値変更）。
4. 全画面のスモーク確認（既存テスト・E2E・目視）で他画面への影響がないことを確認する。
5. 全テスト・typecheck・lint を通す。

### 注意事項

- ラベルへの明示色（対症）と base.css の是正（根本）の**両方**を行うこと。base.css 側だけに頼ると、将来 CSS が復活・変更された際に再発するため、ユーザーが直接読む重要ラベルには明示色を持たせる。
- `base.css` の変数は `assets/main.css` や他コンポーネントから参照されている可能性があるため、変更前に参照箇所を検索し、削除する場合は参照ゼロを確認すること。
- `prefers-color-scheme` によるダークテーマ対応は本タスクのスコープ外（アプリはライトUI前提）。
- 見た目の変更は「文字色の可読化」のみとし、レイアウト・サイズは変更しない。

## 受入基準

- [x] 「メトロノーム」「ループ」のチェックボックスラベルが白背景上で明瞭に読める（明示色 `#374151`）
- [x] `LoopControl.tsx:78` の「–」span も同様に読める
- [x] `base.css` のダークテーマ用テンプレ残骸（`--color-text` ほか `--ev-c-*` 変数群）がライトUI前提の値に是正されている
- [x] 他画面（SettingsModal・StatsDisplay 等）の表示に劣化がない
- [x] 既存のテストが通る
- [x] 新規テストが追加されている（必要な場合）

## テスト項目

- [x] （新規）「メトロノーム」ラベルの色スタイル検証（可能な範囲）
- [x] （新規）「ループ」ラベル・「–」span の色スタイル検証（可能な範囲）
- [x] （回帰）Toolbar 系・SettingsModal 系の既存テストが通る。`npm run test` 全件グリーン、`npm run typecheck` / `npm run lint` パス

## 完了サマリー

- `TempoControl.tsx` のメトロノームラベル、`LoopControl.tsx` のループラベルおよび「–」span に明示色 `color: '#374151'` を追加（対症療法）。
- `src/renderer/src/assets/base.css` のダークテーマ用テンプレ残骸を是正（根本対応）:
  - `--ev-c-text-1/2/3`: ほぼ白の `rgba(255,255,245,...)` 系 → ライトUI向けの濃いグレー（`#1f2937` 等）に変更
  - `--color-background` / `--color-background-soft` / `--color-background-mute`: `--ev-c-black*`（暗色）参照 → `--ev-c-white*`（明色）参照に変更
  - `--ev-button-alt-text` / `--ev-button-alt-hover-text`: `--ev-c-text-1` 参照 → `--ev-c-white` 参照に変更（未使用の残骸クラス `.action a` 向けだが、暗背景に対して読める配色を維持）
  - `--color-text` は変わらず `--ev-c-text-1` を参照するが、値自体がライト向けに是正されたため body の既定文字色が可読になった
- 影響範囲確認: `main.css`/`base.css` を実際に参照しているのは `main.tsx` のみで、他コンポーネント（SettingsModal・StatsDisplay 等）はすべて明示的な `color`/`backgroundColor` を持つインラインスタイルのため、body色変更による劣化がないことをコード確認済み。
- テスト: `TempoControl.test.tsx` / `LoopControl.test.tsx` にラベル・区切り文字の `style.color` を検証する新規テストを追加し、Red（未実装で失敗）→ Green（実装後に成功）の順でTDDを実施。
- `npm run test` 全件（327件中、スコープ外の TASK-052 進行中の audio-engine 6件を除き全通過）、`npm run typecheck`、`npm run lint` すべて通過を確認。

## 情報の明確性

### 明示された情報

- 根本原因の file:line（実コードで検証済み: `base.css:14` の `--ev-c-text-1`、`:31` の `--color-text`、`:46-48` の body 継承、`TempoControl.tsx:91-109`、`LoopControl.tsx:46-64` / `:78` の color 未指定）
- 修正方針: ラベル明示色 `#374151` ＋ base.css テンプレ残骸是正（分析レポート承認済み方針 TASK-054）
- ツールチップは既存のため追加不要（分析レポート原因群D）

### 不明/要確認の情報

- なし（すべて確認済み）
