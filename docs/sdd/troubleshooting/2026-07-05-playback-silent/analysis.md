# トラブルシューティング分析レポート

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| 報告日 | 2026-07-05 |
| 分析完了日 | 2026-07-05 |
| 報告者 | ユーザー |
| ステータス | 分析完了 |

## 問題事象

### 報告された現象

「再生ボタンを押しても何もおきない」（2026-07-04のフェーズA〜C修正後の実機確認にて）。

### 期待動作

US-010: 再生操作で読み込み済みの楽曲が演奏され（REQ-010-001）、楽譜上のカーソルが再生位置に同期して移動する（REQ-010-005）。

### 再現手順

1. `npm run dev` でアプリを起動し、MusicXMLを開く
2. 再生ボタンを押す
3. ボタンの活性状態は切り替わるが、音が鳴らず、カーソルも動かない

### 発生環境

- 環境: macOS、開発モード（`npm run dev`）。プロダクションビルドでは原因1は発生しないが原因2・3は共通
- 頻度: 常に発生

## 根本原因分析

3つの独立した原因の複合。TASK-034のE2Eは再生ボタンの**状態遷移のみ**を検証し、音・Transport・カーソル進行を検証していなかったため、いずれもすり抜けた。

### 原因1: StrictModeによるAudioEngineの即時破棄（開発モードで完全無音・最重要）

- `src/renderer/src/main.tsx:8` で `StrictMode` が有効。React 18の開発モードではエフェクトが「実行→クリーンアップ→再実行」される。
- `src/renderer/src/hooks/usePractice.ts:167-171` のクリーンアップが `audioEngine.dispose()` を呼ぶが、`audioEngine` は `useMemo`（同50-60行）で保持される**同一インスタンス**のため、起動直後のStrictModeサイクルで全シンセサイザー（accompanimentSynth/clickSynth/playSynth/metronome）が破棄される。
- 以降 `triggerAttackRelease` は破棄済みシンセへの呼び出しとなり、**再生・正誤効果音・メトロノームのすべてが無音**。
- `AudioEngineService.dispose()` は再初期化不能な一方向操作であり、StrictModeのエフェクト再実行に耐えない実装だった。

### 原因2: 再生位置とカーソルの連動（REQ-010-005）が未実装

- TASK-026は暫定実装として再生開始/停止のみを結線し、カーソル連動はdata-model-v2.mdの影響表で「TASK-033以降」とされたが、TASK-033（楽譜ハイライト等）のスコープに含まれず実装漏れ。
- 音が出たとしても画面上は何も動かず、「何もおきない」という体感になる。

### 原因3: loadAccompanimentがv2時刻モデルを使わない簡易スタブのまま

- `src/renderer/src/lib/audio-engine/index.ts:34-61`（TASK-015実装）は全音符を小節頭（`${measureIndex}:0:0`）に固定デュレーション `'4n'` で配置する「simplified stub」（コメントに明記）のまま。
- TASK-031で `Note.startTick`/`durationTicks` が利用可能になったが、audio-engineへの反映タスクが存在しなかった（分析レポート2026-07-04の影響表では「TASK-033以降」とだけ記載され、具体タスク未起票）。

## 仕様照合結果

### 関連する要件

- REQ-010-001（再生）: 実装バグ（原因1）により無音
- REQ-010-005（カーソル連動）: 仕様漏れではなくタスク起票漏れ（原因2）
- REQ-010-006（テンポ即時反映）: 原因3のスタブはTransport bpmに追従するが、時刻が誤っているため実質未達
- REQ-010-007（再生中のMIDI判定停止）: 未実装（US-010で定義済みだが対応タスク不在）
- REQ-010-008（ループ内リピート）: 未実装（同上）

### 乖離の分類

- [x] 実装バグ（原因1: dispose、原因3: スタブ放置）
- [x] タスク計画漏れ（原因2およびREQ-010-005〜008の実装タスクが未起票のままUS-010を「要件化のみ」で終えた）

## 修正方針

### 承認済み修正方針

ユーザー指示（2026-07-05「再生ボタンを押しても何もおきない」修正依頼）に基づき、TASK-038として実施:

1. `AudioEngineService` をStrictMode耐性のある実装に修正（遅延初期化＋dispose後の再初期化、冪等なdispose）
2. `loadAccompaniment` を廃止し、v2時刻モデル（startTick/durationTicks）に基づく全パート再生スケジューラ `loadScore` を実装（Transport PPQ=score.ticksPerQuarter、tick表記でのイベント登録によりテンポスライダーが自然に再生速度へ反映）
3. 再生位置→カーソル連動（判定グループ単位で currentMeasure/currentNoteIndex を更新）
4. 再生中はMIDI正誤判定を一時停止（REQ-010-007）、停止時は先頭またはループ開始小節へ復帰（REQ-010-004）、ループ有効時はTransportループ（REQ-010-008）
5. E2Eを強化: 再生クリック後にカーソル位置（currentMeasure/currentNoteIndex）が実際に進むことを検証（本問題の再発防止）

### 承認日時

2026-07-05（ユーザーメッセージによる修正依頼）

### 修正対象ファイル

1. `src/renderer/src/lib/audio-engine/index.ts`
2. `src/renderer/src/hooks/usePractice.ts`
3. `src/renderer/src/App.tsx`
4. `src/renderer/src/lib/practice-engine/index.ts`（再生中の判定停止）
5. `tests/e2e/app.spec.ts`

## 生成されたタスク

| ID | タスク名 | ステータス |
| ---- | --------- | ----------- |
| TASK-038 | [BugFix] 曲の再生の本実装（StrictMode耐性・時刻ベーススケジューリング・カーソル連動） | TODO |

## 備考

- E2Eの教訓: 「状態が変わった」ことの検証は「機能が動いた」ことの検証ではない。ユーザーが観測する結果（カーソル進行）を検証対象にする。音そのものはE2Eで検証不能のため、Transportへのイベント登録数などの代理指標も併用する。
- 併発対応: `.claude/worktrees/goofy-hugging-crane`（残骸worktree、テスト二重実行の原因）を削除済み。TASK-037（鍵盤指番号）はユーザーグローバル設定の `Read(**/*key*)` deny（秘密鍵保護ルール）が `PianoKeyboard` パスに誤ヒットしていたことが判明し、設定修正の上で実施。

### TASK-038実装中に判明した第4の根本原因（追記）

TASK-038実装後の実機相当検証（E2E）で、StrictMode対応・`loadScore`実装後もカーソルが一切進まない事象が発生した。調査の結果、`src/renderer/index.html` のCSP（`script-src 'self'` のみで `worker-src` 未指定）が原因と判明した。

Tone.js の `Transport` は内部で blob URL の Web Worker（`Ticker`、`core/clock/Ticker.js`）を生成し、これを起点に `Transport.schedule()` 系のコールバックを定期的に発火させる。CSPが `worker-src` を許可していないと、この Worker のスクリプト実行がブラウザにブロックされ（コンソールに `Creating a worker from 'blob:...' violates ... script-src 'self'` の警告が出る）、`Transport.schedule()` で登録したコールバックが一切発火しなくなる。一方 `Transport.seconds`/`Transport.position` は `AudioContext.currentTime` から都度算出される純粋なgetterのため、Workerの停止に影響されず見かけ上は正常に時刻が進行しているように見え、原因特定を困難にしていた。

`worker-src 'self' blob:;` をCSPに追加し解消（TASK-038で対応）。この問題はStrictMode対応（原因1）を修正しただけでは顕在化せず、実際にTransportベースのスケジューリングを実装して初めて発覚した。パッケージ版でも同一のCSPが適用されるため、本修正がなければ製品版でも再生・カーソル連動が機能しない状態だった。
