# TASK-057: [BugFix] 再生中の鍵盤表示を音価（長音/短音）に追随させる

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-057 |
| タイプ | bugfix |
| ステータス | DONE |
| 優先度 | Medium |
| 見積もり | 60分 |
| 依存タスク | なし |

## 背景

### 問題の概要

画面下部の鍵盤で、長音（長い音価）と短音が同時にある場合、長音の押下表示時間が短音と同じになっている（2026-07-06 ユーザー報告）。例えば左手が全音符を押さえたまま右手が四分音符を刻む場合、全音符のキーは鳴り続けているのに表示が先に消える。

### 根本原因

鍵盤のガイド表示は「現在の判定グループ（同一startTickの音集合）」を光らせる方式である。判定グループが次へ進むと前のグループの表示は消えるため、**音価（durationTicks）が表示時間に反映されない**。再生中のカーソル連動（`advanceToPlaybackPosition`）でも同様にグループ単位で表示が入れ替わる。

### 関連する仕様

- US-005（画面鍵盤ガイド）・US-010（曲の再生）
- `docs/sdd/design/components/data-model-v2.md`（Note.startTick / durationTicks）

## 実装内容

### 修正対象

- ファイル: `src/renderer/src/lib/audio-engine/index.ts`（再生位置tickの通知、または発音中ノーツ集合の導出）
- ファイル: `src/renderer/src/hooks/usePractice.ts` / `src/renderer/src/App.tsx`（発音中ノーツのPianoKeyboardへの伝搬）
- ファイル: `src/renderer/src/components/PianoKeyboard/`（発音中表示のレンダリング）

### 実装手順

1. 「発音中ノーツ」の導出を設計する: 再生位置tick `pos` に対し `startTick <= pos < startTick + durationTicks` を満たす発音ノーツ（休符除外・練習対象フィルタ適用後）の集合
2. audio-engine の既存のグループ単位スケジュール（`Transport.schedule`）を拡張し、各ノーツの発音開始・終了時点で発音中集合を更新するコールバックを追加する。終了時点は `startTick + durationTicks` とし、UI更新は `Tone.getDraw().schedule` 経由で行う
3. usePractice で発音中集合を状態として保持し、PianoKeyboard へ渡して点灯表示する（再生中のみ。練習モードのガイド表示＝判定グループとは表示系を分ける）
4. 停止・一時停止時に発音中集合をクリアする
5. テスト: 全音符＋四分音符の混在スコアで、四分音符側のグループが進んでも全音符のキーが `durationTicks` 満了まで点灯し続けること。停止でクリアされること

### 注意事項

- 練習モード（非再生時）のガイド表示は従来どおり「現在の判定グループ」でよい。本タスクの対象は再生中の表示である
- ノーツ数が多い曲でもスケジュール登録が過剰にならないよう、ノーツ単位ではなく開始/終了イベントの集約（同一tickでまとめる）を検討すること

## 受入基準

- [x] 再生中、長音のキーは音価の長さだけ点灯し続け、短音のキーは短く点灯する。audio-engine.testの境界tick到達時に発音中集合が遷移することを検証するテストで確認済み
- [x] 停止・一時停止で発音中表示がクリアされる（audio-engine.testの「clears sounding notes when stopAccompaniment/pauseAccompaniment is called」で検証）
- [x] 練習モードの判定グループ表示（次に弾く鍵のガイド）は従来どおり動作する（既存のexpectedNotes/ガイド色関連テストは変更なしで全通過。keyboard-renderer.testで新色soundingが既存ガイド色と独立に優先度制御されることも検証）
- [x] 既存テストが通り、新規テストが追加されている（`npm run test` 514件全通過。audio-engine.test 7件、usePractice.test 3件、keyboard-renderer.test 6件、PianoKeyboard.test 2件、App.test 1件を新規追加）

## テスト項目

- [x] 全音符＋四分音符の混在で表示時間が音価に追随する（ユニット、audio-engine.test）
- [x] 停止/一時停止でのクリア（ユニット、audio-engine.test）
- [ ] 実機で長音の点灯が聴感と一致する（手動E2E。実機確認は手動E2Eで実施予定。本タスクの実装・自動テストは完了済み）

## 実装サマリー（2026-07-06）

### 設計方針

- **発音中集合の導出**: audio-engineの`loadScore()`内で、既存の判定グループ（同一startTick）スケジュールとは別に、発音中集合の境界イベントを導出する。対象は`scheduledNotes`（休符除外・practiceModeフィルタ適用後）の各ノーツで、`startTick`（開始境界）と`startTick + durationTicks`（終了境界）を`boundaryEvents: Map<tick, {starts, ends}>`へ集約する。同一tickに複数ノーツの開始/終了が重なっても、そのtickにつき`Tone.getTransport().schedule`は1回だけ登録する（過剰スケジュール防止）。
- **状態更新**: 各境界tickのTransportコールバック内で、`ends`を`currentSoundingNotes`から削除→`starts`を追加という順序で処理する。直後に`new Set(...)`でスナップショットを取ってから`Tone.getDraw().schedule`経由でコールバックへ渡す（描画タイミングをメインスレッドの描画パスに乗せつつ、状態競合を避ける）。
- **クリア**: `stopAccompaniment`/`pauseAccompaniment`/スコア差し替え時（`loadScore`冒頭）に発音中集合をリセットし、空集合を通知する。
- **表示系の分離**: `PianoKeyboard`/`keyboard-renderer.ts`に新規`soundingNotes`propを追加し、既存の`expectedNotes`（判定グループガイド）とは独立した表示（新色`KEY_COLORS.*.sounding`）として描画する。優先順位は「誤答 > 正解押鍵 > 発音中 > ガイド > 通常」。`usePractice`は`audioEngine.setSoundingNotesCallback`で受け取った集合をそのままReact state化し、`App.tsx`経由で`PianoKeyboard`へ伝搬する。

### 変更ファイル

- `src/renderer/src/lib/audio-engine/index.ts`: 発音中ノーツ境界スケジュールを追加。追加API: `SoundingNotesChangeCallback`/`setSoundingNotesCallback`/`clearSoundingNoteEvents`/`resetSoundingNotes`
- `src/renderer/src/hooks/usePractice.ts`: `soundingNotes` stateとコールバック登録/解除effectを追加し、戻り値に公開
- `src/renderer/src/App.tsx`: `usePractice().soundingNotes`を`PianoKeyboard`へ伝搬
- `src/renderer/src/components/PianoKeyboard/index.tsx`: `soundingNotes` propを追加し`renderKeyboard`へ伝搬
- `src/renderer/src/components/PianoKeyboard/keyboard-renderer.ts`: `soundingNotes`引数と新色描画ロジックを追加
- `src/renderer/src/components/PianoKeyboard/key-layout.ts`: `KEY_COLORS.white/black.sounding`を追加
- テスト: `audio-engine.test.ts`、`usePractice.test.ts`、`keyboard-renderer.test.ts`、`PianoKeyboard.test.tsx`、`App.test.tsx`に新規テストを追加。既存テストのうちTransport.schedule呼び出し総数を厳密比較していた3件は、境界スケジュール分を除いた先頭N件のみを検証するよう更新（検証対象・意図は変更なし）

## 情報の明確性

### 明示された情報

- 報告: 「画面下キーボードで長音と短音がある場合に、長音を押している表示時間が短音と同じになっている」（2026-07-06 ユーザー。原文の「聴音」は文脈から「長音」と解釈）

### 不明/要確認の情報

- なし
