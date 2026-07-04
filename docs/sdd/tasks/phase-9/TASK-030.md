# TASK-030: 設計: 時刻ベースデータモデルへの再設計

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-030 |
| タイプ | design |
| ステータス | DONE |
| 優先度 | High |
| 見積もり | 60分 |
| 依存タスク | TASK-029 |

## 背景

### 問題の概要

現行データモデルの `Note` 型（`docs/sdd/design/index.md:123-133`）には発音時刻の概念がなく、両手曲（複数パート曲）の同時演奏判定が構造的に不可能。さらにnoteId採番規則がパーサーとOSMD側で食い違っており、2パート曲ではカーソル追従・運指番号の描画位置が破綻する（分析レポート原因5）。

### 根本原因

- **時刻の不在**: パーサー（`src/renderer/src/lib/musicxml-parser/parser.ts:120-201`）は複数パートの音符を「P1全音符→P2全音符」の順で同一 `Measure.notes` 配列に連結し、音符に発音時刻を持たせていない。practice-engineは線形インデックスで1音ずつ進むため、左右の手で同時に鳴るべき音符を「同時」と認識できない。
- **noteId不整合**: パーサーは `currentMeasure.notes.length` によるパート横断連番でIDを振る（`parser.ts:186`: `` `${partId}-M${measureNumber}-N${currentMeasure.notes.length}` ``）のに対し、OSMD側は `noteIndexInMeasurePerPart` によるパート毎連番（`src/renderer/src/components/ScoreRenderer/osmd-controller.ts:233-243`）でIDを構築しており、2パート目以降でインデックスがずれる。
- Synthesiaライクな「時間ベースの曲進行」は要件で明示的にスコープ外とされていた（`docs/sdd/requirements/index.md:73`、US-005備考）ため、設計段階で時刻モデルが検討されなかった。

### 関連する仕様

- US-010（TASK-029で追加）: 曲の再生 — 再生スケジューリングに発音時刻・デュレーションが必須
- US-003 / REQ-003: 右手/左手/両手の練習モード — 両手同時判定に時刻ベース統合が必須
- US-004 / REQ-004: MIDI入力の正誤判定 — 和音・両手同時押下の判定仕様の裏付け
- CLAUDE.md「データ永続化」: noteIdフォーマット `{partId}-M{measureNumber}-N{noteIndex}` — **noteIndexはパート毎連番として本フォーマットを正とする**
- `docs/sdd/design/index.md` データモデル（Score/Part/Measure/Note/Annotation）

## 実装内容

### 修正対象

- ファイル: `docs/sdd/design/components/data-model-v2.md`（新規作成。sdd-documentationの `software-designing` スキルを使用）
- ファイル: `docs/sdd/design/index.md`（データモデル節の更新または新設計書への参照追加）
- ファイル: `docs/sdd/design/decisions/`（noteId採番統一・時刻単位の決定を DEC-005 として記録）
- 変更内容: 時刻ベースデータモデルの設計書作成

### 実装手順

1. `sdd-documentation:software-designing` スキルを起動し、既存設計書（`docs/sdd/design/index.md`、`docs/sdd/design/components/practice-engine.md`）を確認する
2. **Note型への時刻付与**を設計する
   - `startTick: number`（divisions基準の絶対tick。MusicXMLの `<divisions>` と `<duration>`、`<backup>`/`<forward>` 要素から算出）
   - `startSeconds: number`（テンポ指示を考慮した秒。テンポ変更時の再計算方針も定義）
   - `durationTicks` / `durationSeconds`（既存 `duration` フィールドとの関係・移行方針を明記）
3. **複数パートの時刻ベース統合**を設計する
   - 現状の「P1全音符→P2全音符」連結（`parser.ts:120-201`）を廃し、`Measure.notes` を startTick 昇順で保持するか、時刻グループ（`NoteGroup { startTick, notes: Note[] }`）を導入するかを比較検討し、決定を記録する
   - practice-engine（線形インデックス進行）・osmd-controller（カーソルイテレータ）・audio-engine（再生スケジューラ）の3コンシューマから見た要件を整理する
4. **noteId採番の統一**を設計する
   - CLAUDE.md記載の `{partId}-M{measureNumber}-N{noteIndex}` を正とし、noteIndexは「パート内・小節内の連番」（osmd-controller.ts:233-243と同方式）に統一する
   - `parser.ts:186` のパート横断連番を廃止する移行方針と、既存 `*.annotation.json`（noteIdをキーに持つ）への影響・互換性方針を明記する
5. **和音・両手同時押下の判定仕様**を定義する
   - 「同時」の定義: startTickが等しいノーツ集合を1つの判定グループとする
   - 判定グループ内の全ノーツ（練習パートフィルタ適用後）が押下されたらグループ正解として進行
   - 押下タイミングの許容（グループ内の押し順は不問、途中の誤打鍵の扱い）を明記
   - Left/Right/Bothフィルタ適用でグループが空になった場合の自動進行仕様
6. 既存 `docs/sdd/design/index.md` のデータモデルとの**差分表**（フィールド追加・意味変更・削除、影響コンポーネント一覧）を設計書に明記する
7. noteId統一と時刻単位の選定理由を `docs/sdd/design/decisions/DEC-005-*.md` として記録する

### 注意事項

- 本タスクは設計のみ。実装はTASK-031（パーサー）・TASK-032（practice-engine）で行う
- MusicXMLの `<backup>`/`<forward>`（多声部の時刻巻き戻し）と `<chord>` 要素（直前音符と同時刻）のtick算出規則を必ず設計に含めること。現行パーサーはこれらを時刻計算に使っていない
- OSMDのカーソルイテレータ順（タイムスタンプ順で全パート横断）とデータモデルの時刻順が一致するよう設計すると、osmd-controllerのマッピングが単純になる
- 休符（`isRest: true`）は判定グループから除外するが、時刻進行（再生・カーソル）には必要である点を明記すること
- 既存の運指エンジン（Web Worker）はNote配列を入力に取るため、型変更の影響範囲（`src/renderer/src/workers/fingering/types.ts`）も差分表に含めること

## 受入基準

- [x] Note型への時刻フィールド（tick/秒）とデュレーションの定義が設計書に記載されている（data-model-v2.md「型定義（v2）」）
- [x] 複数パートの時刻ベース統合方式（連結順の廃止、startTick昇順ソート＋派生NoteGroup）が擬似コードと机上検証例で説明されている
- [x] noteId採番が `{partId}-M{measureNumber}-N{noteIndex}`（パート毎連番）に統一され、parser.ts:186とosmd-controller.ts:233-243の不整合解消方針が明記されている
- [x] 和音・両手同時押下の判定仕様（同時の定義、グループ正解条件、パートフィルタとの関係、6項目）が定義されている
- [x] 既存 `docs/sdd/design/index.md` データモデルとの差分（フィールド差分サマリ・影響コンポーネント表）が明記されている
- [x] TASK-031/TASK-032が本設計書のみで実装着手できる粒度になっている（tick算出規則表・判定仕様・互換性方針を含む）
- [x] 既存のテストが通る（ドキュメントのみの変更のためソースコード変更なし）

## テスト項目

- [x] レビュー: `<backup>`/`<forward>`/`<chord>` を含むMusicXMLサンプルで、設計したtick算出規則が机上検証で正しい時刻を導出するか（data-model-v2.md「机上検証例」: 和音・両手同時が正しくグループ化）
- [x] レビュー: 2パート曲のnoteIdが新規則でパーサー・OSMD双方から同一に導出されるか（パート内・小節内出現順連番で両者一致を確認）
- [x] レビュー: 両手同時和音（右手2音＋左手1音が同tick）の判定グループが仕様どおり1グループになるか（同検証例のtick=240グループ）

## 情報の明確性

### 明示された情報

- noteIdフォーマットはCLAUDE.md記載の `{partId}-M{measureNumber}-N{noteIndex}` を正とする（パート毎連番＝osmd-controller.ts方式に統一）
- 不整合箇所: `parser.ts:186`（パート横断連番）vs `osmd-controller.ts:233-243`（パート毎連番）
- パート連結問題の箇所: `parser.ts:120-201`
- 設計スコープ: 時刻付与（tick/秒）、時刻ベース統合、noteId統一、和音・両手同時判定仕様、既存データモデルとの差分明記
- 使用スキル: sdd-documentation:software-designing
- 根拠: 分析レポート原因5（`docs/sdd/troubleshooting/2026-07-04-app-unusable/analysis.md`）

### 不明/要確認の情報

- なし（すべて確認済み）
