# TASK-038: [BugFix] 曲の再生の本実装（StrictMode耐性・時刻ベーススケジューリング・カーソル連動）

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-038 |
| タイプ | bugfix |
| ステータス | TODO |
| 優先度 | High |
| 見積もり | 60分 |
| 依存タスク | TASK-031, TASK-032（v2時刻モデル） |

## 背景

### 問題の概要

再生ボタンを押しても何も起きない（音が鳴らず、カーソルも動かない）。詳細は `docs/sdd/troubleshooting/2026-07-05-playback-silent/analysis.md`。

### 根本原因

1. `main.tsx` のStrictModeにより、開発モードでは `usePractice.ts:167-171` のクリーンアップが `useMemo` 保持の同一 `AudioEngineService` を起動直後に `dispose()` し、全シンセが破棄され完全無音になる
2. 再生位置→カーソル連動（REQ-010-005）が未実装
3. `loadAccompaniment`（`audio-engine/index.ts:34-61`）がv2時刻モデルを使わない小節頭固定のスタブのまま

### 関連する仕様

- US-010 / REQ-010-001〜008（`docs/sdd/requirements/stories/US-010.md`）
- `docs/sdd/design/components/data-model-v2.md`（startTick/durationTicks、判定グループ）

## 実装内容

### 修正対象

- `src/renderer/src/lib/audio-engine/index.ts`
- `src/renderer/src/hooks/usePractice.ts`
- `src/renderer/src/App.tsx`
- `src/renderer/src/lib/practice-engine/index.ts`
- `tests/e2e/app.spec.ts`

### 実装手順

1. **StrictMode耐性**: `AudioEngineService` を遅延初期化に変更する。各公開メソッドの先頭で `ensureInitialized()` を呼び、`dispose()` 済みなら再初期化する（`dispose()` は冪等にする）。これによりReact 18開発モードのエフェクト再実行（実行→クリーンアップ→再実行）後も音が出る
2. **時刻ベース再生**: `loadAccompaniment(score, hand)` を `loadScore(score)` に置き換え、全パートの発音ノーツ（`isRest: false`）を `Tone.getTransport().PPQ = score.ticksPerQuarter` のうえ tick表記（`` `${startTick}i` ``、duration `` `${durationTicks}i` ``）で `Tone.Part` に登録する。テンポスライダー（Transport bpm、TASK-027で同期済み）が自然に再生速度へ反映される
3. **カーソル連動（REQ-010-005）**: 判定グループ（同一startTick）ごとに `Tone.getTransport().schedule` でコールバックを登録し、`onPositionChange(measureNumber, groupIndex)` を発火する。`usePractice` でこれをstoreの `currentMeasure`/`currentNoteIndex` 更新に結線する（UI更新は `Tone.getDraw().schedule` 経由）
4. **再生中のMIDI判定停止（REQ-010-007）**: `playbackState === 'playing'` の間、`practiceEngine.handleNoteOn` は `'ignored'` を返す
5. **停止（REQ-010-004）**: 停止時に `Transport.stop()` ＋位置0リセット＋ `practiceEngine.resetToMeasure(ループ有効時はloopStart、無効時は1)`
6. **ループ（REQ-010-008）**: `loopEnabled` 時、ループ小節範囲のstartTickから `Transport.setLoopPoints` / `Transport.loop = true` を設定。無効時は解除
7. **E2E強化**: 再生クリック後に `currentMeasure` または `currentNoteIndex` が実際に進むことをポーリング検証。再生前後で `playbackState` だけでなくカーソル位置を確認（本問題の再発防止）

### 注意事項

- TDDで進める。StrictMode問題は「dispose後にメソッドを呼んでも音源が再初期化される」ユニットテストで再現する（Tone.jsはモック）
- スコア差し替え時（ファイルを開き直したとき）は既存Partをdisposeして再スケジュールする
- メトロノーム（`metronome.ts`）のTransport連動が既存実装で壊れないことを確認する
- `getAccompanimentHand` ヘルパー（App.tsx）は不要になるため削除してよい（REQ-003-004の練習中自動伴奏は本タスクのスコープ外。将来タスクで再生機能と統合して再検討する）

## 受入基準

- [ ] 開発モード（StrictMode）でアプリ起動→曲読み込み→再生ボタンで、Transportにイベントが登録され再生状態になる（dispose再現ユニットテストがグリーン）
- [ ] 全パートのノーツがstartTick/durationTicksどおりにスケジュールされる（ユニットテストで登録イベントのtick検証）
- [ ] 再生中にカーソル（currentMeasure/currentNoteIndex）が進む（E2Eで検証）
- [ ] 再生中のMIDI入力は判定されず、停止/一時停止後に判定が再開される
- [ ] 停止で先頭（ループ有効時はループ開始小節）に戻る
- [ ] ループ有効時、ループ範囲を繰り返し再生する
- [ ] 既存のテストが通る（npm run test / typecheck / lint）
- [ ] E2E（npm run test:e2e）が通る

## テスト項目

- [ ] dispose→ensureInitializedの再初期化（StrictMode再現）
- [ ] loadScoreのイベント登録（tick・duration・全パート）
- [ ] カーソル連動コールバックの発火順
- [ ] 再生中のhandleNoteOn='ignored'
- [ ] 停止時の位置リセット（ループ有無両方）
- [ ] E2E: 再生でカーソルが進む（手動確認: 実機で音が鳴る）

## 情報の明確性

### 明示された情報

- 根拠: `docs/sdd/troubleshooting/2026-07-05-playback-silent/analysis.md`（ユーザー承認済み修正方針）
- 再生は全パート（お手本演奏、US-010）

### 不明/要確認の情報

- なし（すべて確認済み）
