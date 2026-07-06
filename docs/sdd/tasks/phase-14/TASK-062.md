# TASK-062: メトロノーム一拍目アクセント（エンジン実装）

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-062 |
| タイプ | feature |
| ステータス | TODO |
| 優先度 | High |
| 見積もり | 40分 |
| 依存タスク | TASK-061 |

## 背景

小節の一拍目だけクリック音を強めにするオプションを追加する（2026-07-07ユーザー要望、
REQ-006-008）。本タスクはエンジン側（Metronome / AudioEngineService）の実装を行う。
UIオプションと永続化は TASK-063 で行う。

（分析レポート: `docs/sdd/troubleshooting/2026-07-07-metronome-no-sound/analysis.md`）

### 設計方針（承認済み）

- **一拍目の判定**: `Score.measures[].startTick`（小節頭の絶対tick）の集合と、クリック
  発火時点の Transport tick の照合で行う。拍カウント方式（クリック回数 % 拍数）は
  弱起（ピックアップ小節）や途中再生で狂うため採用しない。
- **音の差別化**: 一拍目 `'C6'`・velocity `1.0` / 他拍 `'C5'`・velocity `0.6`。
- **既知の制約**: クリックは4分音符グリッドで発火するため、小節頭が4分グリッドに
  乗らない拍子（例: 3/8）ではアクセントが付かない小節が生じ得る（許容。分析レポート参照）。

### 関連する仕様

- REQ-006-008: アクセント有効時、小節の一拍目のクリック音を他拍より強い音量かつ高い音程で鳴らす（弱起でも小節頭を正しく判定）
- DEC-005: 正規化PPQ = 480（`Score.ticksPerQuarter`）。`loadScore` で `Transport.PPQ` を合わせている（`audio-engine/index.ts:160`）

## 実装内容

### 修正対象

- ファイル: `src/renderer/src/lib/audio-engine/metronome.ts`
  - `setAccentEnabled(enabled: boolean): void` を追加（内部フラグ。既定 `true`）。
  - `setMeasureStartTicks(ticks: number[]): void` を追加（内部で `Set<number>` に変換して保持）。
  - クリックコールバック内で判定・発音を分岐する:
    ```typescript
    (time) => {
      const ticks = Math.round(Tone.getTransport().getTicksAtTime(time));
      const isAccent = this.accentEnabled && this.measureStartTicks.has(ticks);
      if (isAccent) {
        this.synth.triggerAttackRelease('C6', '32n', time, 1.0);
      } else {
        this.synth.triggerAttackRelease('C5', '32n', time, 0.6);
      }
    }
    ```
    `getTicksAtTime(time)` を使うのは、Tone.js のスケジューリングが lookahead 付きで
    先行して発火するため、`transport.ticks`（現在値）では発火予定時刻の tick と
    ずれるからである。浮動小数の誤差を吸収するため `Math.round` で整数化して照合する。
- ファイル: `src/renderer/src/lib/audio-engine/index.ts`
  - `setMetronomeAccentEnabled(enabled: boolean): void` を公開メソッドとして追加
    （`ensureInitialized()` を先頭で呼び、`this.metronome.setAccentEnabled(enabled)` へ委譲。
    `setMetronomeEnabled` と同一パターン）。
  - AudioEngineService に希望状態フィールド（accent有効フラグ・小節頭tick配列）を保持し、
    `ensureInitialized()` での Metronome 再生成後にも再適用されるようにする
    （dispose→再初期化で設定が失われないこと。StrictMode耐性の既存設計に合わせる）。
  - `loadScore(score)` 内で `this.metronome.setMeasureStartTicks(score.measures.map((m) => m.startTick))`
    を呼び、スコアの小節頭tickを連携する。
- ファイル: `src/renderer/src/lib/audio-engine/audio-engine.test.ts`
  - アクセント判定のテストを追加する（下記テスト項目）。

### 実装手順

TDDで進める。

1. 失敗するテストを先に書く（TASK-061で導入したティック発火ヘルパーを流用し、
   Tone モックの `getTransport().getTicksAtTime` を任意の tick を返すよう設定できるようにする）:
   - (a) 小節頭tick（例: `[0, 1920, 3840]` を `loadScore` 経由で設定）と一致する tick で
     発火した場合、`triggerAttackRelease('C6', '32n', time, 1.0)` が呼ばれる。
   - (b) 小節頭以外の tick（例: 480）では `('C5', '32n', time, 0.6)` が呼ばれる。
   - (c) `setMetronomeAccentEnabled(false)` の場合、小節頭 tick でも `'C5'`・0.6 で鳴る。
   - (d) 弱起相当（小節頭tickが `[0, 480, 2400]` のような不等間隔）でも startTick 照合で
     正しくアクセントが付く。
2. Red を確認してコミットする。
3. `metronome.ts` → `index.ts` の順に実装し、Green を確認する。
4. `docs/sdd/requirements/traceability.md` に REQ-006-008 行を追加する
   （UI結線は TASK-063 のため、この時点では「エンジンのみ検証済み」と明記）。

### 注意事項

- Transport の起動/停止に触れないこと（TASK-042 の設計維持）。
- `loadScore` の既存のスケジューリング処理（伴奏・位置イベント）を変更しないこと。
  小節頭tickの連携呼び出しを追加するのみとする。
- スコア未ロード時（`measureStartTicks` が空）はアクセントなしで全拍 `'C5'`・0.6 となる。
  この挙動で問題ない（メトロノームは再生追従であり、再生にはスコアが必要なため）。
- velocity 0.6 は従来の `triggerAttackRelease('C5', '32n', time)`（velocity省略 = 既定1.0）
  から変わる点に注意。アクセントとの相対差を作るための意図的な変更であり、
  マスターボリューム（REQ-010-009）で全体音量は調整可能。

## 受入基準

- [ ] アクセント有効時、小節頭tickと一致するクリックが `'C6'`・velocity 1.0 で鳴る
- [ ] 小節頭以外のクリックは `'C5'`・velocity 0.6 で鳴る
- [ ] アクセント無効時は全拍 `'C5'`・velocity 0.6 で鳴る
- [ ] 弱起相当の不等間隔な小節頭tickでも正しくアクセントが付く（startTick照合）
- [ ] `loadScore` がスコアの小節頭tickを Metronome に連携する（結線テストで検証）
- [ ] dispose→再初期化後もアクセント設定が失われない
- [ ] `docs/sdd/requirements/traceability.md` に REQ-006-008 行が追加されている
- [ ] `npm run test` / `npm run typecheck` / `npm run lint` が全てパスする

## テスト項目

- [ ] （新規・ユニット）小節頭tickで `'C6'`・1.0、他拍で `'C5'`・0.6
- [ ] （新規・ユニット）`setMetronomeAccentEnabled(false)` で小節頭でも `'C5'`・0.6
- [ ] （新規・ユニット）弱起相当の不等間隔小節頭tickでの正判定
- [ ] （新規・結線）`loadScore(score)` → `metronome.setMeasureStartTicks` の連携
- [ ] （新規・回帰）dispose後の再初期化でアクセント設定が再適用される
- [ ] （回帰）`npm run test` 全件グリーン

## 情報の明確性

### 明示された情報

- アクセント音の差別化方法（音量+音程、AskUserQuestionで承認済み 2026-07-07）
- 一拍目判定方式（measures[].startTick照合、分析レポートで承認済み）

### 不明/要確認の情報

- なし（すべて確認済み）
