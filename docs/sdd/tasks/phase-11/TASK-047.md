# TASK-047: 残課題の要件整理と死にコード掃除

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-047 |
| タイプ | docs+chore |
| ステータス | DONE |
| 優先度 | Low |
| 見積もり | 50分 |
| 依存タスク | TASK-044 |

## 背景

### 問題の概要

2026-07-05横断チェックで検出された残課題のうち、要件同士の矛盾整理（M7）、小粒の未実装（M5、REQ-010-002）、潜在レース（M4）、無害な死にコード・ドキュメント乖離（Low群）をまとめて解消する。

（分析レポート: `docs/sdd/troubleshooting/2026-07-05-test-escape/analysis.md` M4・M5・M7・Low）

### 根本原因

- REQ-003-004（片手練習中に非練習パートをアプリ内音源で自動伴奏）はUS-003起草時の要件だが、その後US-010（曲の再生）が全パート再生として実装され（TASK-038）、両者の関係が未整理のまま矛盾している（M7）。
- REQ-010-002（未読込時の再生無効化＋理由ツールチップ）: `PlaybackControls.tsx:98` は `playbackState === 'playing'` でしか無効化しておらず、スコア未読込での無効化とツールチップが未実装。
- REQ-005-006（画面鍵盤クリックで「その音」を再生）: クリックは正誤判定に流れるが、クリックした音自体の再生が未実装（M5。テストが現挙動を期待値化）。
- OSMDの `load()` に再入・キャンセル処理がなく（`ScoreRenderer/index.tsx:42-55`）、ファイル連続オープンで古いloadの `then` が後勝ちし、noteIdマップと表示が不一致になりうる（M4）。
- 死にコード（Low群、実コードで検証済み）:
  - `src/main/midi-controller.ts`（node-midi時代の遺物。Web MIDI移行後は完全未使用）
  - `src/renderer/src/components/Versions.tsx` / `Versions.test.tsx`（テンプレート遺物）
  - `ping` IPC（`src/main/index.ts:63`）
  - preloadの空 `window.api`（`src/preload/index.ts:5,13,45`）
  - `createWindow` の重複（`src/main/index.ts:10-44` の関数と :160-189 のインライン生成が二重定義。`activate` 時のみ前者を使用）
  - `PracticeEngineService.setLoop/clearLoop`（`src/renderer/src/lib/practice-engine/index.ts:200-206`、呼び出しゼロ）
  - `FingeringEngineService.cancel`（`src/renderer/src/lib/fingering-engine/index.ts:63`、呼び出しゼロ）
- CLAUDE.mdの「練習履歴: `history.jsonl`」記載は、実装・要件のいずれも存在しないドキュメント乖離。

### 関連する仕様

- REQ-003-004（自動伴奏）とUS-010（全パート再生）の矛盾 → 本タスクで再整理
- REQ-010-002: 楽曲が読み込まれていない場合、システムは再生コントロールを無効化し、無効である理由をツールチップで提示しなければならない
- REQ-005-006: ユーザーが画面上の鍵盤をクリックした時、システムはその音を再生し、MIDI入力と同様に正誤判定しなければならない

## 実装内容

### 修正対象

1. 要件整理（requirements-definingスキルを使用）
   - ファイル: `docs/sdd/requirements/stories/US-003.md`、`docs/sdd/requirements/stories/US-010.md`。ほかに`docs/sdd/requirements/index.md`と`docs/sdd/requirements/traceability.md`。
   - 変更内容: REQ-003-004とUS-010の関係を再定義し矛盾を解消する。当面は「再生=全パート」を正とし、片手練習時の自動伴奏（REQ-003-004）は将来拡張へ降格（EARS記法のまま「将来対応」と明記、traceabilityにも反映）する方向で整理する。
2. REQ-010-002の実装
   - ファイル: `src/renderer/src/components/Toolbar/PlaybackControls.tsx`
   - 変更内容: スコア未読込時（store `score === null`）に再生ボタンを無効化し、理由（例:「楽譜を開くと再生できます」）をtitleツールチップで表示する。
3. REQ-005-006の実装
   - ファイル: `src/renderer/src/hooks/usePractice.ts`（`handleKeyClick`）、`src/renderer/src/lib/audio-engine/index.ts`
   - 変更内容: 画面鍵盤クリック時にクリックした音（MIDIノート番号）を短く発音する（既存のTone.jsシンセを使用）。正誤判定への流れは従来どおり。現挙動を期待値化していたテストを要件由来に是正する。
4. OSMD load再入対策（M4）
   - ファイル: `src/renderer/src/components/ScoreRenderer/index.tsx`
   - 変更内容: load effect（:42-55）に世代トークンまたは `cancelled` フラグを導入し、effect再実行・アンマウント後に古い `then`（`setIsLoaded(true)` / `buildNoteIdMap`）が実行されないようにする。
5. 死にコード削除
   - `src/main/midi-controller.ts` を削除
   - `src/renderer/src/components/Versions.tsx` / `Versions.test.tsx` を削除
   - `ping` IPC（`src/main/index.ts:63`）と対応するpreload/型定義があれば削除
   - preloadの空 `window.api`（`src/preload/index.ts`）を削除（`electronAPI` は維持）
   - `src/main/index.ts` のウィンドウ生成を `createWindow()` 呼び出しに一本化（:160-189 のインライン生成を統合。MIDI permissionハンドラ等の初期化順序は維持）
   - `PracticeEngineService.setLoop/clearLoop`、`FingeringEngineService.cancel` を削除（対応するユニットテストも削除）
6. ドキュメント整合
   - ファイル: `CLAUDE.md`
   - 変更内容: 「練習履歴: `history.jsonl`」の記載を削除する（実装・要件が存在しないため。将来要件化する場合はUS起票時に復活させる）。

### 実装手順

1. requirements-definingスキルでUS-003/US-010の要件を再整理し、traceability.mdへ反映する（コード変更より先に仕様を確定させる）。
2. TDDでREQ-010-002を実装する: 「スコア未読込時に再生ボタンがdisabledでツールチップが出る」テスト→red→実装→green。
3. TDDでREQ-005-006を実装する: 「鍵盤クリックでその音の発音APIが呼ばれる」テスト→red→実装→green。現挙動を仕様化していた既存テストを是正する。
4. TDDでOSMD load再入対策を実装する: 「連続load時に古いloadの完了処理が無効化される」テスト→red→実装→green。
5. 死にコードを削除し、参照切れがないことを `npm run typecheck` / `npm run lint` / `npm run test` で確認する。
6. CLAUDE.mdから `history.jsonl` 記載を削除する。
7. traceability.mdの REQ-003-004・REQ-005-006・REQ-010-002 行を更新する。

### 注意事項

- 要件の再整理はrequirements-definingスキルを使い、EARS記法・既存のUS/REQ採番規則を維持すること。要件の削除ではなく「将来拡張への降格」として履歴が追える形にする。
- `createWindow` 統合時、現在インライン生成側にしかない初期化（`session.defaultSession.setPermissionRequestHandler` のMIDI許可、:191-197）が起動経路・`activate` 経路の両方で有効なままになるよう注意する。permissionハンドラはウィンドウ生成と独立に1回設定でよい。
- `window.api` 削除時は `src/preload/index.d.ts` 等の型定義・`dts` の宣言も同期して削除する。
- REQ-005-006の発音はTone.js既存シンセの流用とし、新規音源を追加しない。AudioContext未開始（ユーザー操作前）の場合の考慮は既存の再生系実装に合わせる。
- 削除対象が他のブランチ・タスクで使われていないか、着手時点のコードでgrep確認してから消すこと。
- 本タスクはスコープが広いため、コミットを目的別（要件整理／機能実装／掃除／ドキュメント）に分割する。

## 受入基準

- [x] REQ-003-004とUS-010の矛盾が要件ドキュメント上で解消され、traceability.mdに反映されている（完了済み・別コミット 4f75b62「REQ-003-004を将来拡張へスコープ変更」、f88fb2d「traceability更新」）
- [x] スコア未読込時に再生コントロールが無効化され、理由がツールチップで表示される（REQ-010-002）
- [x] 画面鍵盤クリックでクリックした音が再生され、従来どおり正誤判定される（REQ-005-006）
- [x] ファイル連続オープン時に古い `load()` の完了処理が実行されず、noteIdマップと表示が一致する
- [x] 死にコード（midi-controller.ts / Versions / ping / 空window.api / createWindow重複 / setLoop・clearLoop / cancel）が削除され、参照切れがない
- [x] CLAUDE.mdから `history.jsonl` の記載が削除されている
- [x] `docs/sdd/requirements/traceability.md` の該当行が更新されている
- [x] 既存のテストが通る
- [x] 新規テストが追加されている（必要な場合）

## テスト項目

- [x] （新規・コンポーネント）PlaybackControls: `score === null` で再生ボタンdisabled＋ツールチップ表示、読込後に有効化
- [x] （是正・結線）鍵盤クリック→クリック音の発音API呼び出し＋正誤判定（現挙動の仕様化テストを是正）
- [x] （新規・ユニット）ScoreRenderer: 連続load時に先行loadの `setIsLoaded` / `buildNoteIdMap` が無効化される
- [x] （回帰）死にコード削除後に `npm run test` 全件グリーン、`npm run typecheck` / `npm run lint` パス
- [x] （回帰）アプリ起動・`activate` 再起動（macOS経路）でウィンドウが1枚だけ正しく生成される。根拠: `createWindow()`呼び出しへの一本化により、起動経路・activate経路の双方が同一関数を使うことをコードレビューで確認。E2E（`npm run test:e2e`）で起動経路のスモークテストを実施。

## 完了サマリー

- 要件整理（REQ-003-004/US-010の矛盾解消）は別コミット（4f75b62, f88fb2d）で完了済み。本タスクでは残りの実装・掃除項目を実施した。
- REQ-010-002: `PlaybackControls`に`score`propを追加（`Toolbar`経由でApp.tsxの`score`を受け取る）。`score === null`のとき再生/一時停止/停止ボタンをdisabledにし、`title`に「楽譜を開くと再生できます」を表示。`score`未指定（undefined）時は後方互換のため無効化しない。
- REQ-005-006: `usePractice.ts`の`handleKeyClick`で`audioEngine.playNote(midiNumber)`を呼び出すよう結線。正誤フィードバック音（`playCorrectSound`/`playIncorrectSound`、`clickSynth`）とは別チャンネル（`playSynth`）のため同時発音しても干渉しない。
- M4（OSMD load再入対策）: `ScoreRenderer/index.tsx`のload effectに`cancelled`フラグを導入し、effect再実行時に古い`load()`の`.then`（`setIsLoaded`/`buildNoteIdMap`）を無効化。
- 死にコード削除: `src/main/midi-controller.ts`、`src/renderer/src/components/Versions.tsx`/`Versions.test.tsx`、`ping` IPCを削除。preloadの空`window.api`（`electronAPI`は維持）と`PracticeEngineService.setLoop/clearLoop`、`FingeringEngineService.cancel`も削除。`src/main/index.ts`は`createWindow()`呼び出しへ一本化（MIDI許可ハンドラの初期化順序は維持）。すべてgrep確認のうえ参照ゼロであることを確認済み。
- CLAUDE.mdの`history.jsonl`記載を「未実装（将来拡張）」に是正。あわせてmidi-controller.ts削除・createWindow統合を反映。
- 設計書追随: DEC-004・`design/components/midi-controller.md`・`design/components/fingering-engine.md`（cancel削除）を更新。あわせて`design/components/practice-engine.md`（setLoop削除）と`design/components/toolbar.md`（PlaybackControlsの無効化条件）も更新。
- `npm run test`（319件）/ `npm run typecheck` / `npm run lint` / `npm run test:e2e` すべて合格。

## 情報の明確性

### 明示された情報

- 各残課題の根拠file:line（M4: `ScoreRenderer/index.tsx:42-55`、M5: usePracticeの `handleKeyClick`、REQ-010-002: `PlaybackControls.tsx:98`、Low群の死にコード位置はすべて実コードで検証済み）
- 要件整理の当面方針: 「再生=全パート」を正としREQ-003-004を将来拡張へ降格（分析レポート承認待ち方針TASK-047）
- CLAUDE.mdの `history.jsonl` 記載は実装・要件とも存在しないため整理対象

### 不明/要確認の情報

- なし（すべて確認済み。REQ-003-004の最終的な扱い（降格・削除のいずれとするか）はrequirements-defining実施時にユーザー確認のうえ確定する）
