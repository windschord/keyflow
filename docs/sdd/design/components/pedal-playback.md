# Pedal Playback（ペダル記号の再生反映）

## 概要

**目的**: MusicXMLのダンパーペダル記号（`<direction><direction-type><pedal>`）を解析し、お手本演奏の発音長に反映する（US-014）。

**責務**:
- パーサーでのペダル区間抽出（REQ-014-001）
- 再生スケジューリング時のリリース延長（REQ-014-002/003）
- 停止・ループ時の音残留防止（REQ-014-005）

**実行場所**: Renderer Process（musicxml-parser + audio-engine）

**影響範囲の限定**: ペダルは**再生音のみ**に影響する。正誤判定・カーソル・鍵盤ガイド・OSMD描画は記譜上の音価（`durationTicks`）を使い続け、一切変更しない（US-014データ要件）。

---

## データモデル拡張

```typescript
// src/renderer/src/types/score.ts
export interface PedalSpan {
  /** ペダルON（start / changeの踏み直し）の絶対tick */
  startTick: number;
  /** ペダルOFF（stop / 次のchange / 曲末尾）の絶対tick */
  endTick: number;
}

export interface Score {
  // ...既存フィールド...
  /** ダンパーペダル区間（tick昇順、互いに重複しない）。ペダルなしの楽曲は空配列 */
  pedalSpans: PedalSpan[];
}
```

- `change` は「直前区間の終了 = 新区間の開始」として2区間に分割表現する（REQ-014-003）
- 既存楽曲（ペダルなし）は `pedalSpans: []` となり、再生結果は従来と完全一致（REQ-014-004）

## パーサー拡張（`musicxml-parser/parser.ts`）

`<direction>` 処理（現状は `<sound tempo>` のみ）に `<direction-type><pedal>` の解析を追加する:

| pedal type | 処理 |
|-----------|------|
| `start` | 現在tick位置で区間開始（開始済みなら無視） |
| `stop` | 開区間を閉じて `pedalSpans` へ確定 |
| `change` | 開区間を現在tickで閉じ、同tickから新区間を開始 |
| `continue` ほか | 無視（スコープ外、US-014備考） |

- tick位置の解決: `<direction>` は小節内の現在tick位置（`<note>`/`<forward>`/`<backup>` で進む既存のtickカーソル）を使用する
- 曲末尾まで `stop` が現れない開区間は、スコアの最終tick（最後のノートの `startTick + durationTicks` の最大値）で閉じる（US-014備考）
- 複数パートに同一ペダルが書かれる場合（P1のみに書かれるのが通例）: 全パートのペダルをマージし、重複区間は結合する

## 再生反映（`audio-engine/index.ts` の `loadScore`）

イベント構築時に発音長を静的に解決する（**スケジューリング前の純関数計算**。実行時の動的処理は追加しない）:

```typescript
// 新設: src/renderer/src/lib/audio-engine/pedal-extension.ts（純関数、単体テスト対象）
export function resolveEffectiveEndTick(
  note: { startTick: number; durationTicks: number },
  pedalSpans: PedalSpan[]
): number;
```

### 延長規則（REQ-014-002）

1. ノートの記譜上のリリースtick `e = startTick + durationTicks` を求める
2. `span.startTick <= e < span.endTick` を満たすペダル区間があれば、実効リリースを `span.endTick` へ延長する（ダンパーが上がっている間は弦が鳴り続ける物理の再現）
3. 該当区間がなければ記譜どおり（延長なし）

### 同音再打鍵の抑制（US-014備考）

- 延長後、同一 `midiNumber` のノートを `startTick` 昇順に走査し、実効リリースが次の同音の `startTick` を超える場合は次の発音開始tickまでに切り詰める（`Tone.Sampler` の同音重複による音量肥大・位相干渉を防ぐ）

### 適用箇所

- `loadScore` の `events.push({ duration: ... })` を実効リリース由来の `durationTicks` に置き換える
- **発音境界の追跡（TASK-057の `registerBoundary`）と判定グループは記譜上の音価のまま変更しない**（鍵盤ガイド表示は記譜基準、US-014データ要件）

### 停止・ループ時の解放（REQ-014-005）

- `stopAccompaniment` / `pauseAccompaniment` に `accompanimentSynth.releaseAll()`（Sampler/PolySynth共通API）を追加し、延長中ノートの残留を防ぐ
- ループ折り返し: `Tone.Part` のイベントはループ境界で `triggerAttackRelease` の release が範囲外になるケースがあるため、Transportの `loopEnd` 到達時に `releaseAll()` を呼ぶスケジュールを `setLoopPoints` で登録する

---

## テスト観点

- パーサー: start/stop、change（分割）、stopなし（曲末尾で閉じる）、ペダルなし（空配列）の各ケース（ユニット、TDD）
- `resolveEffectiveEndTick`: 区間内リリース延長・区間外は非延長・境界値（`e === span.endTick` は非延長）・同音再打鍵の切り詰め（ユニット、TDD）
- 結線: `loadScore` が `pedalSpans` を実際に参照してイベント長へ反映すること（結線テスト: Tone.Partへ渡るdurationの検証）
- 既存曲の非回帰: ペダルなしScoreで従来と同一のイベント列が生成されること
- E2E: ペダル付きMusicXMLを再生し、エラーなく再生完了すること（音長の聴覚検証は自動化困難のため、ユニットでイベント長を担保）

## 対応要件

| 要件ID | 対応設計 |
|--------|---------|
| REQ-014-001 | parser.ts の pedal解析 + Score.pedalSpans |
| REQ-014-002 | resolveEffectiveEndTick（リリース時点のペダル状態で延長） |
| REQ-014-003 | change = 区間分割 |
| REQ-014-004 | pedalSpans空配列時の非回帰 |
| REQ-014-005 | releaseAll()（停止/一時停止/ループ折り返し） |
