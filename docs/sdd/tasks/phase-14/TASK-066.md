# TASK-066: メトロノーム単独再生（Tone.Clock）

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-066 |
| タイプ | feature |
| ステータス | TODO |
| 優先度 | High |
| 見積もり | 60分 |
| 依存タスク | TASK-065 |

## 背景

現行のメトロノームは再生（Transport動作）に追従して鳴る設計（TASK-042）のため、
チェックをONにしても再生を開始するまで音が出ない。ユーザー要望（2026-07-07）により、
チェックONだけで直ちにクリックが鳴り始める単独再生を実装する（REQ-006-009）。

（分析レポート: `docs/sdd/troubleshooting/2026-07-07-metronome-feedback/analysis.md` 第6節）

### 設計方針（承認済み）

- Transport が動いていない間は `Tone.Clock` による独立クロックでクリックを鳴らす。
  Transport を起動しない（起動すると伴奏が鳴ってしまうため。TASK-042 の責務分離を維持）。
- 拍子は `Score.timeSignature.beats`（未ロード時は4）を使い、クリック開始を1拍目として
  カウントする。1拍目強調オプション・音量規則（TASK-065）は楽譜同期モードと共通。
- テンポは現在の bpm（テンポスライダーの値）に追随する。bpm 変更時は
  クロック周波数を更新する。
- 再生開始で独立クロックを停止して楽譜同期のシーケンスへ切り替え、
  一時停止・停止で（有効中なら）独立クロックを再開する。

## 実装内容

### 修正対象

- ファイル: `src/renderer/src/lib/audio-engine/metronome.ts`
  - `private clock: Tone.Clock | null` と拍カウンターを追加する。
  - `setBpm(bpm: number): void` を追加する。クロック周波数（`bpm / 60` Hz）を更新する。
    クロック未生成時は内部フィールドに保持し、生成時に反映する。
  - `setBeatsPerMeasure(beats: number): void` を追加する（既定4）。
  - `setTransportRunning(running: boolean): void` を追加する。
    - `running === true`: 独立クロックを停止する（楽譜同期シーケンスが鳴る）。
    - `running === false`: 有効中なら拍カウンターを0にリセットして独立クロックを開始する。
  - `setEnabled(enabled)`: Transport 動作状態に応じて、シーケンス（TASK-065の再生成方式）
    または独立クロックを開始する。無効化時は両方を停止する。
  - クロックのコールバック: `beat = counter % beats` を計算し、`beat === 0` かつ
    アクセント有効なら `'C6'`・1.0、それ以外は TASK-065 の音量規則で `'C5'` を鳴らす。
    カウンターはコールバックごとにインクリメントする。
  - `dispose()` でクロックも破棄する。
- ファイル: `src/renderer/src/lib/audio-engine/index.ts`
  - `setBpm` で `this.metronome.setBpm(bpm)` を呼ぶ。
  - `loadScore` で `this.metronome.setBeatsPerMeasure(score.timeSignature.beats)` を呼ぶ。
  - `playAccompaniment` で `this.metronome.setTransportRunning(true)`、
    `pauseAccompaniment` / `stopAccompaniment` で `setTransportRunning(false)` を呼ぶ。
  - Metronome 再生成（`ensureInitialized`）後の希望状態の再適用に bpm・拍子を加える。
- ファイル: `src/renderer/src/lib/audio-engine/audio-engine.test.ts`
  - Tone モックに `Clock`（`start` / `stop` / `dispose` / `frequency.value` /
    コールバック記録）を追加し、下記テスト項目を追加する。

### 実装手順

TDDで進める。

1. 失敗するテストを先に書く:
   - (a) 停止中に `setMetronomeEnabled(true)` を呼ぶと `Tone.Clock` が `bpm / 60` Hz で
     生成・開始される（Transport は起動されない）。
   - (b) クロックのコールバックが拍子4で「1拍目C6・1.0、2〜4拍目C5・0.6」の順に発音する
     （アクセント有効時）。アクセント無効時は全拍 C5・1.0。
   - (c) `playAccompaniment` でクロックが停止し、`stopAccompaniment` で（有効中なら）
     カウンター0から再開する。
   - (d) `setBpm(240)` でクロック周波数が 4Hz に更新される。
   - (e) `loadScore` で `timeSignature.beats` が反映される（3拍子なら3クリックごとにアクセント）。
   - (f) 無効化で クロックが停止する。
2. Red を確認してコミットする。
3. `metronome.ts` → `index.ts` の順に実装し、Green を確認する。
4. `docs/sdd/requirements/traceability.md` に REQ-006-009 行を追加する。
5. 実起動での確認: 楽譜を開かずにメトロノームをONにしてクリックが鳴ること、
   再生開始で楽譜同期へ切り替わることを実測で確認する（分析レポートの調査スクリプトと
   同じ要領。E2Eへの自動組み込みは必須としない）。

### 注意事項

- 独立クロックから Transport を起動しないこと（伴奏が鳴ってしまう。TASK-042）。
- 一時停止中も独立クロックで鳴らす（チェックON = 常にクリックが聞こえる、REQ-006-009）。
- 楽譜同期モードの挙動（小節頭tick照合のアクセント）は変更しない。
- Tone の AudioContext が suspended の場合に備え、クロック開始前に
  `Tone.start()` を呼ぶ必要があるか実機で確認する（Electron は自動再生許可のため
  通常は不要のはず。必要な場合のみ追加する）。

## 受入基準

- [ ] 停止中（楽譜未ロードでも）メトロノームをONにすると直ちにクリックが鳴る
- [ ] クリックは現在のテンポ設定に追随する（bpm変更で周波数が更新される）
- [ ] 拍子に基づく1拍目のアクセントが付く（強調OFF時は全拍同一音量1.0）
- [ ] 再生開始で楽譜同期クリックへ切り替わり、一時停止・停止で単独クリックへ戻る
- [ ] Transport が独立クロックによって起動されない
- [ ] `docs/sdd/requirements/traceability.md` に REQ-006-009 行が追加されている
- [ ] `npm run test` / `npm run typecheck` / `npm run lint` / `npm run format:check` / `npm run lint:jp` が全てパスする

## テスト項目

- [ ] （新規・結線）有効化で Clock 生成・開始、Transport 非起動
- [ ] （新規・ユニット）拍カウンターとアクセント（4拍子・3拍子）
- [ ] （新規・結線）play/stop/pause と クロックの切り替え
- [ ] （新規・ユニット）setBpm による周波数更新
- [ ] （新規・結線）loadScore による拍子反映
- [ ] （回帰）楽譜同期モード（TASK-065）の全テスト

## 情報の明確性

### 明示された情報

- 要望と設計方針（AskUserQuestionで承認済み 2026-07-07、REQ-006-009）

### 不明/要確認の情報

- Tone.start() の要否（実機確認で判断。注意事項参照）
