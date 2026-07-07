# TASK-064: [BugFix] クリック間隔のPPQ追随（Sequence再生成）

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-064 |
| タイプ | bugfix |
| ステータス | DONE |
| 優先度 | High |
| 見積もり | 30分 |
| 依存タスク | TASK-062 |

## 背景

### 問題の概要

4/4の楽曲でメトロノームのクリックが拍より明らかに速く鳴る（ユーザー報告では8/8相当）。
楽譜を開く前のメトロノームON操作で発生する。

（分析レポート: `docs/sdd/troubleshooting/2026-07-07-metronome-no-sound/analysis.md` 第7節）

### 根本原因

- tone@15.1.22 の `Tone.Sequence` は、コンストラクタ実行時点の Transport PPQ で
  `subdivision`（`'4n'`）をtick数へ変換して固定する（`Sequence.js:42`）。
  後から `Transport.PPQ` を変更しても追随しない（同 `:147-156`、`:204-212`）。
- Tone の Transport 既定PPQは192（`Transport.js:106`）。`AudioEngineService.loadScore`
  が後から `Transport.PPQ = 480`（DEC-005）へ変更するため、楽譜を開く前に生成された
  シーケンスはクリック間隔192tick（0.4拍）のままとなり、拍の2.5倍の速さで鳴る。
- シーケンスは `metronome.ts` の `if (!this.sequence)` ガードでキャッシュされるため、
  メトロノームのOFF/ON操作では回復しない。

### 関連する仕様

- REQ-006-005: メトロノーム有効時、設定されたテンポでクリック音を鳴らす
  （クリック間隔は楽譜の4分音符と一致しなければ「設定されたテンポ」にならない）
- DEC-005: 正規化PPQ = 480。`loadScore` が `Transport.PPQ` を設定する
  （`audio-engine/index.ts:174` 付近）

## 実装内容

### 修正対象

- ファイル: `src/renderer/src/lib/audio-engine/metronome.ts`
  - `rebuildSequence(): void` を追加する。既存シーケンスがあれば `dispose()` して
    `null` に戻し、`enabled` が真なら `setEnabled(true)` を呼んで現在のPPQで
    再生成・再スケジュールする。
- ファイル: `src/renderer/src/lib/audio-engine/index.ts`
  - `loadScore` 内の `Tone.getTransport().PPQ = score.ticksPerQuarter;` の直後に
    `this.metronome.rebuildSequence();` を追加する。呼び出し順序が本修正の核心であり、
    PPQ設定より前に再生成してはならない。
- ファイル: `src/renderer/src/lib/audio-engine/audio-engine.test.ts`
  - 下記テスト項目を追加する。

### 実装手順

TDDで進める。

1. 失敗するテストを先に書く:
   - (a) 結線: メトロノーム有効状態で `loadScore` を呼ぶと、既存シーケンスの
     `dispose` が呼ばれ、新しい `Tone.Sequence` が `'4n'` で生成され、
     `start(0)` で再スケジュールされる。
   - (b) 順序: モックの Transport に PPQ セッターを定義して呼び出し順を記録し、
     「PPQ設定 → Sequence再生成」の順序であることを検証する。この順序こそが
     バグの再現条件（生成時点のPPQ固定）であり、弱めてはならない。
   - (c) 無効状態: メトロノーム無効のまま `loadScore` を呼んでもシーケンスは
     生成されない（不要な生成をしない）。
   - (d) 回帰: 再生成後のシーケンスでも `fireSequenceTick` ヘルパーで
     クリック発音とアクセント判定（TASK-062）が機能する。
2. Red を確認してコミットする。
3. `metronome.ts` → `index.ts` の順に実装し、Green を確認する。
4. `docs/sdd/requirements/traceability.md` の REQ-006-005 行へ本修正を追記する。

### 注意事項

- Transport の起動/停止に触れないこと（TASK-042 の設計維持）。再生成中の
  `sequence.dispose()` はシーケンス自身のスケジュールのみを解除する。
- 再生中に `loadScore` が呼ばれる経路（usePractice の score/practiceMode 監視
  エフェクト）でも、`setEnabled(true)` 内の `start(0)` により再スケジュールされ、
  クリックはTransportの動作に追従する（既存設計と同じ）。
- アクセント設定・小節頭tick（TASK-062）はMetronomeのフィールドに保持されており、
  シーケンス再生成の影響を受けない。
- テストの期待値は要件（クリック間隔=楽譜の4分音符）から導くこと。

## 受入基準

- [x] 楽譜を開く前にメトロノームをONにしても、読み込み後のクリック間隔が4分音符
  （480tick）で鳴る（結線テストで検証）
- [x] `loadScore` 内でPPQ設定がシーケンス再生成より先に行われる（順序テストで検証）
- [x] メトロノーム無効時は `loadScore` でシーケンスが生成されない
- [x] 再生成後もクリック発音・一拍目アクセントが機能する
- [x] `docs/sdd/requirements/traceability.md` の REQ-006-005 行が更新されている
- [x] `npm run test` / `npm run typecheck` / `npm run lint` が全てパスする

## テスト項目

- [x] （新規・結線）有効状態の `loadScore` で旧シーケンス `dispose` ＋新シーケンス
  `'4n'` 生成＋ `start(0)`
- [x] （新規・順序）PPQ設定 → シーケンス再生成の順序検証
- [x] （新規・ユニット）無効状態の `loadScore` ではシーケンス非生成
- [x] （新規・回帰）再生成後のクリック発音・アクセント判定
- [x] （回帰）`npm run test` 全件グリーン

## 情報の明確性

### 明示された情報

- 事象: 4/4の楽譜でクリックが8/8相当の速さ（ユーザー報告 2026-07-07）
- 根本原因のfile:line（tone実装で検証済み）と修正方針（承認済み 2026-07-07）

### 不明/要確認の情報

- なし（すべて確認済み）
