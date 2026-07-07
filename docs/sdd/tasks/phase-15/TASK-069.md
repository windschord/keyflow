# TASK-069: ペダル記号のパースとScore型拡張

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-069 |
| タイプ | feature |
| ステータス | TODO |
| 優先度 | Medium |
| 見積もり | 40分 |
| 依存タスク | なし |

## 背景

MusicXMLの `<direction><direction-type><pedal>` を現在パースしておらず、ペダル情報がScoreに存在しない（US-014）。本タスクはパーサー層のみを実装する（再生反映はTASK-070）。

設計: `docs/sdd/design/components/pedal-playback.md`（データモデル拡張・パーサー拡張の節）

## 実装内容

### 対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/renderer/src/types/score.ts` | `PedalSpan { startTick: number; endTick: number }` を追加し、`Score` に `pedalSpans: PedalSpan[]` を追加 |
| `src/renderer/src/lib/musicxml-parser/parser.ts` | `<direction>` 処理に `<direction-type><pedal>` の解析を追加（start/stop/change。continueほかは無視） |
| `src/renderer/src/lib/musicxml-parser/parser.test.ts` | ペダルのテストケース追加 |

### 解析仕様（設計書より）

- tick位置は既存のtickカーソル（`<note>`/`<forward>`/`<backup>`）の現在値を使用
- `start`: 区間開始（開始済みなら無視）/ `stop`: 区間確定 / `change`: 現在tickで閉じ同tickから新区間開始
- 曲末尾までstopが無い開区間は最終tick（全ノートの `startTick + durationTicks` の最大値）で閉じる
- 複数パートのペダルはマージし重複区間は結合
- ペダルなしの楽曲は `pedalSpans: []`

### 実装手順（TDD）

1. テスト作成（Red確認→コミット）。テストケース:
   - start/stopペア → 1区間
   - start/change/stop → 2区間（境界tick一致）
   - stopなしで曲終了 → 最終tickで閉じる
   - ペダルなし → 空配列
   - 既存フィクスチャのパース結果が `pedalSpans` 追加以外で不変（非回帰）
2. 型定義追加 → parser実装 → Green確認 → コミット

## 受入基準

- [ ] 上記テストケースが全て通過
- [ ] 既存のparser.test全件が通過（非回帰）
- [ ] `npm run typecheck` / `npm run lint` 通過（`Score` 型利用箇所のコンパイルエラーゼロ。Score生成箇所への `pedalSpans: []` 追加を含む）

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | ダンパーペダルのみ対象、change=踏み替え、再生音のみに影響 |
| 設計判断として決定 | 複数パートのマージ規則、stopなし時の曲末尾クローズ |

## 対応要件

REQ-014-001 / REQ-014-004（データ生成側）
