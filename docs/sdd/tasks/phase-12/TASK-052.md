# TASK-052: 音量調整（マスターボリューム）

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-052 |
| タイプ | feature |
| ステータス | DONE |
| 優先度 | Medium |
| 見積もり | 40分 |
| 依存タスク | なし |

## 背景

### 問題の概要

アプリ内で音量を変更する手段が存在しない。再生（伴奏）・メトロノーム・効果音の音量はOS側でしか調整できない。

（分析レポート: `docs/sdd/troubleshooting/2026-07-05-user-feedback/analysis.md` 原因群D「音量変更不可」）

### 根本原因

マスターボリューム制御が未実装。`AudioEngineService`（`src/renderer/src/lib/audio-engine/index.ts`）は各シンセを `.toDestination()` で直結しており（`:44-46`）、Destination の音量を操作するAPI・UI・永続化のいずれも存在しない。

### 関連する仕様

- US-010 データ要件（US-010.md:31）: 「再生音量・音色の設定は将来の拡張とし、本ストーリーでは既定値を用いる」— 本タスクで音量部分を実装に昇格する
- NFR（usability）: ツールバーの日本語ラベル・ツールチップ方針（Phase 8 TASK-028 で確立）
- `docs/sdd/design/components/audio-engine.md`: AudioEngine の責務

## 実装内容

### 修正対象

- ファイル: `src/renderer/src/lib/audio-engine/index.ts`
  - 変更内容: `setMasterVolume(volume: number)` を追加する（0〜100 等の線形UI値を受け取り、`Tone.getDestination().volume`（dB）へ変換して設定する。0 はミュート（`mute = true` または `-Infinity` dB）として扱う）。
- ファイル: `src/renderer/src/components/Toolbar/`（新規 `VolumeControl.tsx` 等）
  - 変更内容: 音量スライダーを追加する（日本語ラベル「音量」・ツールチップ付き。置き場所は再生コントロール（`Toolbar/index.tsx:34` の `PlaybackControls`）付近）。
- ファイル: `src/renderer/src/store/slices/ui-slice.ts`
  - 変更内容: `volume` / `setVolume` を追加する（範囲クランプ含む）。
- ファイル: `src/renderer/src/types/settings.ts`・`src/main/settings.ts`
  - 変更内容: `AppSettings` に音量（例: `ui.volume` または `audio.volume`）を追加し、`DEFAULT_SETTINGS` に既定値を定義する（electron-store 永続化）。
- ファイル: `src/renderer/src/App.tsx`・`src/renderer/src/hooks/usePractice.ts`
  - 変更内容: 起動時ロード（既存の設定ロード useEffect `App.tsx:121-155` に追加）と、store の `volume` 変更→`audioEngine.setMasterVolume` 同期（既存の bpm 同期 `usePractice.ts:85-87` と同型の useEffect）、UI変更時の electron-store 保存を結線する。

### 実装手順

TDDで進める。

1. 失敗するテストを先に書く: `setMasterVolume` が UI値→dB 変換して Destination に設定すること（0 でミュート、最大値で 0dB 付近、単調増加）。red を確認してコミット。
2. `setMasterVolume` を実装して green にする。
3. ui-slice の `volume`/`setVolume`（クランプ含む）をテスト→実装する。
4. VolumeControl（スライダーUI）をテスト→実装する（ラベル・ツールチップ・操作で `setVolume` が呼ばれる）。
5. 結線: store→audioEngine 同期の useEffect、起動時の electron-store ロード、変更時の保存をテスト→実装する。
6. 全テスト・typecheck・lint を通す。

### 注意事項

- dB変換は線形値の対数変換（例: `20 * log10(v/100)`）等を用い、0 を `-Infinity`/ミュートとして特別扱いすること（`log10(0)` の NaN に注意）。
- マスターボリュームは伴奏・メトロノーム・効果音すべてに掛かる（Destination 直結のため）。個別音量は本タスクのスコープ外。
- `AudioEngineService` は遅延初期化（`ensureInitialized`）と冪等 `dispose` を持つ（`audio-engine/index.ts:22-49`）。dispose→再初期化後も音量設定が失われない（store の値から再同期される）ことを確認する。
- ツールバーの既存スタイル（高さ44px・日本語ラベル・ツールチップ）に合わせる。
- US-010 の「再生音量は将来の拡張」記述（US-010.md:31）と矛盾しないよう、実装に合わせて同記述の更新を検討する（軽微なドキュメント整合）。

## 受入基準

- [x] ツールバーの音量スライダーで再生・メトロノーム・効果音の音量が変わる
- [x] スライダー0でミュートになる
- [x] 音量設定がelectron-storeに永続化され、アプリ再起動後に復元される
- [x] スライダーに日本語ラベルとツールチップがある
- [x] 既存のテストが通る
- [x] 新規テストが追加されている（必要な場合）

## テスト項目

- [x] （新規）audio-engine: `setMasterVolume` のdB変換・ミュート・境界値
- [x] （新規）ui-slice: `volume`/`setVolume` のクランプ
- [x] （新規）VolumeControl: スライダー操作→`setVolume` 呼び出し、ラベル・ツールチップ
- [x] （新規）結線: store の volume 変更→`audioEngine.setMasterVolume`、起動時ロード、変更時保存
- [x] （回帰）`npm run test` 全件グリーン、`npm run typecheck` / `npm run lint` パス
  （TASK-052スコープ外のosmd-controller.test.ts失敗を除く。TASK-048担当エージェントが
  同一タイムスタンプで並行修正中の`setGrayedOutNotes`未実装によるもので、60秒後の
  再実行でも同様に別ファイルの失敗として再現し、本タスクの変更とは無関係と判断した）

## 情報の明確性

### 明示された情報

- マスターボリューム制御が存在しないこと（実コードで検証済み: `audio-engine/index.ts:44-46` の Destination 直結、音量API・UI・設定なし）
- 修正方針: `Tone.getDestination().volume`（dB変換・ミュート考慮）＋ツールバースライダー＋electron-store 永続化＋ui-slice（分析レポート承認済み方針 TASK-052）

### 不明/要確認の情報

- なし（すべて確認済み）

## 完了サマリー

- `AudioEngineService.setMasterVolume(volume)` を追加。0〜100のUI線形値を
  `20 * log10(v/100)` でdB変換し `Tone.getDestination().volume.value` へ設定。
  0は`Destination.mute = true`で明示的にミュート（`log10(0)`のNaNを回避）。
  伴奏・メトロノーム・効果音は共通Destinationに直結しているため一括で反映される。
- `ui-slice` に `volume`（初期値80）・`setVolume`（0〜100クランプ）を追加。
- `Toolbar/VolumeControl.tsx` を新規追加し、`Toolbar/index.tsx`の
  `PlaybackControls`直後に組み込み。日本語ラベル「音量:」・ツールチップ付き。
  変更時に`setVolume`を即時反映しつつ、electron-store `ui`設定へ
  （既存値とマージして）永続化する。
- `usePractice.ts` に `volume` 用の同期`useEffect`を追加（bpm/metronomeEnabledと同型）。
- `App.tsx` の起動時設定ロードに `ui.volume` → `setVolume` の反映を追加
  （zoom/pianoHeightと同型）。
- `AppSettings.ui.volume`（既定値80）を renderer/main 双方の型定義に追加し、
  `SettingsModal`のDEFAULT_SETTINGSも型整合のため更新。
- US-010.md に REQ-010-009 を新規追加し、「再生音量は将来の拡張」の記述を
  実装済みである旨に更新。traceability.mdにREQ-010-009の追跡行を追加。
- テスト: audio-engine（setMasterVolume, 6件）、ui-slice（volume/setVolume, 5件）、
  VolumeControl（7件）、usePractice（volume同期, 1件）、App.tsx（起動時ロード, 1件）
  を新規追加。全てTDD（Red→Green）で進めた。
- `npm run test`はTASK-052の変更範囲内で全件グリーン（プロジェクト全体では
  TASK-048担当エージェントが並行修正中の`osmd-controller.test.ts`
  （`setGrayedOutNotes`未実装）のみが失敗しており、本タスクとは無関係）。
  `npm run typecheck` / `npm run lint` はプロジェクト全体でパス。
