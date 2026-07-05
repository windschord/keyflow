# TASK-049: [BugFix] noteIdマッピングの照合ベース化とリサイズ/ズーム座標ずれ修正

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-049 |
| タイプ | bugfix |
| ステータス | DONE |
| 優先度 | High |
| 見積もり | 90分 |
| 依存タスク | TASK-048 |

## 背景

### 問題の概要

- ウィンドウをリサイズすると、楽譜クリックの位置解決・運指番号・ハイライト・ループ枠などのオーバーレイ表示がずれる/消える
- 多声部・2段譜の小節では、そもそも同じ noteId が楽譜上の別の音を指しており、運指表示・正誤ハイライト・右クリックの運指メモが誤った音に紐付く

（分析レポート: `docs/sdd/troubleshooting/2026-07-05-user-feedback/analysis.md` 原因群B）

### 根本原因

1. **staleキャッシュ**: `OSMDController` は `autoResize: true` で生成され（`osmd-controller.ts:32`）、リサイズ時に OSMD が自動再レイアウトするが、クリック解決・オーバーレイ描画に使う `noteIdToSvgCoord` はロード時の `buildNoteIdMap()` 1回でしか構築されない（`ScoreRenderer/index.tsx:71`）。再レイアウト後も古い座標を使い続けるため表示・クリック解決がずれる。オーバーレイ（運指・ループ枠・グレーアウト・ハイライト）も OSMD の再描画で SVG から消えたまま再適用されない。
2. **setZoom経路にも同種の欠陥**: `setZoom`（`osmd-controller.ts:241-248`）は `render()` 後に `reapplyOverlays()` を呼ぶが `buildNoteIdMap()` を呼ばないため、ズーム後のオーバーレイは古い座標で再描画される。
3. **採番不整合（潜在バグ）**: `buildNoteIdMap`（`osmd-controller.ts:503-578`）はパーサとは独立に、OSMDカーソルの**タイムスタンプ順**でパート毎連番を振り直す（`:552-562`）。一方パーサは**XML文書順**（staff1全音→`<backup>`→staff2）で採番する（`parser.ts:300-302`）。多声部・2段譜の小節では順序が食い違い、同じ noteId が別の音を指す。
4. **リソース解放漏れ**: `OSMDController` に dispose がなく、コンストラクタで登録した click/contextmenu リスナー（`osmd-controller.ts:36-37`）が解除されない。`ScoreRenderer/index.tsx:50-54` もアンマウント時に何も解放しない。

### 関連する仕様

- REQ-002-004: 小節（音符）クリックによるカーソル移動（クリック位置→noteId解決の正しさ）
- REQ-002-005 / REQ-008-002: 楽譜上の運指番号表示
- REQ-004-003/004: 正誤ハイライト
- REQ-002-007: グレーアウト（TASK-048でnote単位化）
- `docs/sdd/design/components/data-model-v2.md`: noteId採番の統一（本タスクで「照合ベース」に是正）

## 実装内容

### 修正対象

- ファイル: `src/renderer/src/components/ScoreRenderer/osmd-controller.ts`
  - 変更内容:
    1. `buildNoteIdMap`（`:503-578`）の独立採番を廃止し、**パース済み `Score` を受け取り、「小節番号・タイムスタンプ由来tick・midiNumber・staff」の照合**で OSMD 上の音と `Note.id` を対応付ける方式へ変更する（OSMDカーソルのタイムスタンプから tick を導出し、`Score.measures[].notes` の `startTick`/`midiNumber`/`staff` と突き合わせる。TASK-048 で導入した `Note.staff` を使用）。これによりパーサのXML順とOSMDのタイムスタンプ順の採番不整合を解消する。
    2. `autoResize: false` にし、コンテナの `ResizeObserver`（デバウンス 200〜300ms）で「`osmd.render()` → `buildNoteIdMap()` → `reapplyOverlays()`」を自前制御する。
    3. `setZoom`（`:241-248`）にも `render()` 後・`reapplyOverlays()` の**前**に `buildNoteIdMap()` を追加する。
    4. `dispose()` を追加する: ResizeObserver の disconnect、click/contextmenu リスナー（`:36-37`）の解除。
- ファイル: `src/renderer/src/components/ScoreRenderer/index.tsx`
  - 変更内容: `buildNoteIdMap` 呼び出し（`:71`）へパース済み `score` を渡す。アンマウント時に `osmdControllerRef.current?.dispose()` を呼ぶ cleanup を追加する。
- ファイル: `osmd-controller.test` / `ScoreRenderer.test` の該当スイート
  - 変更内容: 照合ベース採番・リサイズ後の再構築・dispose を検証するテストを追加する。

### 実装手順

TDDで進める。

1. 失敗するテストを先に書く: TASK-048 の2段譜フィクスチャ（多声部を含む）で、`buildNoteIdMap(score)` が返すマップの noteId がパーサの `Note.id` と正しく対応する（小節番号・tick・midiNumber・staff の照合で一意に解決される）ことを検証する。red を確認してコミット。
2. `buildNoteIdMap` を照合ベースへ書き換えて green にする（照合に失敗した音はスキップし warn ログ。フォールバックで誤対応を作らない）。
3. `autoResize: false` + ResizeObserver（デバウンス 200〜300ms）を実装し、リサイズ発火で render→マップ再構築→オーバーレイ再適用が呼ばれることをテストで検証する（ResizeObserver はテストではモック発火）。
4. `setZoom` の `render()` 直後に `buildNoteIdMap()` を追加し、`reapplyOverlays()` より前に実行されることを検証する。
5. `dispose()` を実装し、ScoreRenderer のアンマウント cleanup から呼ぶ。disconnect・リスナー解除を検証する。
6. 全テスト・typecheck・lint を通す。

### 注意事項

- TASK-048（`Note.staff`/`Note.hand` の導入）完了が前提。照合キーに staff を使う。
- 照合ベース化により `noteIdToCursorState`（カーソル移動用、`osmd-controller.ts:47`）の構築も同じ走査で維持すること（`moveCursor` の互換を壊さない）。
- ResizeObserver のデバウンス中に連続リサイズが来ても render が多重実行されないこと。`loaded` 前（`load()` 完了前）にはリサイズ処理を走らせないこと。
- `reapplyOverlays()`（`osmd-controller.ts:251-256`）は既存実装（運指・ループ・グレーアウト・ハイライト）を流用する。TASK-048 でグレーアウトが note 単位になっている場合はその再適用に追随する。
- 和音の符頭単位座標（同一 VoiceEntry 内の全音が同一座標になる問題、`osmd-controller.ts:555-558`）の解消は TASK-050 のスコープであり、本タスクでは「正しい音に noteId が対応する」ことまでを保証する。
- dispose 後にメソッドが呼ばれてもクラッシュしないこと（防御的に no-op）。

## 受入基準

- [x] 多声部を含む2段譜フィクスチャで、`buildNoteIdMap` が全発音ノートの noteId をパーサの `Note.id` と正しく対応付ける（誤対応ゼロ、未解決はスキップ+警告）
- [x] ウィンドウリサイズ後（デバウンス経過後）に noteId マップが再構築され、運指番号・ループ枠・グレーアウト・ハイライトが新レイアウト上の正しい位置に再描画される
- [x] リサイズ後の楽譜クリック・右クリックが新レイアウトの座標で正しい noteId に解決される（noteIdToSvgCoord がbuildNoteIdMap再構築で更新されるため、findNearestNoteId解決も追随する）
- [x] `setZoom` 後にマップ再構築→オーバーレイ再適用の順で実行され、ズーム後の表示位置が正しい
- [x] `dispose()` が ResizeObserver の disconnect と click/contextmenu リスナー解除を行い、ScoreRenderer のアンマウントで呼ばれる
- [x] 既存のテストが通る
- [x] 新規テストが追加されている（必要な場合）

## テスト項目

- [x] （新規）照合ベース採番: 2段譜・多声部フィクスチャで noteId 対応の正しさ（パーサ採番との突き合わせ）
- [x] （新規）リサイズ: ResizeObserver 発火→デバウンス→render→buildNoteIdMap→reapplyOverlays の呼び出し順序検証
- [x] （新規）setZoom: render 後 buildNoteIdMap が reapplyOverlays より前に呼ばれる
- [x] （新規）dispose: disconnect・リスナー解除・アンマウント結線
- [x] （回帰）moveCursor・既存オーバーレイ表示のテストが通る。`npm run test` 全件グリーン、`npm run typecheck` / `npm run lint` パス

## 完了サマリー（2026-07-05実施）

### 実施内容

1. **照合ベースのnoteIdマッピング**: `OSMDController.buildNoteIdMap(score: Score)` のシグネチャを変更し、パース済み `Score` を受け取るようにした。OSMDカーソルが返す各Noteから
   `isRest()` / `halfTone`（+12でMIDI番号に正規化。実OSMDで実測しC4=48→60等を確認済み）/
   `ParentStaffEntry.ParentStaff.Id`（1始まり、パーサのstaffと同一基準であることを実測確認）/
   `ParentStaffEntry.AbsoluteTimestamp.RealValue`（全音符=1→tick変換）を抽出し、
   同一小節・同一tick許容差(±2)・同一(isRest,midiNumber)でグルーピングしたうえで、
   複数候補がある場合はstaff昇順でzipして対応付ける方式に書き換えた（`describeOsmdNote`/`matchNotesForTimestamp`）。
   照合できないNoteはマップに含めずwarnログのみ出す。
2. **autoResize:false化＋ResizeObserver自前制御**: コンストラクタで`autoResize:false`にし、
   `ResizeObserver`（jsdom等未対応環境では生成をスキップする防御実装）でコンテナのリサイズを検知、
   250ms（200〜300ms範囲）デバウンス後に `render()→buildNoteIdMap(lastScore)→reapplyOverlays()` を実行する
   `scheduleResizeHandling`/`handleResize` を追加。`load()`完了前（`loaded=false`）は何もしない。
3. **setZoom**: `render()` 直後・`reapplyOverlays()` の前に `buildNoteIdMap(lastScore)` を追加。
4. **dispose()**: ResizeObserverのdisconnect、click/contextmenuリスナー解除、保留デバウンスタイマーのクリアを行う
   `dispose()` を追加し、`disposed`フラグでリサイズ処理を以降no-opにした。
5. **ScoreRenderer/index.tsx**: `buildNoteIdMap()`呼び出しに`score`を渡すよう変更。OSMDController生成用effectを
   「無条件に新規生成しクロージャで保持したcontrollerをdisposeする」形に変更し、アンマウント時に確実にdispose()が
   呼ばれるようにした（cleanup順序の都合上、`osmdControllerRef.current`はnullに戻さず、他effectのクリーンアップが
   引き続き参照できるようにしている）。

### 検証事項

- 実OSMD（jsdomの制約でrender()自体はcanvas未実装により動かせないが、`osmd.load()`後の内部データモデル（`Sheet.SourceMeasures`）は
  構築可能なため、実際のOSMD Note オブジェクトで `halfTone`/`Pitch.getHalfTone()`/`ParentStaffEntry.ParentStaff.Id`/
  `ParentStaffEntry.AbsoluteTimestamp.RealValue` の値を実測し、`midiNumber = halfTone + 12`、
  `staff = ParentStaff.Id`（1始まり、パーサと同一基準）であることを確認した上で実装した。
- ブラウザ実機での目視確認（実際のElectron/OSMDレンダリング）は本エージェント実行環境では実施不可（GUI起動不可）。
  ユーザー側での実機確認を推奨する。

### テスト

- `src/renderer/src/components/ScoreRenderer/osmd-controller.test.ts`: 32件（新規: 照合ベース採番2件、
  リサイズ3件、setZoom1件、dispose3件を追加）
- `src/renderer/src/components/ScoreRenderer/ScoreRenderer.test.tsx`: 15件（新規: dispose呼び出し1件、
  buildNoteIdMapへのscore引き渡し1件を追加）
- `npm run test`: 389件全件パス
- `npm run typecheck`: パス
- `npm run lint`: パス

## 情報の明確性

### 明示された情報

- 根本原因の file:line（実コードで検証済み: `osmd-controller.ts:32` の autoResize、`:503-578` の独立採番（`:552-562`）、`:241-248` の setZoom、`:36-37` のリスナー、`ScoreRenderer/index.tsx:71` の1回きり構築、dispose不在）
- 修正方針: 照合ベースのマップ構築＋autoResize:false＋ResizeObserver自前制御＋dispose追加（分析レポート承認済み方針 TASK-049）
- デバウンス値: 200〜300ms（指示で明示）

### 不明/要確認の情報

- なし（すべて確認済み）
