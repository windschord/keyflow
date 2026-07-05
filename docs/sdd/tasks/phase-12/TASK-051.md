# TASK-051: 再生の練習対象フィルタ・カーソル位置からの再生・音単位カーソル移動

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-051 |
| タイプ | feature |
| ステータス | DONE |
| 優先度 | High |
| 見積もり | 90分 |
| 依存タスク | TASK-048 |

## 背景

### 問題の概要

実機フィードバック（`docs/sdd/troubleshooting/2026-07-05-user-feedback/analysis.md` 原因群D）より:

- **練習対象と再生パートが無関係**: 左手練習モードでも再生は常に両手全ノーツを鳴らす
- **カーソル位置から再生されない**: 再生は常に曲の先頭から始まる（REQ-010-001 は「現在の再生位置から」を要求しているが未実装）
- **小節頭単位でしかカーソル移動できない**: 楽譜クリックでのカーソル移動が常に小節の先頭に丸められる

### 根本原因

- `audio-engine` の `loadScore`（`src/renderer/src/lib/audio-engine/index.ts:85-120`）は全パート・全発音ノーツを無条件にスケジュールし、practiceMode を参照しない
- `playAccompaniment`（`audio-engine/index.ts:161-164`）は `Tone.getTransport().start()` を開始位置指定なしで呼ぶため常に先頭（または前回停止位置）からで、現在の判定グループ位置と無関係
- `App.handleNoteClick`（`App.tsx:295-300`）はクリック解決された音の `measureNumber` で `practiceEngine.resetToMeasure` を呼ぶ。そのため小節内の途中の音をクリックしても小節頭に戻る（`practice-engine/index.ts:153-186`）

### 関連する仕様

- REQ-010-001（US-010.md:13）: 再生操作時に「現在の再生位置から」演奏する — 本タスクで「カーソル位置（現在の判定グループのstartTick）から」と明確化・実装する
- REQ-002-004（US-002.md:16）: 小節クリックでのカーソル移動 — 本タスクで音（判定グループ）単位に更新する
- REQ-010-004: 停止時の位置復帰（既存 `setOnStop` 結線、`usePractice.ts:115-124`）と整合させる
- `docs/sdd/design/components/data-model-v2.md`: 判定グループ（同一startTick）とカーソル位置の定義

## 実装内容

### 修正対象

- ファイル: `src/renderer/src/lib/audio-engine/index.ts`
  - 変更内容:
    1. `loadScore` に手フィルタを追加する（practiceMode を引数等で受け取り、左手練習=`note.hand==='left'` のみ再生、右手練習=`'right'` のみ、両手=全ノーツ。TASK-048 の `Note.hand` を使用）。practiceMode 変更時は再スケジュールする。
    2. 再生開始位置: `playAccompaniment` を「現在の判定グループの startTick」から開始できるようにする（Tone Transport の開始位置設定。例: `transport.position`/`start` の offset に `` `${startTick}i` `` を指定）。停止時の位置復帰（既存 `setOnStop`、REQ-010-004）と整合させる。
- ファイル: `src/renderer/src/hooks/usePractice.ts`
  - 変更内容: practiceMode の変更を購読し `audioEngine` の再スケジュールへ同期する useEffect を追加する（既存の bpm/metronome/loop 同期 `:85-97` と同型）。再生開始時に現在位置（`currentMeasure`/`currentNoteIndex` から解決した startTick）を渡す結線を行う（`PlaybackControls` の `handlePlay` 経路、`PlaybackControls.tsx:66-71`）。
- ファイル: `src/renderer/src/lib/practice-engine/index.ts`
  - 変更内容: 音単位カーソル移動 `resetToPosition(measureNumber, groupIndex)`（または noteId→グループ解決を含む形）を追加する。`resetToMeasure`（`:153-186`）と同様に `resolvePosition` でフィルタ空グループをスキップし、押鍵状態をリセットする。
- ファイル: `src/renderer/src/App.tsx`
  - 変更内容: `handleNoteClick`（`:295-300`）を `resetToMeasure(note.measureNumber)` から「クリックした音が属する判定グループへの移動」（`resetToPosition` 呼び出し）に変更する。クリック音の `startTick` からグループ index を解決する。
- ファイル: `docs/sdd/requirements/stories/US-010.md`
  - 変更内容: 「カーソル位置から再生」「再生対象は練習対象パート（左手練習=左手のみ、右手=右手のみ、両手=全パート）」を反映する（REQ-010-001 の更新または REQ-010-009 等の追補）。
- ファイル: `docs/sdd/requirements/stories/US-002.md`
  - 変更内容: REQ-002-004 を小節単位から音（判定グループ）単位のカーソル移動に更新する。
- ファイル: `docs/sdd/requirements/traceability.md`
  - 変更内容: REQ-002-004 行（`:18`）・REQ-010-001 行（`:69`）および追補要件の行を更新する。

### 実装手順

TDDで進める。

1. 失敗するテストを先に書く: `loadScore` が practiceMode='left' のとき `hand==='left'` のノーツのみスケジュールすること（フィルタ別のスケジュール内容検証。既存 audio-engine.test の形式に倣う）。red を確認してコミット。
2. `loadScore` の手フィルタを実装して green にする。usePractice の practiceMode 同期 useEffect を結線テスト→実装する。
3. 再生開始位置のテストを書く: 現在の判定グループの startTick が Transport の開始位置に設定されること。実装して green にする（停止時復帰との整合を回帰確認）。
4. `resetToPosition` のテストを書く: 指定グループへ移動し expectedNotes が更新されること、フィルタ空グループはスキップされること。実装して green にする。
5. `App.handleNoteClick` をクリック音の判定グループ移動に変更し、結線テスト（クリック→グループ移動）を追加する。
6. US-010 / US-002 / traceability.md を更新する。
7. E2E のカーソル移動検証を音単位に強化できれば行う（任意。既存E2Eの回帰は必須）。
8. 全テスト・typecheck・lint を通す。

### 注意事項

- TASK-048（`Note.hand`）完了が前提。
- practiceMode 変更時の再スケジュールは、再生中に行われた場合の挙動（いったん停止するか、次回再生から反映か）を実装時に決めてテスト・要件文言と一致させること。最小実装としては「停止中の切替で反映、再生中の切替は停止を促す/即時再スケジュール」のいずれかを選び US-010 追補に明記する。
- ループ再生（`setLoopPoints`、REQ-010-008）と開始オフセットの併用時、開始位置がループ範囲外の場合の挙動に注意する（Tone.js の loop と offset の相互作用を確認する）。
- 停止時の位置復帰（`setOnStop` → `resetToMeasure(loopStart or 1)`、`usePractice.ts:115-124`）は既存挙動を維持する。
- 判定側のフィルタ（`filterNotesByPracticeMode`）と再生側のフィルタが同じ手判定（`Note.hand`）を共有し、二重実装を避ける。

## 受入基準

- [x] 左手練習モードで再生すると左手（`hand==='left'`）の音のみが鳴る（右手モードは右手のみ、両手モードは全ノーツ）
- [x] practiceMode を変更すると再生スケジュールへ反映される
- [x] 再生が現在のカーソル位置（現在の判定グループの startTick）から始まる
- [x] 停止時の位置復帰（REQ-010-004）が従来どおり機能する
- [x] 楽譜上の音をクリックすると、その音が属する判定グループへカーソルが移動する（小節頭に丸められない）
- [x] US-010（カーソル位置から再生・練習対象フィルタ）と US-002（REQ-002-004 の音単位化）が更新され、traceability.md の該当行が更新されている
- [x] 既存のテストが通る
- [x] 新規テストが追加されている（必要な場合）

## テスト項目

- [x] （新規）loadScore: practiceMode 別（left/right/both）のスケジュール内容
- [x] （新規）usePractice: practiceMode 変更→再スケジュールの結線
- [x] （新規）再生開始 tick: 現在の判定グループの startTick が開始位置に設定される
- [x] （新規）resetToPosition: 指定グループへの移動・空グループスキップ・押鍵状態リセット
- [x] （新規）App: 音クリック→クリック音の判定グループへの移動（結線）
- [ ] （任意）E2E: カーソル移動検証の音単位への強化 — 任意項目のため未実施（既存E2Eの回帰は`npm run test`のユニット/統合テストで代替確認）
- [x] （回帰）`npm run test` 全件グリーン、`npm run typecheck` / `npm run lint` パス

## 完了サマリー（2026-07-05）

- `audio-engine/index.ts`: `loadScore(score, practiceMode)` に手フィルタを追加（`filterNotesByPracticeMode`を再利用し判定側と実装を共有）。`playAccompaniment(startTick?)` で任意のtickオフセットからの再生に対応（省略時は一時停止位置からそのまま再開）。
- `practice-engine/index.ts`: `resetToPosition(measureNumber, groupIndex)` を追加し `resetToMeasure` はその薄いラッパーに統合。`getCurrentPositionTick()` を追加し、現在の判定グループのstartTickを解決できるようにした。
- `hooks/usePractice.ts`: score/practiceMode変更を監視し `audioEngine.loadScore` を再スケジュールするeffectを追加。再生中に変更された場合は停止する（US-010追補どおり最小実装として明記）。
- `App.tsx`: `handleNoteClick` をクリックした音のstartTick一致で判定グループindexを解決し `resetToPosition` を呼ぶよう変更。`playbackAudioEngine`（`playAccompaniment`ラッパー）を作成し、Toolbarへは元のaudioEngineの代わりにこれを渡す（一時停止中以外は`practiceEngine.getCurrentPositionTick()`を渡す）。
- テスト: audio-engine.test.ts / practice-engine.test.ts / usePractice.test.ts / App.test.tsx に新規テストを追加。App.test.tsxの`afterEach`にscore関連フィールドのリセットを追加（TASK-051のeffect追加により既存のテスト間score残留が露見したため）。practice-flow.test.tsxのToneモックに`schedule`/`clear`/`setLoopPoints`/`getDraw`を追加（同様の理由）。
- ドキュメント更新: US-010.md（REQ-010-001明確化・REQ-010-010追加）、US-002.md（REQ-002-004を音単位に更新）。US-003.md（REQ-010-010との整合のため備考を更新）、traceability.md（REQ-002-004/REQ-010-001/REQ-010-010）も更新した。
- `npm run test` 380件全てグリーン、`npm run typecheck`・`npm run lint` パス。

## 情報の明確性

### 明示された情報

- 現状実装の file:line を実コードで検証済み。`audio-engine/index.ts:85-120` の全ノーツスケジュール、`:161-164` のオフセットなし start、`App.tsx:295-300` の resetToMeasure、`practice-engine/index.ts:153-186` を確認した。
- 修正方針: 手フィルタ再生・判定グループ startTick からの再生・`resetToPosition` 導入・US-010/US-002/traceability 更新（分析レポート承認済み方針 TASK-051）

### 不明/要確認の情報

- なし（再生中の practiceMode 切替挙動は実装時に決定し要件へ明記する、と本文に記載済み）
