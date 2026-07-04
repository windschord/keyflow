# TASK-031: パーサーの時刻付与・noteId統一実装

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-031 |
| タイプ | feature |
| ステータス | DONE |
| 優先度 | High |
| 見積もり | 60分 |
| 依存タスク | TASK-030 |

## 背景

### 問題の概要

`musicxml-parser`（`src/renderer/src/lib/musicxml-parser/parser.ts`）が音符に発音時刻を付与せず、複数パートを「P1全音符→P2全音符」の順に連結しているため、両手同時演奏を表現できるデータが存在しない。またnoteId採番がパート横断連番になっており、OSMD側（パート毎連番）と整合しない。

### 根本原因

- `parser.ts:120-201` のforEachループ構造がパートごとに独立してmeasureを走査し、`Measure.notes` に順次push（`parser.ts:186-198`）するのみで、MusicXMLの `<duration>`/`<backup>`/`<forward>`/`<chord>` を時刻計算に使っていない。
- `parser.ts:186`: `` const noteId = `${partId}-M${measureNumber}-N${currentMeasure.notes.length}` `` — `currentMeasure.notes.length` は全パート合算のカウンタであり、パート横断の連番になる。
- 対する `osmd-controller.ts:233-243` は `noteIndexInMeasurePerPart`（パートごとのMapカウンタ）でIDを構築しており、方式が異なる。

### 関連する仕様

- TASK-030で作成される `docs/sdd/design/components/data-model-v2.md`（時刻付与規則、noteId統一方針、和音・両手同時判定仕様の設計根拠）
- CLAUDE.md: noteIdフォーマット `{partId}-M{measureNumber}-N{noteIndex}`（パート毎連番を正とする）
- DEC-005（TASK-030で記録予定）: 時刻単位・noteId採番の決定事項

## 実装内容

### 修正対象

- ファイル: `src/renderer/src/lib/musicxml-parser/parser.ts` — 時刻計算・noteId採番ロジックの改修
- ファイル: `src/renderer/src/types/`（Note型定義。データモデルへの `startTick`/`startSeconds`/`durationTicks` 等の追加）
- ファイル: `src/renderer/src/lib/musicxml-parser/*.test.ts`（既存パーサーテストの期待値更新、新規テスト追加）
- 変更内容: TASK-030の設計に基づき、`<divisions>`/`<duration>`/`<backup>`/`<forward>`/`<chord>` を用いた時刻計算パイプラインの追加と、パート毎連番によるnoteId採番への統一

### 実装手順（TDD）

1. TASK-030の設計書（`data-model-v2.md`）を読み、Note型に追加するフィールド（`startTick`, `startSeconds`, `durationTicks`, `durationSeconds` 等、設計書の確定名称に従う）を確認する
2. 既存パーサーテスト（`src/renderer/src/lib/musicxml-parser/*.test.ts`）を確認し、時刻付与・noteId変更後の期待値をまず更新して失敗させる（Red）
   - 単一パート曲でのtick累積が正しいこと
   - `<chord>` を持つ音符が直前音符と同一startTickになること
   - `<backup>` 後の音符が巻き戻ったtickから計算されること
   - 2パート曲でnoteIdがパート毎連番（`P1-M1-N0`, `P1-M1-N1`, `P2-M1-N0`, ...）になること
3. `<attributes><divisions>` の読み取りを追加し、tick単位の基準値として保持する
4. 音符ごとのforEachループ内でパートローカルの `currentTick` を管理し、`<duration>` 加算・`<backup>`/`<forward>` によるtick巻き戻し/前進・`<chord>` の場合は直前音符と同一tickを維持するロジックを実装する
5. `tempo`（既存の`sound tempo`解析ロジックを流用）とtick→秒変換（`divisions`・`beatType`・`tempo`から算出）を実装し、`startSeconds`/`durationSeconds` を算出する。テンポ変化点をまたぐ場合の累積計算を含める
6. noteId採番をパート毎連番（`currentMeasure.notesByPart` 等パート別カウンタ、または `noteIndex` をパート単位で再定義）に変更する
7. Measure内のnotesの並び順（時刻順ソートまたは時刻グループ化）をTASK-030の設計方針に従って実装する
8. すべてのテストがパスするまで実装を修正する（テスト自体は変更しない。TDD原則: Redを確認した期待値のみ更新済みで、以降は実装側を直す）
9. 型チェック・lintを実行する（`npm run typecheck`, `npm run lint`）

### 注意事項

- 依存する他コンポーネント（practice-engine、osmd-controller、audio-engine、fingering-engine）への型変更の影響はTASK-032以降で対応する。本タスクはパーサー層とその直接テストの範囲に閉じる
- 既存のnoteIdを参照する `*.annotation.json` サイドカーとの後方互換性についてはTASK-030の設計書に記載された移行方針に従う（本タスクでは移行スクリプトまで作らず、設計書の指示範囲で対応）
- `duration: number` の意味（既存コメント「四分音符=1.0」）と新規tick値の単位混同に注意し、既存フィールドを残すか置き換えるかは設計書の確定方針に従う

## 受入基準

- [x] Note型に発音時刻（tick/秒）とデュレーションのフィールドが追加されている（TASK-030設計書のフィールド名に準拠。`startTick`/`durationTicks`/`startSeconds`/`durationSeconds`/`voice`）
- [x] `<chord>` 要素を持つ音符が直前音符と同一startTickになる
- [x] `<backup>`/`<forward>` を含む譜面でtickが正しく計算される
- [x] 2パート曲でnoteIdがパート毎連番（`{partId}-M{measureNumber}-N{noteIndex}`）になり、osmd-controller.tsの採番方式と一致する
- [x] 既存のテストが通る（期待値更新後のテストを含む。既存assertionは全て発生値と一致し変更不要だった）
- [x] 新規テストが追加されている（tick計算・chord同時刻・backup/forward・noteId採番の各ケース）
- [x] `npm run typecheck` / `npm run lint` がパスする

## テスト項目

- [x] 単一パート・単一声部の四分音符4つでstartTickが0,480,960,1440になる（PPQ=480, divisions=1）。※タスク定義時点の記述「0,divisions,2*divisions,3*divisions」は正規化前のdivisions単位を指しており、data-model-v2.md確定後のPPQ480正規化と矛盾するため設計書を優先した
- [x] `<chord>` を持つ音符が直前音符とstartTickが等しい
- [x] `<backup>` 使用後の音符が巻き戻り後のtickから計算される
- [x] 2パート曲でP1・P2それぞれのnoteIdがN0から連番になる（パート横断連番になっていない）
- [x] テンポ変化（`sound tempo`）をまたぐ場合にstartSeconds/durationSecondsが正しく累積される
- [x] 休符（`isRest: true`）もtickを消費するが判定対象外として扱われる（型上の確認）

## 完了サマリー

`data-model-v2.md`/`DEC-005`に基づき、`Score`/`Measure`/`Note`型にv2フィールド（`ticksPerQuarter`, `tempoMap`, `Measure.startTick`, `Note.startTick`/`durationTicks`/`startSeconds`/`durationSeconds`/`voice`）を追加した。`parser.ts`は、`<backup>`/`<forward>`/`<chord>`/`<attributes><divisions>`の兄弟要素間の出現順序を保持する必要があるため、fast-xml-parser（タグ名ごとに配列化され順序情報が失われる）に加えてDOMParserによる順序保持トラバースを導入し、パート内カーソル管理・小節頭リセット・chord同時刻・backup/forward巻き戻しを実装した。noteId採番はパート・小節ごとの出現順連番（`noteIndexCounter`）に統一し、`Measure.notes`はstartTick昇順（同tickはpartId→noteIndex順）でソートするようにした。tempoMapは`<direction><sound tempo>`をtick位置付きで収集し、区間積分により`startSeconds`/`durationSeconds`を算出する。

TDDに従い、設計書の机上検証例（divisions=2, 4/4, 右手の単音+和音, 左手の単音）をそのままテストケース化し、Red確認後に実装した。既存のパーサーテスト・統合テストは新モデル下でも全て変更なしで通過することを確認した（duration値が偶然にも従来のraw MusicXML値と一致するdivisions=1のケースのみで構成されていたため）。

`annotation-store`の`load()`に`validNoteIds`引数を追加し、指定した場合は現在の楽譜に存在しないnoteIdを`console.warn`付きでスキップし（ファイルは書き換えない）、スキップされたnoteId一覧を返すようにした。`App.tsx`はパース直後のScoreから有効なnoteId集合を作り`load()`に渡すよう変更した。

他コンシューマ（practice-engine, workers/fingering, App.tsx）は`npm run typecheck`で検出された型エラー（`App.tsx`の`let parsedScore`の型推論起因の1件）のみ最小修正した。practice-engineの判定ロジック自体（線形インデックス進行）はTASK-032のスコープのため変更していない。テストフィクスチャ（`*.test.ts`内のNoteリテラル）は`tsconfig.web.json`のtypecheck対象外だが、型定義との整合を保つため新フィールドを追加した。

`npm run test`（262件）・`npm run typecheck`・`npm run lint`が全てパスすることを確認済み。

## 情報の明確性

### 明示された情報

- 修正対象: `src/renderer/src/lib/musicxml-parser/parser.ts`
- 現状の問題箇所: `parser.ts:120-201`（パート連結構造）、`parser.ts:186`（noteId採番）
- 整合対象: `osmd-controller.ts:233-243` のパート毎連番方式
- 開発方針: TDD（既存テスト期待値更新を含む）
- 依存: TASK-030の設計書
- 根拠: 分析レポート原因5（`docs/sdd/troubleshooting/2026-07-04-app-unusable/analysis.md`）

### 不明/要確認の情報

- Note型の新規フィールドの正式名称・型（tick単位かミリ秒単位か等）はTASK-030の設計書確定後に判明するため、着手前に当該設計書を必読とする
