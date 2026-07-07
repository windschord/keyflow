# 分析レポート: メトロノームが鳴らない / 一拍目アクセントの追加（2026-07-07）

## 1. 問題事象

| 項目 | 内容 |
|------|------|
| 現象 | ツールバーのメトロノームチェックボックスをONにしても、クリック音が一切鳴らない |
| 期待動作 | メトロノーム有効時、再生に追従して設定テンポでクリック音が鳴る（REQ-006-005） |
| 再現手順 | 1. 楽曲を読み込む 2. メトロノームをON 3. 再生を開始 → クリック音が鳴らない |
| 発生環境 | 全環境（実装バグのため環境非依存） |
| エラー情報 | エラー・例外は発生しない（無音のまま） |

あわせてユーザー要望として「一拍目だけ音を強めにするオプション」の追加が挙げられた
（2026-07-07。アクセント音は音量+音程で差別化、ツールバー配置・デフォルトON・永続化で承認済み）。

## 2. 根本原因

### 原因: Tone.Sequence のイベント配列が `[null]` のためコールバックが発火しない

`src/renderer/src/lib/audio-engine/metronome.ts:16-22`（修正前）:

```typescript
this.sequence = new Tone.Sequence(
  (time) => {
    this.synth.triggerAttackRelease('C5', '32n', time);
  },
  [null],   // ← 原因
  '4n'
);
```

tone@15.1.22 の `Sequence` は、`null` イベントを「休符」として扱い、コールバック自体を
呼び出さない仕様である（`node_modules/tone/build/esm/event/Sequence.js:67`）:

```javascript
_seqCallback(time, value) {
    if (value !== null && !this.mute) {
        this.callback(time, value);
    }
}
```

イベント配列が `[null]` のみのため、Transport が動作していてもクリックのコールバックは
一度も呼ばれず、`triggerAttackRelease` に到達しない。これが無音の直接原因である。

### テストすり抜けの構図

既存テスト（`src/renderer/src/lib/audio-engine/audio-engine.test.ts`）は Tone をモックし、
`sequence.start(0)` / `sequence.stop()` の呼び出しのみを検証していた。
Sequence のコールバックが実際に発火して synth が発音するという結線は未検証だった。
これは再発防止原則「モック境界には結線テストを対で書く」
（`docs/sdd/troubleshooting/2026-07-05-test-escape/analysis.md`）に照らして検証の穴である。
`docs/sdd/requirements/traceability.md` の REQ-006-005 行は
「○（TASK-042で検証済み）」となっていたが、検証されていたのは
Transport ライフサイクルの分離のみで、発音そのものは検証されていない。

## 3. 仕様との照合

| 対象 | 照合結果 | 分類 |
|------|---------|------|
| メトロノーム無音 | REQ-006-005「メトロノーム有効時、設定テンポでクリック音を鳴らす」に違反 | 実装バグ（仕様は正しい） |
| 一拍目アクセント | US-006 に該当要件なし | 仕様漏れ（新規要件 REQ-006-008 を追加） |

## 4. 修正方針（承認済み 2026-07-07）

### 方針1: 無音バグの修正（TASK-061）

- `Tone.Sequence` のイベント配列を `[null]` から発火する値（`[0]`）へ変更し、
  コールバックが毎拍呼ばれるようにする。
- TDD: Tone.js の `null` スキップ仕様をエミュレートするテストヘルパーを用意し、
  Sequence に渡されたイベント配列とコールバックから実際に synth の
  `triggerAttackRelease` が呼ばれることの結線テストを先に書く。Red を確認してから修正する。
- TASK-042 で確立した設計は維持する。すなわち Transport ライフサイクルは
  再生コントロール専属とし、メトロノームは `sequence.start(0)`/`stop()` のみを管理する。

### 方針2: 一拍目アクセントの追加（TASK-062, TASK-063）

- **要件**: REQ-006-008 として US-006 に追記。「アクセント有効時、小節の一拍目の
  クリックを他拍より強い音量・高い音程で鳴らす」。
- **一拍目の判定**: `Score.measures[].startTick`（小節頭の絶対tick）の集合と、
  クリック発火時点の Transport tick（`Tone.getTransport().getTicksAtTime(time)` を丸めた値）
  との照合で行う。拍カウント方式と異なり、弱起（ピックアップ小節）や途中再生でも
  正しく小節頭を判定できる。
- **音の差別化**: 一拍目 C6・velocity 1.0 / 他拍 C5・velocity 0.6。
- **UI**: ツールバーのメトロノームチェックボックス横に「1拍目強調」チェックボックスを
  配置。デフォルトON。
- **永続化**: `AppSettings.practice.metronomeAccentEnabled`（既定 `true`）を追加し、
  既存の `metronomeEnabled` と同一パターン（electron-store・SettingsModal・起動時反映）で
  永続化する。

### 既知の制約

- クリックは4分音符グリッド（`'4n'` = PPQ 480 の倍数 tick）で発火するため、小節頭が
  4分グリッドに乗らない拍子（例: 3/8）ではアクセントの付かない小節が生じ得る。
  一般的な 4/4・3/4・2/4・6/8 等では小節長が4分音符の整数倍のため問題ない。
  対応が必要になった場合は、クリック間隔を拍子の beatType から導出する拡張で対処する
  （本修正のスコープ外）。
- メトロノームは再生（Transport 動作）に追従して鳴る設計（TASK-042）のため、
  停止中の単独クリック機能は本修正でも対象外。

## 5. 影響範囲

| ファイル | 変更内容 |
|---------|---------|
| `src/renderer/src/lib/audio-engine/metronome.ts` | イベント配列修正、アクセント判定・発音 |
| `src/renderer/src/lib/audio-engine/index.ts` | `setMetronomeAccentEnabled` 追加、`loadScore` で小節頭tick連携 |
| `src/renderer/src/lib/audio-engine/audio-engine.test.ts` | 結線テスト・アクセントテスト追加 |
| `src/renderer/src/store/slices/ui-slice.ts` | `metronomeAccentEnabled` 状態追加 |
| `src/renderer/src/hooks/usePractice.ts` | store → AudioEngine 同期エフェクト追加 |
| `src/renderer/src/components/Toolbar/TempoControl.tsx` | 「1拍目強調」チェックボックス追加 |
| `src/renderer/src/components/SettingsModal/index.tsx` | 既定値設定UI追加 |
| `src/renderer/src/types/settings.ts` / `src/main/settings.ts` | 設定スキーマ・既定値追加 |
| `src/renderer/src/App.tsx` | 起動時の永続化値反映 |
| `docs/sdd/requirements/stories/US-006.md` | REQ-006-008 追記 |
| `docs/sdd/requirements/traceability.md` | REQ-006-005 是正・REQ-006-008 追加 |

リスク: メトロノームは他機能（伴奏・判定）と独立しており、Transport ライフサイクルに
触れない限り影響は閉じている。設定スキーマ追加は既存ストアに存在しないキーの
読み込みとなるため、起動時反映で `typeof === 'boolean'` によりガードして後方互換を保つ。

## 6. 修正タスク

| タスクID | タイトル | 依存 |
|----------|---------|------|
| TASK-061 | [BugFix] メトロノーム無音の修正（Sequence nullイベント） | - |
| TASK-062 | メトロノーム一拍目アクセント（エンジン実装） | TASK-061 |
| TASK-063 | 一拍目アクセントのUIオプションと永続化 | TASK-062 |
| TASK-064 | [BugFix] クリック間隔のPPQ追随（Sequence再生成） | TASK-062 |

詳細: `docs/sdd/tasks/phase-14/`

## 7. 追加事象: クリック間隔が楽譜の4分音符に一致しない（2026-07-07 追記）

### 事象

4/4の楽曲でメトロノームのクリックが拍より明らかに速く鳴る（ユーザー報告では8/8相当）。
TASK-061〜063の実機確認で判明した。

### 根本原因

tone@15.1.22 の `Tone.Sequence` は、コンストラクタ実行時点の Transport PPQ で
`subdivision`（`'4n'`）をtick数へ変換して固定する（`Sequence.js:42`）。
イベント配置とループ長も同じ値で固定され、後から `Transport.PPQ` を変更しても
追随しない（同 `:147-156`、`:204-212`）。

Tone の Transport 既定PPQは192である（`Transport.js:106`）。一方
`AudioEngineService.loadScore` は `Transport.PPQ` を `score.ticksPerQuarter`
（480、DEC-005）へ変更する。楽譜を開く前にメトロノームをONにすると、シーケンスは
PPQ=192 の時点で生成され、クリック間隔が192tickに固定される。
楽譜読み込み後は480tickが4分音符に相当するため、192tickは0.4拍の間隔となり、
4/4の1小節あたり10クリック（拍の2.5倍）で鳴る。シーケンスは一度生成されると
キャッシュされる（`metronome.ts` の `if (!this.sequence)` ガード）ため、
メトロノームのOFF/ON操作では回復しない。

なお、楽譜の読み込み後に初めてONへ切り替えた場合はPPQ=480で生成されるため正しい間隔となる。
TASK-061〜062のユニットテストはToneをモックしており、PPQ依存のtick変換は
テストの検証範囲外だった。

### 修正方針（TASK-064、承認済み 2026-07-07）

`loadScore` で `Transport.PPQ` を設定した直後に `Metronome.rebuildSequence()` を呼び、
既存シーケンスを破棄する。メトロノーム有効中であれば現在のPPQで再生成・再スケジュール
する。これによりON操作のタイミングに関係なく、クリック間隔は常に現在のPPQで解決された
4分音符（480tick）となる。
