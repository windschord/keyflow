# TASK-042: [BugFix] メトロノームのTransport起動/停止の非対称修正

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-042 |
| タイプ | bugfix |
| ステータス | TODO |
| 優先度 | High |
| 見積もり | 30分 |
| 依存タスク | なし |

## 背景

### 問題の概要

スコアをロード済みの状態でメトロノームをONにすると、意図していない伴奏再生（お手本演奏）が同時に始まってしまう。さらにメトロノームをOFFにしてもTransportは止まらないため、UIの `playbackState`（'stopped' のまま）と実際の音の状態が乖離する。

（分析レポート: `docs/sdd/troubleshooting/2026-07-05-test-escape/analysis.md` M1）

### 根本原因

- `src/renderer/src/lib/audio-engine/metronome.ts:24-25` で、`setEnabled(true)` が `this.sequence.start(0)` に加えて **`Tone.getTransport().start()` を呼んでいる**。Transportはグローバル共有であり、`loadScore` で伴奏ノーツがスケジュール済みの場合、メトロノームONだけで伴奏再生が開始される。
- 一方 `setEnabled(false)`（同 :26-30）は `sequence.stop()` のみでTransportを止めない（起動/停止が非対称）。意図せず始まった伴奏はメトロノームOFFでも止まらない。
- Transportの起動/停止は本来、再生コントロール（play/pause/stop→`playbackState`、`src/renderer/src/store/slices/playback-slice.ts`）だけが行うべきで、メトロノームが勝手に起動するのは責務違反。
- 既存テスト（`audio-engine.test.ts`）はモック上で `sequence.start` を確認するのみで、Transport状態との整合を検証していないため緑のまま。

### 関連する仕様

- REQ-006-005: ユーザーがメトロノームを有効にした時、システムは設定されたテンポでクリック音を鳴らしながら練習できなければならない
- US-010（曲の再生）: Transportのライフサイクルは再生コントロールが管理する（TASK-038で確立した設計）
- `docs/sdd/requirements/traceability.md` REQ-006-005行: 「△ モック上のsequence.start確認のみ。Transport起動/停止の非対称バグあり（TASK-042）」

## 実装内容

### 修正対象

- ファイル: `src/renderer/src/lib/audio-engine/metronome.ts`
  - 変更内容: `setEnabled(true)` から `Tone.getTransport().start()` を削除する。メトロノームはTransportを起動せず、シーケンスの `start`/`stop` のみを管理する（Transportが走っているとき＝再生中のみクリックが鳴る設計に変更）。
- ファイル: `src/renderer/src/lib/audio-engine/index.ts`
  - 変更内容: 必要に応じて `setMetronomeEnabled`（:68）まわりを調整し、「再生中にONにしたら即クリックが鳴り始める」「停止中にONにしても音は出ず、再生開始時に鳴り始める」動作を保証する。
- ファイル: `src/renderer/src/lib/audio-engine/audio-engine.test.ts`
  - 変更内容: `playbackState` との整合を検証するテストを追加する（下記テスト項目）。

### 実装手順

TDDで進める。

1. 失敗するテストを先に書く: (a) 停止中に `setMetronomeEnabled(true)` を呼んでも `Transport.start` が呼ばれない、(b) `setMetronomeEnabled(false)` が再生中のTransportを止めない、(c) 再生中にONにするとシーケンスが開始される。
2. テストを実行し、失敗（red）を確認してコミットする（現実装は(a)で `Transport.start` が呼ばれるため失敗するはず）。
3. `metronome.ts` から `Tone.getTransport().start()` を削除し、シーケンスの `start`/`stop` のみとする。
4. 再生開始/停止（AudioEngineのplay/stop経路）とメトロノーム有効状態の組み合わせで正しくクリックが鳴る/止まることを確認し、必要なら `audio-engine/index.ts` 側を調整する。
5. テストが通る（green）ことを確認する。
6. `docs/sdd/requirements/traceability.md` の REQ-006-005 行を更新する。

### 注意事項

- Transportの起動/停止の責務は再生コントロール（play/pause/stop）のみに置くこと。メトロノーム側からTransportの状態を変更してはならない。
- `Tone.Sequence.start(0)` はTransport停止中に呼んでも即座には発音せず、Transport開始時に走り出す（Tone.jsの仕様）。この性質を利用して「有効化＝スケジュール、発音＝Transport追従」とするのが最小修正。
- 再生停止時にメトロノームだけ鳴り続ける逆パターンが生じないことも確認する（Transport停止でシーケンスも止まるため通常は問題ないが、テストで固定する）。
- メトロノームを単独で鳴らす機能（再生していないときのクリック）は現行要件にないため実装しない。REQ-006-005は「練習しながらクリックを聞ける」ことが主旨であり、「再生に追従」で満たす。
- `metronome.ts` の `dispose` / `isEnabled` の既存挙動は変更しない。

## 受入基準

- [ ] スコアロード済み・停止中にメトロノームをONにしても伴奏再生が始まらない（`Transport.start` が呼ばれない）
- [ ] 再生中にメトロノームをONにするとクリックが鳴り、OFFにするとクリックだけが止まる（伴奏は続く）
- [ ] メトロノームON/OFFのどの操作でも `playbackState` と実際のTransport状態が乖離しない
- [ ] `docs/sdd/requirements/traceability.md` の REQ-006-005 行が更新されている
- [ ] 既存のテストが通る
- [ ] 新規テストが追加されている（必要な場合）

## テスト項目

- [ ] （新規・ユニット）`setEnabled(true)` が `Transport.start` を呼ばない
- [ ] （新規・ユニット）`setEnabled(true)` でシーケンスが `start` され、`setEnabled(false)` で `stop` される
- [ ] （新規・結線）AudioEngine: 停止中のメトロノームONで再生が始まらない／再生中のOFFで再生が止まらない（playbackState整合）
- [ ] （回帰）メトロノーム有効時、再生開始でクリックがスケジュールされる（既存テストの維持）
- [ ] （回帰）`npm run test` 全件グリーン、`npm run typecheck` / `npm run lint` パス

## 情報の明確性

### 明示された情報

- 根本原因のfile:line（M1、実コードで検証済み: `metronome.ts:24-25` の `Transport.start()`、:26-30 の非対称、`audio-engine/index.ts:68` の結線、`usePractice.ts:90` からの呼び出し）
- 修正方針: メトロノームはTransportを起動せず、再生状態に追従してクリックを鳴らす（分析レポート承認待ち方針TASK-042）

### 不明/要確認の情報

- なし（すべて確認済み）
