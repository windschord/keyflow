# TASK-061: [BugFix] メトロノーム無音の修正（Sequence nullイベント）

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-061 |
| タイプ | bugfix |
| ステータス | TODO |
| 優先度 | High |
| 見積もり | 30分 |
| 依存タスク | なし |

## 背景

### 問題の概要

ツールバーのメトロノームチェックボックスをONにしても、再生中にクリック音が一切鳴らない。

（分析レポート: `docs/sdd/troubleshooting/2026-07-07-metronome-no-sound/analysis.md`）

### 根本原因

- `src/renderer/src/lib/audio-engine/metronome.ts:16-22` で `Tone.Sequence` のイベント配列が
  `[null]` になっている。tone@15.1.22 の `Sequence` は `null` イベントを休符として扱い、
  コールバック自体を呼ばない（`node_modules/tone/build/esm/event/Sequence.js:67`
  `_seqCallback` の `if (value !== null && !this.mute)` ガード）。
  そのためクリックのコールバックは一度も発火せず、`triggerAttackRelease` に到達しない。
- 既存テスト（`audio-engine.test.ts`）はモック上で `sequence.start(0)` の呼び出しのみを
  検証しており、「コールバックが発火して synth が発音する」結線が未検証だった
  （再発防止原則「モック境界には結線テストを対で書く」違反）。

### 関連する仕様

- REQ-006-005: ユーザーがメトロノームを有効にした時、システムは設定されたテンポでクリック音を鳴らしながら練習できなければならない
- TASK-042 で確立した設計: Transport ライフサイクルは再生コントロール専属。メトロノームは `sequence.start(0)`/`stop()` のみを管理する。この設計は本タスクでも維持する。

## 実装内容

### 修正対象

- ファイル: `src/renderer/src/lib/audio-engine/metronome.ts`
  - 変更内容: `Tone.Sequence` のイベント配列を `[null]` から `[0]`（発火する値）へ変更する。
    コールバックのシグネチャは `(time) => ...` のままでよい（第2引数 value は未使用）。
- ファイル: `src/renderer/src/lib/audio-engine/audio-engine.test.ts`
  - 変更内容: 結線テストを追加する（下記テスト項目）。

### 実装手順

TDDで進める。

1. 失敗するテストを先に書く。Tone.js の `null` スキップ仕様をエミュレートするヘルパーを
   テスト側に用意する:
   - Tone モックの `Sequence` コンストラクタが受け取った `(callback, events, subdivision)` を
     記録できるようにする（既存モックを拡張）。
   - ヘルパー `fireSequenceTick(sequence, time)`: 記録した events を走査し、
     **`value !== null` の場合のみ** `callback(time, value)` を呼ぶ（Tone本体の
     `_seqCallback` と同一の判定。この判定ロジックがテストの肝であり、弱めてはならない）。
2. テスト「メトロノーム有効時、Sequence のティック発火で synth.triggerAttackRelease が
   呼ばれる」を書き、Red を確認してコミットする（現実装は events が `[null]` のため
   コールバックが呼ばれず失敗するはず）。
3. `metronome.ts` のイベント配列を `[0]` へ変更し、Green を確認する。
4. 既存テスト（`sequence.start(0)` / Transport 非起動の検証）が全て通ることを確認する。
5. `docs/sdd/requirements/traceability.md` の REQ-006-005 行を「発音結線まで検証済み」に更新する。

### 注意事項

- `'4n'` サブディビジョン・`'C5'`・`'32n'` の既存パラメータは変更しない（アクセント対応は
  TASK-062 で行う）。
- Transport の起動/停止に触れないこと（TASK-042 の設計維持）。
- テストの期待値は REQ-006-005（クリックが発音される）から導くこと。実装の現挙動に
  合わせてテストを弱めてはならない。

## 受入基準

- [ ] メトロノーム有効時、Sequence のティック発火で `synth.triggerAttackRelease` が呼ばれる（結線テストで検証）
- [ ] イベント配列に `null` 以外の値が含まれる（Tone の null スキップ仕様で無音にならない）
- [ ] 停止中のメトロノームONで `Transport.start` が呼ばれない（既存テスト維持）
- [ ] `docs/sdd/requirements/traceability.md` の REQ-006-005 行が更新されている
- [ ] `npm run test` / `npm run typecheck` / `npm run lint` が全てパスする

## テスト項目

- [ ] （新規・結線）メトロノーム有効時、Tone の null スキップ仕様をエミュレートした
  ティック発火で `triggerAttackRelease('C5', '32n', time)` が呼ばれる
- [ ] （回帰）`setEnabled(true)` が `Transport.start` を呼ばない（TASK-042）
- [ ] （回帰）`setEnabled(true)` で `sequence.start(0)`、`setEnabled(false)` で `sequence.stop()`
- [ ] （回帰）`npm run test` 全件グリーン

## 情報の明確性

### 明示された情報

- 根本原因のfile:line（実コード・tone実装で検証済み）
- 修正方針: イベント配列 `[null]` → `[0]`（分析レポートで承認済み 2026-07-07）

### 不明/要確認の情報

- なし（すべて確認済み）
