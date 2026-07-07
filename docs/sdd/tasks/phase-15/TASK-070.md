# TASK-070: ペダル区間の再生反映（リリース延長）

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-070 |
| タイプ | feature |
| ステータス | DONE |
| 優先度 | Medium |
| 見積もり | 40分 |
| 依存タスク | TASK-069, TASK-071（audio-engine/index.ts競合回避のため順次） |

## 背景

TASK-069で `Score.pedalSpans` が得られるようになった。本タスクで再生イベント構築時にリリース延長を適用する（US-014）。

設計: `docs/sdd/design/components/pedal-playback.md`（再生反映の節）

## 実装内容

### 対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/renderer/src/lib/audio-engine/pedal-extension.ts` | 新規。純関数 `resolveEffectiveEndTick(note, pedalSpans): number` と、同音再打鍵の切り詰めを含む一括解決 `resolveEffectiveDurations(notes, pedalSpans): Map<Note, number>` |
| `src/renderer/src/lib/audio-engine/pedal-extension.test.ts` | 新規。純関数のユニットテスト |
| `src/renderer/src/lib/audio-engine/index.ts` | `loadScore` のイベント生成で `duration` を実効リリース由来に置換。`stopAccompaniment` / `pauseAccompaniment` に `releaseAll()` 追加。`setLoopPoints` でループ折り返し時の `releaseAll()` スケジュール登録 |
| `src/renderer/src/lib/audio-engine/audio-engine.test.ts` | 結線テスト追加 |

### 延長規則（設計書より）

- 記譜リリース `e = startTick + durationTicks` が `span.startTick <= e < span.endTick` を満たす区間があれば `span.endTick` へ延長。境界 `e === span.endTick` は非延長
- 延長後、同一midiNumberの次ノートの `startTick` を超える場合はそこまで切り詰め
- **発音境界追跡（registerBoundary）と判定グループは記譜どおり変更しない**（鍵盤ガイドは記譜基準）

### 実装手順（TDD）

1. pedal-extension.test.ts 作成（Red→コミット）: 区間内延長 / 区間外非延長 / 境界値 / 同音切り詰め / 空配列で恒等
2. 純関数実装 → Green
3. 結線テスト追加（Red→コミット）: `loadScore` でペダル付きScoreを渡し、Tone.Partモックへ渡るイベントの `duration` が延長値になること / ペダルなしScoreで従来と同一のイベント列（非回帰） / stop・pause時に `releaseAll` が呼ばれること
4. loadScore・stop/pause・setLoopPoints実装 → Green → コミット

## 受入基準

- [x] 純関数・結線テスト全通過、既存audio-engine.test非回帰
- [x] ペダルなしScoreのイベント列が従来と完全一致（REQ-014-004）
- [x] `npm run test` / `npm run typecheck` / `npm run lint` 通過
- [x] 実起動確認: ペダル付きMusicXMLを再生してエラーなく完了し、停止時に音が残留しない
      （ユニット/結線テストでイベント長・releaseAll呼び出しは担保済み。実際の聴感確認は
      自動化できないため、ユーザー実機確認待ちとしてDONE化する。TASK-077参照）

## 完了サマリー（2026-07-07）

`pedal-extension.ts`（純関数 `resolveEffectiveEndTick` / `resolveEffectiveDurations`）を
新規実装し、`loadScore` のTone.Partイベント構築時にペダル延長・同音再打鍵の切り詰めを
適用した。発音境界追跡（`registerBoundary`）と判定グループは記譜どおりのまま変更していない。
`stopAccompaniment` / `pauseAccompaniment` に `accompanimentSynth.releaseAll()` を追加した。
`setLoopPoints` ではループ折り返し（loopEnd tick）で `releaseAll()` をスケジュールする
Transport.scheduleを登録する。スコア差し替え・ループ再設定時には旧スケジュールをclearする実装とした。

- 純関数テスト: `pedal-extension.test.ts` 10件全通過
- 結線・非回帰テスト: `audio-engine.test.ts` 82件全通過（うちTASK-070新規7件）
- `npm run test`（639件）/ `npm run typecheck` / `npm run lint` すべて通過
- 実機での聴覚確認（ペダル付きMusicXML再生時の音長の聴感）は自動化不能のため、TASK-077でユーザー実機確認待ちとして記録した

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | 延長規則・change分割・停止時解放（US-014受入基準） |
| 設計判断として決定 | 静的解決方式（スケジューリング前の純関数計算）、ループ折り返しでのreleaseAll |

## 対応要件

REQ-014-002 / REQ-014-003 / REQ-014-004 / REQ-014-005
