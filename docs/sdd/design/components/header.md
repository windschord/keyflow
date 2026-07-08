# Header（1行ヘッダー・ポップオーバー）

## 概要

**目的**: 現行の「App.tsx上段バー + Toolbar」2ブロック構成（実質3〜4行）を、高さ約48pxの1行ヘッダーへ統合し、低頻度操作をポップオーバーへ移設する（US-012、[DEC-007](../decisions/DEC-007.md)）。

**責務**:
- 頻用操作（ファイルを開く・再生/一時停止/停止・ループ・テンポ/BPM・練習対象）の常時表示
- 低頻度操作（音量・表示倍率・運指表示/提案・メトロノーム・正解率）のポップオーバー提供
- 設定モーダルの起点

**実行場所**: Renderer Process（React コンポーネント）

**位置づけ**: 本ドキュメントは [toolbar.md](toolbar.md) を置き換える後継設計である。toolbar.mdに記載の各コントロールの用途・ツールチップ・無効化条件・対応要件は、配置先の変更を除きすべて維持する（REQ-012-004: 機能の喪失禁止）。

---

## コンポーネント構成

```
src/renderer/src/components/Header/
├── index.tsx              # 1行ヘッダー本体（レイアウトコンテナ、高さ48px）
├── Popover.tsx            # 汎用ポップオーバー（外側クリック/Escapeで閉じる）
├── QuickPanel.tsx         # 低頻度操作パネル（ポップオーバー内容）
└── （既存コンポーネントを再利用）
```

- `Toolbar/` 配下の既存子コンポーネントと `StatsDisplay` / `FingeringPanel` は**ロジックを変更せず**、表示密度（高さ・ラベル）のみコンパクト化して再配置する
  - 対象: `PracticeModeSelector` / `TempoControl` / `LoopControl` / `PlaybackControls` / `VolumeControl` / `ZoomControl` / `FingeringToggle`
- `Toolbar/index.tsx` と App.tsx 上段バーは廃止し、`Header/index.tsx` に一本化する

## レイアウト（左→右）

```
┌────────────────────────────────────────────────────────────────┐
│ [📂] │ ▶ ⏸ ■ │ 🔁 [1]-[2] │ ♩=[145] ▂▄▆ ↺ │ 左|右|両 │    ⋯  ⚙ │
└────────────────────────────────────────────────────────────────┘
  高さ48px（最大56px）・折り返しなし（flexWrap: nowrap）
```

| スロット | コントロール | 元の実装 | 表示形態 |
|---------|-------------|---------|---------|
| 1 | ファイルを開く | App.tsx直書きボタン | アイコンボタン（📂相当のSVG）+ツールチップ |
| 2 | 再生/一時停止/停止 | PlaybackControls | アイコンボタン3つ（Space対応維持） |
| 3 | ループ有効+開始/終了小節 | LoopControl | トグルアイコン+数値入力2つ（幅48px） |
| 4 | BPM入力+テンポスライダー+リセット | TempoControl | `♩=`+数値入力+スライダー（幅100px）+リセットアイコン |
| 5 | 練習対象 | PracticeModeSelector | セグメントボタン（左/右/両） |
| 6（右端） | クイックパネル開閉 | 新規 | `⋯`（スライダー型SVG）ボタン → Popover |
| 7（右端） | 設定 | 既存ギアボタン | 設定モーダルを開く |

- 各コントロールの高さは36px（クリック領域36px以上、US-012備考のデスクトップ許容基準）
- ラベルテキスト（「開始小節:」等）はツールチップ（`title`）へ移し、視覚ノイズを削減する
- 折り返し禁止。ウィンドウ最小幅（900px想定）で全スロットが収まるよう幅を設計し、収まらない極小幅ではスロット4のスライダーのみ非表示（BPM数値入力は残す）

## QuickPanel（ポップオーバー）内容

| セクション | コントロール | 元の実装 |
|-----------|-------------|---------|
| 音量 | スライダー0-100 | VolumeControl |
| 表示倍率 | select 50-400% | ZoomControl |
| 運指 | 表示トグル + 対象手select + 運指提案ボタン（進捗表示含む） | FingeringToggle + FingeringPanel |
| メトロノーム | ON/OFF + 1拍目強調 | TempoControlから分離 |
| 成績 | 正解率・連続正解数（表示のみ） | StatsDisplay |

- どの操作もヘッダーの`⋯`ボタン→パネル内操作の2クリック以内（REQ-012-002）

## Popover（汎用）の仕様

- `Popover.tsx`: アンカー要素の直下に `position: absolute` で表示。`z-index` はモーダル未満
- 閉じる条件（REQ-012-003）: ポップオーバー外の `mousedown` / `Escape` キー / 開閉ボタン再クリック
- 実装: `useEffect` で `document` にリスナーを登録し、cleanup で解除（StrictMode耐性のReactリソース管理原則に従う）
- ポップオーバー表示中も再生・MIDI入力は継続する（モーダルではない）

## 状態管理

- 開閉状態（`isQuickPanelOpen`）はHeaderローカルstate（`useState`）。Zustandには置かない（他コンポーネントから参照不要のため）
- 既存のZustand state（bpm, loopEnabled, volume, zoom, metronomeEnabled等）とその更新経路は一切変更しない

## 再生中の無効化（REQ-012-006）

- TempoControl（ヘッダー側スライダー・BPM入力）は現行どおり `playbackState === 'playing'` で無効化
- QuickPanel内のメトロノームON/OFFは現行どおり再生中も操作可能

---

## テスト観点

- ヘッダーが1行・高さ56px以下であること（E2E: bounding box検証）
- 現行の全コントロールがヘッダーまたはQuickPanel経由で操作可能であること（REQ-012-004、E2Eで代表操作を実施）
- ポップオーバーが外側クリック/Escapeで閉じること
- 楽譜表示領域の高さが現行より拡大すること（E2E: ScoreRendererコンテナの高さ比較は困難なため、ヘッダー高さ上限の検証で代替）
- Space再生トグル・L/R/Bショートカットの維持

## 対応要件

| 要件ID | 対応設計 |
|--------|---------|
| REQ-012-001 | Header/index.tsx 1行レイアウト |
| REQ-012-002 | QuickPanel（2クリック以内） |
| REQ-012-003 | Popover.tsx の外側クリック/Escape |
| REQ-012-004 | 既存子コンポーネント再利用による全機能維持 |
| REQ-012-005 | ヘッダー高さ48px（現状の約1/4） |
| REQ-012-006 | TempoControlの再生中無効化維持 |
