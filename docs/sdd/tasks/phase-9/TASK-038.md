# TASK-038: [BugFix] 曲の再生の本実装（StrictMode耐性・時刻ベーススケジューリング・カーソル連動）

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-038 |
| タイプ | bugfix |
| ステータス | DONE |
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
2. **時刻ベース再生**: `loadAccompaniment(score, hand)` を `loadScore(score)` に置き換える。全パートの発音ノーツ（`isRest: false`）を、`Tone.getTransport().PPQ = score.ticksPerQuarter` のうえ `Tone.Part` に登録する。tick表記（`` `${startTick}i` ``、duration `` `${durationTicks}i` ``）を用いる。テンポスライダー（Transport bpm、TASK-027で同期済み）が自然に再生速度へ反映される
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

- [x] 開発モード（StrictMode）でアプリ起動→曲読み込み→再生ボタン押下により、Transportにイベントが登録され再生状態になる（dispose再現ユニットテストがグリーン）
- [x] 全パートのノーツがstartTick/durationTicksどおりにスケジュールされる（ユニットテストで登録イベントのtick検証）
- [x] 再生中にカーソル（currentMeasure/currentNoteIndex）が進む（E2Eで検証）
- [x] 再生中のMIDI入力は判定されず、停止/一時停止後に判定が再開される
- [x] 停止で先頭（ループ有効時はループ開始小節）に戻る
- [x] ループ有効時、ループ範囲を繰り返し再生する（`setLoopPoints`のユニットテストで検証。Transport.loop/setLoopPointsへの反映を確認。実機での繰り返し再生の聴感確認は不可のため代理指標）
- [x] 既存のテストが通る（npm run test / typecheck / lint）
- [x] E2E（npm run test:e2e）が通る

## テスト項目

- [x] dispose→ensureInitializedの再初期化（StrictMode再現）
- [x] loadScoreのイベント登録（tick・duration・全パート）
- [x] カーソル連動コールバックの発火順
- [x] 再生中のhandleNoteOn='ignored'
- [x] 停止時の位置リセット（ループ有無両方）
- [x] E2E: 再生でカーソルが進む（手動確認: 実機で音が鳴る、は環境上不可のため代理指標で確認）

## 完了サマリー

- `AudioEngineService`を遅延初期化（`ensureInitialized()`）＋冪等`dispose()`に変更し、StrictModeの「実行→クリーンアップ→再実行」サイクルで無音化する原因1を解消。
- `loadAccompaniment`（小節頭固定スタブ）を`loadScore`に置換した（原因3の解消）。`Tone.getTransport().PPQ = score.ticksPerQuarter`のうえ全パートの発音ノーツを`startTick`/`durationTicks`（tick表記）で`Tone.Part`にスケジュールする。
- 判定グループ（同一startTick）ごとに`Tone.getTransport().schedule`＋`Tone.getDraw().schedule`でカーソル連動コールバックを登録。`practiceEngine.advanceToPlaybackPosition`経由で`currentMeasure`/`currentNoteIndex`を更新（原因2＝REQ-010-005の実装）。
- `practice-engine.handleNoteOn`の先頭で`playbackState==='playing'`を判定し、再生中はMIDI判定を`ignored`にして副作用なしで早期リターン（REQ-010-007）。
- 停止操作は`audioEngine.setOnStop`経由で`practiceEngine.resetToMeasure(loopEnabled ? loopStart : 1)`を呼び出し、先頭/ループ開始小節へ復帰（REQ-010-004）。
- `audioEngine.setLoopPoints(score, loopEnabled, loopStart, loopEnd)`をuseEffectでストアに同期し、`Transport.setLoopPoints`/`Transport.loop`を設定（REQ-010-008）。
- **実装中に新たな根本原因を発見・修正**: `src/renderer/index.html`のCSPは`script-src 'self'`のみで`worker-src`が未指定だった。このため、Tone.jsのTransport内部tickerが使用するblob URL Web Workerの生成がブロックされ、`Transport.schedule()`系のコールバックが一切発火しない状態だった。なお`Transport.seconds`/`.position`はcontext.currentTimeから計算される純粋なgetterであり、見かけ上正常に進行して見えるため発覚しにくい。`worker-src 'self' blob:`をCSPに追加して解消。これがなければStrictMode対応後も実機で無音・カーソル停止のままだった。
- E2E（`tests/e2e/app.spec.ts`）を強化し、再生クリック後に`currentMeasure`/`currentNoteIndex`が実際に進行すること、停止操作で先頭小節（1, 0）に復帰することをポーリング検証するよう変更。
- 実機の音出し確認は環境上不可能なため、Transportへのイベント登録数（ユニットテスト）およびE2Eでのカーソル進行を代理指標として確認した。

## 情報の明確性

### 明示された情報

- 根拠: `docs/sdd/troubleshooting/2026-07-05-playback-silent/analysis.md`（ユーザー承認済み修正方針）
- 再生は全パート（お手本演奏、US-010）

### 不明/要確認の情報

- なし（すべて確認済み）
