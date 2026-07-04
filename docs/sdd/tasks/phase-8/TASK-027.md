# TASK-027: テンポ・メトロノーム・効果音の結線

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-027 |
| タイプ | bugfix |
| ステータス | DONE |
| 優先度 | High |
| 見積もり | 30分 |
| 依存タスク | TASK-026 |

## 背景

### 問題の概要

テンポスライダー・BPM欄・Metronomeチェックボックスを操作しても聴覚的な効果が一切ない。正誤判定時にも効果音が鳴らない。SettingsModalの「Enable Metronome by Default」設定もツールバーのMetronomeチェックボックスと接続されていない。Resetボタンの戻し先も楽譜由来のテンポではなく120固定。

（分析レポート: `docs/sdd/troubleshooting/2026-07-04-app-unusable/analysis.md` 原因2, 原因4）

### 根本原因

- `src/renderer/src/lib/audio-engine/index.ts:20-26` に `setBpm(bpm)` / `setMetronomeEnabled(enabled)` が実装済みだが、`src/renderer/src/store/slices/ui-slice.ts` の `bpm` / `metronomeEnabled` の変更（`setBpm`/`setMetronomeEnabled`アクション、20-21行目）がこれらのメソッド呼び出しにつながっていない。UI（`TempoControl.tsx`）はストアを更新するのみ。
- 正誤判定時の効果音（`audio-engine/index.ts:82-88` の `playCorrectSound` / `playIncorrectSound`）が `practice-engine`（`src/renderer/src/lib/practice-engine/index.ts`）の判定結果と結線されていない。
- `src/renderer/src/components/SettingsModal/index.tsx:226` の「Enable Metronome by Default」設定値と、`src/renderer/src/store/slices/ui-slice.ts:6,17` の `metronomeEnabled`（初期値`false`）が別々の状態として存在し、相互に未接続。
- `src/renderer/src/components/Toolbar/TempoControl.tsx:66` の Reset ボタンは `setBpm(originalBpm)` を呼ぶが、`originalBpm`（`ui-slice.ts:16` 初期値120固定）はTASK-024で楽譜由来の値に設定されるまでは常に120である。本タスクはTASK-024完了後、正しく設定された`originalBpm`にResetが機能することを確認する。

### 関連する仕様

- US-006（テンポ・メトロノーム調整）: 要件あり・エンジン実装あり・UI結線ゼロ
- US-004（正誤判定）: 判定結果に応じた効果音フィードバックが期待される
- NFR-U-002（日本語UI・設定の一貫性）: 設定画面とツールバーの状態不整合はUXの一貫性を損なう

## 実装内容

### 修正対象

- ファイル: `src/renderer/src/store/slices/ui-slice.ts`
  - 変更内容: `setBpm` / `setMetronomeEnabled` のストア更新後に `audioEngine.setBpm` / `audioEngine.setMetronomeEnabled` を呼び出す仕組みを追加する（ストアsliceに直接AudioEngineを持たせるか、購読側のフックで同期する）。
- ファイル: `src/renderer/src/hooks/usePractice.ts` または新規フック
  - 変更内容: `bpm` / `metronomeEnabled` のストア変更を購読し、`audioEngine.setBpm` / `setMetronomeEnabled` に同期する `useEffect` を追加する。
- ファイル: `src/renderer/src/lib/practice-engine/index.ts`
  - 変更内容: `handleNoteOn` の判定結果（correct/incorrect）に応じて効果音再生のフックポイントを提供する、またはApp.tsx/usePractice.ts側で判定結果を購読して `audioEngine.playCorrectSound()` / `playIncorrectSound()` を呼ぶ。
- ファイル: `src/renderer/src/components/SettingsModal/index.tsx`
  - 変更内容: 226行目の「Enable Metronome by Default」設定を `ui-slice.ts` の `metronomeEnabled` と接続する（設定変更時にストアへ反映、またはアプリ起動時にデフォルト値としてストアへ適用）。
- ファイル: `src/renderer/src/components/Toolbar/TempoControl.tsx`
  - 変更内容: 66行目のResetボタンが `originalBpm`（TASK-024で楽譜由来の値に設定される）に正しく戻ることを確認する（コード変更は不要な想定だが、TASK-024との整合を検証する）。

### 実装手順

TDDで進める。

1. 失敗するテストを先に書く: ストアの `bpm` / `metronomeEnabled` を変更すると `audioEngine.setBpm` / `setMetronomeEnabled` が呼ばれることを検証するテスト。判定結果correct/incorrectで対応する効果音メソッドが呼ばれることを検証するテスト。SettingsModalの「Enable Metronome by Default」変更が `metronomeEnabled` に反映されることを検証するテスト。
2. テストを実行し、失敗（red）を確認してコミットする。
3. `usePractice.ts`（または新規カスタムフック）に、ストアの `bpm` / `metronomeEnabled` を購読し `audioEngine.setBpm` / `setMetronomeEnabled` を呼ぶ `useEffect` を追加する。
4. 正誤判定結果に応じた効果音再生を結線する。`practiceEngine.handleNoteOn` / `handleNoteOff` の戻り値（`NoteJudgement`）をApp.tsxまたはusePractice.ts側で判定し、`result === 'correct'` なら `playCorrectSound()`、`'incorrect'` なら `playIncorrectSound()` を呼ぶ。
5. SettingsModalの「Enable Metronome by Default」を `metronomeEnabled` ストア値と接続する（設定保存時にストアへ反映するか、起動時デフォルト値として読み込む）。
6. TASK-024完了後の `originalBpm` 設定を前提に、Resetボタンが楽譜のテンポへ正しく戻ることを確認する。
7. テストが通る（green）ことを確認する。
8. `npm run dev` で手動E2E確認: テンポスライダー変更で再生速度が変わる、Metronomeチェックでクリック音が鳴る、正誤判定で効果音が鳴る。

### 注意事項

- 効果音の結線は、画面鍵盤クリック経由（`App.tsx:174-189`）とMIDI入力経由（`usePractice.ts:21-39`）の両方の判定結果で発火するようにする。
- ストア変更の購読は無限ループ（ストア更新→AudioEngine呼び出し→再度ストア更新）を起こさないよう、AudioEngine側のメソッドはストアを変更しないことを確認する（現状 `setBpm`/`setMetronomeEnabled` はTone.js/Metronomeクラスのみ操作しており安全）。
- SettingsModalとui-sliceの接続方向は「設定変更が即座にツールバーへ反映される」を基本方針とし、二重管理にならないよう単一の真実源（ui-sliceの`metronomeEnabled`）に統一する。

## 受入基準

- [x] テンポスライダー/BPM欄を変更すると `audioEngine.setBpm` が呼ばれ、再生テンポが変わる（`usePractice`/`App.test.tsx`のテストで`AudioEngineService.prototype.setBpm`呼び出しを確認。実機での音の高低確認は未実施）
- [x] Metronomeチェックボックスの切り替えで `audioEngine.setMetronomeEnabled` が呼ばれ、メトロノーム音のON/OFFが切り替わる（呼び出しをテストで確認。実機でのクリック音ON/OFF確認は未実施）
- [x] 正しい音を弾くと正解効果音（`playCorrectSound`）、誤った音を弾くと不正解効果音（`playIncorrectSound`）が鳴る（MIDI入力経由・画面鍵盤クリック経由の双方でテストにより呼び出しを確認。実機での音出し確認は未実施）
- [x] SettingsModalの「Enable Metronome by Default」変更がツールバーのMetronomeチェックボックス状態に反映される（ui-sliceのmetronomeEnabledへの即時反映・保存失敗時のロールバックをテストで確認）
- [x] Resetボタンで楽譜由来の `originalBpm` に戻る（TASK-024の初期化と整合）（回帰テストを追加し、既存実装で正しく機能することを確認）
- [x] 既存のテストが通る（`npm run test` 全件成功）
- [x] 新規テストが追加されている（必要な場合）

## テスト項目

- [x] （新規）`setBpm` ストアアクション実行で `audioEngine.setBpm` が呼ばれる（`usePractice.test.ts`, `App.test.tsx`）
- [x] （新規）`setMetronomeEnabled` ストアアクション実行で `audioEngine.setMetronomeEnabled` が呼ばれる（`usePractice.test.ts`, `App.test.tsx`）
- [x] （新規）正誤判定結果に応じて `playCorrectSound` / `playIncorrectSound` が呼ばれる（`usePractice.test.ts`, `App.test.tsx`）
- [x] （新規）SettingsModalの「Enable Metronome by Default」変更が `metronomeEnabled` ストア値に反映される（`SettingsModal.test.tsx`）
- [ ] （手動E2E）テンポスライダーを動かすと再生速度が変化する — 実機での音出し確認ができない環境のため未実施
- [ ] （手動E2E）Metronomeチェックでクリック音のON/OFFが切り替わる — 実機での音出し確認ができない環境のため未実施
- [x] （回帰）`npm run test` 全件グリーン、`npm run typecheck` / `npm run lint` パス

## 完了サマリー

- `usePractice`にストアの`bpm`/`metronomeEnabled`変更を購読し`audioEngine.setBpm`/`setMetronomeEnabled`へ同期する`useEffect`を追加。
- MIDI入力経由（`handleMidiNoteOn`）と画面鍵盤クリック経由（新設した`handleKeyClick`、App.tsxのonKeyClickへ接続）の両方で、`handleNoteOn`の判定結果（correct/incorrect）に応じて`playCorrectSound`/`playIncorrectSound`を再生するよう結線。
- `useMidi`へ渡すコールバックを`useCallback`で安定化し、bpm/metronomeEnabled変更のたびにMIDI接続が不要に再初期化される副作用（既存の潜在バグ）を修正。
- SettingsModalの「Enable Metronome by Default」変更時に、単一の真実源であるui-sliceの`metronomeEnabled`へ即座に反映（保存失敗時はロールバック）。App.tsx起動時にはelectron-store永続化された`practice.metronomeEnabled`の既定値をui-sliceへ反映する`useEffect`を追加。
- ResetボタンはTASK-024で実装済みの`originalBpm`（楽譜由来テンポ）への復帰について回帰テストを追加し、既存実装のままで正しく機能することを確認。
- 実機での音出し確認（テンポ変化・メトロノームクリック音のON/OFF）はサンドボックス環境の制約により未実施。テストコードではTone.jsをモックし、`AudioEngineService`のメソッド呼び出しレベルで結線を検証した。

## 情報の明確性

### 明示された情報

- 根本原因のfile:line（分析レポート原因2・原因4、実コードで検証済み: audio-engine/index.ts:20-26,82-88, ui-slice.ts, TempoControl.tsx:66, SettingsModal/index.tsx:226）
- 実装対象: bpm/metronomeEnabledのAudioEngine同期、正誤判定効果音結線、SettingsModalとui-sliceのmetronomeEnabled接続、Resetボタンの originalBpm 整合

### 不明/要確認の情報

- なし（すべて確認済み）
