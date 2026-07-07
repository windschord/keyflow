# TASK-074: 汎用Popover・QuickPanelコンポーネント

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-074 |
| タイプ | feature |
| ステータス | TODO |
| 優先度 | High |
| 見積もり | 40分 |
| 依存タスク | なし |

## 背景

ヘッダー1行化（US-012 / DEC-007）の部品として、汎用ポップオーバーと低頻度操作パネルを先行実装する。ヘッダー本体への統合はTASK-075。

設計: `docs/sdd/design/components/header.md`（QuickPanel・Popoverの節）

## 実装内容

### 対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/renderer/src/components/Header/Popover.tsx` | 新規。アンカー直下に絶対配置。外側 `mousedown` / `Escape` / 開閉ボタン再クリックで閉じる（REQ-012-003）。リスナーは `useEffect` 内登録・cleanup解除（StrictMode耐性） |
| `src/renderer/src/components/Header/QuickPanel.tsx` | 新規。セクション: 音量（VolumeControl）/ 表示倍率（ZoomControl）/ 運指（FingeringToggle + FingeringPanel）/ メトロノーム（ON/OFF+1拍目強調、TempoControlから分離した新規小コンポーネント `MetronomeToggle`）/ 成績（StatsDisplay） |
| `src/renderer/src/components/Header/Popover.test.tsx` / `QuickPanel.test.tsx` | 新規テスト |

### 実装要点

- 既存コンポーネント（VolumeControl等）はロジック不変で再利用。QuickPanel内でのコンパクト表示（高さ・ラベル）はラッパー側スタイルで調整
- `MetronomeToggle` はZustandの `metronomeEnabled` / `metronomeAccentEnabled` を既存TempoControlと同じ経路で操作する（状態・結線の変更なし）
- この時点ではTempoControl本体は変更しない（TASK-075でメトロノームUIを取り除く）

### 実装手順（TDD）

1. Popover.test.tsx 作成（Red→コミット）: 開いた状態で外側mousedown→閉じる / Escape→閉じる / 内側クリック→閉じない / アンマウント時にdocumentリスナーが解除される
2. QuickPanel.test.tsx 作成（Red→コミット）: 全セクション（音量・倍率・運指・メトロノーム・成績）がレンダリングされる / MetronomeToggleの操作がstoreの `metronomeEnabled` を切り替える
3. 実装 → Green → コミット

## 受入基準

- [ ] 全テスト通過
- [ ] StrictMode（開発モード）で開閉を繰り返してもリスナーリークがない
- [ ] `npm run test` / `npm run typecheck` / `npm run lint` 通過

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | ポップオーバーへ移す操作の一覧（US-012分類基準、ユーザー承認済み） |
| 設計判断として決定 | 開閉状態はローカルstate、モーダルではない（表示中も再生・MIDI継続） |

## 対応要件

REQ-012-002 / REQ-012-003
