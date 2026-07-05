# TASK-050: [BugFix] 運指提案の和音対応（コードユニットDP＋符頭単位描画）

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-050 |
| タイプ | bugfix |
| ステータス | DONE |
| 優先度 | High |
| 見積もり | 120分 |
| 依存タスク | TASK-048, TASK-049 |

## 背景

### 問題の概要

和音（同一 startTick の複数音）に対して運指提案が実質機能しない。

- 楽譜上は「和音でも1音分しか運指されない」ように見える
- 提案される指自体も、和音を「順に弾く単音列」として計算しているため物理的に不可能な割当（同じ指の連続、音高順と指順の不整合、スパン超過）になりうる

（分析レポート: `docs/sdd/troubleshooting/2026-07-05-user-feedback/analysis.md` 原因群C）

### 根本原因

1. **表示**: 計算・保存は和音の全構成音に行われている。しかし `buildNoteIdMap` が和音（同一 VoiceEntry）の全音に**同一のSVG座標**を登録する（`osmd-controller.ts:555-558`）。そのため `renderFingeringLayer`（`osmd-controller.ts:472-496`）が指番号を同一位置に重ねて描画し、1個しか無いように見える。
2. **DP**: `dp-solver.ts` の DP（`:43-63`）は音符列を1音ずつの遷移としてモデル化しており、同一 startTick の和音構成音同士にも `totalTransitionCost`（`cost-functions.ts:77`）を「時間遷移」として課す。和音内の音高順・指順の整合や和音内スパン制約（`SPAN_TABLE`、`span-table.ts:5`）の実行可能性チェックが存在しない。

### 関連する仕様

- REQ-009（AI運指提案）: `docs/sdd/design/components/fingering-engine.md` のコスト表・SPAN_TABLE
- REQ-002-005 / REQ-008-002: 楽譜上の運指番号表示
- DEC: Parncutt-Terzuolo DPモデル（Balliauw et al. 2015 の和音拡張を参考）
- `docs/sdd/troubleshooting/2026-07-05-user-feedback/analysis.md` 原因群C（worker/型プロトコル変更不要の方針）

## 実装内容

### 修正対象

- ファイル: `src/renderer/src/workers/fingering/dp-solver.ts`
  - 変更内容: 同一 `startTick` の音集合を**コードユニット**化し、ユニット列に対する DP へ拡張する。
    - 状態: ユニット内の音（右手=音高**昇順**）に対して指を**昇順**に割り当てるコンビネーション C(5,k)（左手=指**降順**）。k=1 のとき従来の5状態と一致する。
    - ユニット内コスト: 隣接ペアおよび端点ペアを `SPAN_TABLE` で実行可能性チェックし、不可能な組合せは `Infinity`。加えて構成音ごとの `weakFingerCost` / `thumbOnBlackCost` / `fiveOnBlackCost`（`cost-functions.ts:39,49,54`）を加算する。
    - ユニット間コスト: 既存 `totalTransitionCost` を用いる（単音ユニット同士の遷移は現行実装と一致させ、既存 `dp-solver.test.ts` の単旋律テストとの互換を保つ。ユニット間の代表音ペアの取り方は隣接する構成音同士など実装で明確化しコメントに記す）。
    - 60秒 deadline 処理（`dp-solver.ts:45-50`、`fingering.worker.ts:8` の deadline 生成）と部分結果返却（`backtrackPartial`）はユニット単位に読み替えて流用する。
- ファイル: `src/renderer/src/workers/fingering/dp-solver.ts`（`applyScalePattern` 統合部 `:24-28`）
  - 変更内容: `applyScalePattern` は**全ユニットがサイズ1（単旋律）のときのみ**適用するガードを追加する（和音を含む列にスケール定型を誤適用しない）。
- ファイル: `src/renderer/src/components/ScoreRenderer/osmd-controller.ts`
  - 変更内容: 和音構成音の指番号が重ならないように表示する。TASK-049 の照合ベースマップを前提に、`buildNoteIdMap` または `renderFingeringLayer` で符頭単位の座標を取得する（`cursor.GNotesUnderCursor()` 等のOSMD APIによる符頭座標の解決を調査して採用）。符頭単位座標が取得できない場合のフォールバックとして、同一座標に解決された和音構成音を音高順の縦オフセットで並べて描画する。
- ファイル: `dp-solver.test.ts` / `osmd-controller.test` の該当スイート
  - 変更内容: 和音DP・符頭単位（または縦オフセット）描画のテストを追加する。

### 実装手順

TDDで進める。

1. 失敗するテストを先に書く: 3和音（例: C4-E4-G4、右手）で3音全てに指が割り当てられ、音高昇順=指昇順かつ `SPAN_TABLE` の実行可能範囲内であること。同一指の重複割当がないこと。red を確認してコミット。
2. `dp-solver.ts` にコードユニット化（`startTick` でのグルーピング）と C(5,k) 状態の DP を実装して green にする。単音ユニットのみの列で従来のコスト・結果と一致することを回帰テストで確認する。
3. `applyScalePattern` の「全ユニットがサイズ1のときのみ適用」ガードをテスト→実装する（和音を1つ混ぜた列でスケールパターンが適用されず DP にフォールバックすること）。
4. deadline 処理をユニット単位で動作させ、部分結果が返ることをテストする。
5. 表示側: 和音構成音の指番号が異なる座標（符頭単位、またはフォールバックの縦オフセット）で描画されることをテスト→実装する。
6. 全テスト・typecheck・lint を通す。

### 注意事項

- TASK-048（`Note.hand` によるフィルタ済み入力）・TASK-049（照合ベースの noteId マップ）完了が前提。
- `FingeringRequest`/`FingeringResponse` のメッセージ型（`workers/fingering/types.ts`）と `FingeringEngineService` のインターフェースは**変更しない**（分析レポート原因群Cの方針。変更は dp-solver 内部と描画のみ）。
- C(5,k) はユニットサイズ k=1..5 で 5/10/10/5/1 通り。6音以上の同時発音（両手混在は TASK-048 のフィルタで排除される前提だが、片手内で5音超の場合）は上限5音で打ち切るか部分割当としてスキップする方針を実装コメントで明確化する。
- 左手は音高昇順に対して指**降順**（低い音ほど5指側）となることに注意。`leftHandScaleFactor`（`HandSettings`）等の既存左手処理と整合させる。
- 休符は入力に含まれない（`FingeringPanel/index.tsx` で `isRest` 除外済み）前提を維持する。
- 縦オフセット描画をフォールバックにする場合も、ズーム・リサイズ後（TASK-049 の再構築経路）で崩れないこと。

## 受入基準

- [x] 3和音で3音全てに指番号が割り当てられ、音高昇順=指昇順（右手）・スパン制約内・指の重複なしという物理的に妥当な運指になる
- [x] 左手の和音では音高昇順に対して指降順で割り当てられる
- [x] 単旋律入力の結果・コストが現行実装と一致し、既存の `dp-solver.test.ts` が修正なしで通る
- [x] 和音を含む列にスケール定型パターンが適用されない（全ユニットがサイズ1のときのみ適用）
- [x] deadline 到達時にユニット境界までの部分結果が返る
- [x] 楽譜上で和音の各構成音の指番号が重ならずに表示される（符頭単位座標または音高順の縦オフセット）
- [x] worker のメッセージ型・`FingeringEngineService` の公開インターフェースが変更されていない
- [x] 既存のテストが通る
- [x] 新規テストが追加されている（必要な場合）

## テスト項目

- [x] （新規）3和音の全音割当・音高昇順=指昇順・SPAN_TABLE 実行可能性・指重複なし
- [x] （新規）左手和音の指降順割当
- [x] （新規）和音内で物理的に不可能な組合せ（スパン超過）が選ばれない（Infinity 排除）
- [x] （新規）和音混在列で applyScalePattern が適用されない
- [x] （新規）deadline 打ち切りでの部分結果
- [x] （新規）和音構成音の指番号描画座標が互いに異なる
- [x] （回帰）単旋律の既存 dp-solver テスト・scale-patterns テストが通る。`npm run test` 全件グリーン、`npm run typecheck` / `npm run lint` パス

## 完了サマリー

`dp-solver.ts` を、同一 `startTick` でグルーピングした「コードユニット」列に対するDPへ刷新した。
実装上は `Note.isChord` の連続性で判定する。実データでは同一startTickと等価であり、かつ既存
テストフィクスチャの `startTick:0` 固定という前提とも後方互換になる。

- ユニット内: ピッチ昇順の構成音に対し、C(5,k) の指の組み合わせ（右手=昇順、左手=降順）を列挙する。
  隣接ペア・端点ペアを `SPAN_TABLE`（`getSpan`）で実行可能性チェックし（超過はInfinity）、各構成音の
  `weakFingerCost`/`thumbOnBlackCost`/`fiveOnBlackCost` を加算する（`unitInternalCost`）。
- ユニット間: `totalTransitionCost` の静的コスト（遷移先の指の静的コスト）二重計上を避けるため、
  「動き」のみの成分（`spanCost`+`thumbPassingCost`+`largeJumpCost`）に分解した
  `unitTransitionMotionCost` を採用。単音ユニット同士（k=1）では
  `unitInternalCost` の静的コスト + `unitTransitionMotionCost` が
  `totalTransitionCost` と数学的に厳密一致するため、既存 `dp-solver.test.ts`（8件）は無修正で
  そのまま通過することを確認済み。
- `applyScalePattern` は全ユニットがサイズ1のときのみ適用するガードを追加。
- deadline処理・部分結果返却はユニット単位（`u % 100 === 0`）に読み替えて流用。
- 6音以上の同時発音（片手・稀なケース）は上限5音でDP対象を打ち切り、残りは最も近いピッチの
  割当済み指を再利用するフォールバック（固定ペナルティ加算、`assignOverflowFingers`）。
- 表示側は `osmd-controller.ts` の `buildNoteIdMap` を修正。同一カーソル位置（和音）に複数の
  構成音が解決された場合、音高降順に並べて一定間隔（`CHORD_NOTE_VERTICAL_OFFSET_PX`=10px）の
  縦オフセットを付与する。符頭単位のSVG座標を `GraphicalNote.PositionAndShape` 等から直接取得する
  方式は採用しなかった。OSMD内部の単位変換が必要な上、本コントローラのテスト環境（jsdomベースの
  最小限モック）では実際のグラフィカルレイアウトを検証できないためである。代わりに、タスク指示で
  明記されたフォールバック（音高順の縦オフセット）を採用した。`renderFingeringLayer` は座標マップをそのまま参照するため
  変更不要。

worker のメッセージ型（`FingeringRequest`/`FingeringResponse`）・`FingeringEngineService` の
公開インターフェースは変更していない（分析レポート原因群Cの方針どおり）。

テスト: `dp-solver.test.ts` に5件、`osmd-controller.test.ts` に2件を追加。
`npm run test`（408件）・`npm run typecheck`・`npm run lint` すべてパス。

## 情報の明確性

### 明示された情報

- 根本原因の file:line を実コードで検証済み。`osmd-controller.ts:555-558` の同一座標登録、`renderFingeringLayer:472-496`、`dp-solver.ts:43-63` の単音遷移DP、`applyScalePattern` 統合 `:24-28`、deadline `:45-50` を確認した
- 修正方針: コードユニットDP（C(5,k)状態・SPAN_TABLE実行可能性・既存遷移コスト流用・worker型不変）＋符頭単位描画（分析レポート承認済み方針 TASK-050）
- 符頭座標の取得候補: `cursor.GNotesUnderCursor()` 等（指示で明示。実装時にOSMD APIを調査して確定する）

### 不明/要確認の情報

- なし（すべて確認済み。符頭座標APIの選定は実装時調査事項として本文に明記済み）
