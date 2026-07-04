# TASK-033: 楽譜上の視覚フィードバック実装（osmd-controller空実装の解消）

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-033 |
| タイプ | feature |
| ステータス | TODO |
| 優先度 | Medium |
| 見積もり | 50分 |
| 依存タスク | TASK-032 |

## 背景

### 問題の概要

`osmd-controller.ts` の3つのメソッド（`setPartOpacity`・`highlightNote`・`drawLoopBracket`）が空実装（ダミー）のままで、楽譜上の非練習パートのグレーアウト・正誤ハイライト・ループ範囲表示が一切機能していない。加えて `App.tsx` 側で小節クリックによるカーソル移動・鍵盤上の指番号アノテーション表示・正解率統計UIも未結線・未実装のまま放置されている。

### 根本原因

- `osmd-controller.ts:94-96`（`setPartOpacity`）、`osmd-controller.ts:98-100`（`drawLoopBracket`）、`osmd-controller.ts:111-113`（`highlightNote`）がいずれも `// Dummy implementation` コメントのみで実処理が存在しない。
- `App.tsx:161`: `onNoteClick={() => {}}` — 小節クリックイベントが空関数に結線され、カーソル移動（REQ-002-004）が機能しない。
- `App.tsx:172`: `annotations={[]}` — 鍵盤コンポーネントへのアノテーションが常に空配列固定であり、運指提案結果や手動メモの指番号表示（US-005/US-008関連、REQ-005-007）が鍵盤上に反映されない。
- 正解率・連続正解数の表示コンポーネントが存在せず、US-004の統計値（`stats.accuracy`、`stats.correctNotes` 等、`practice-engine/index.ts:77-78`で計算済み）がUIに表示されない。
- TASK-021/022はステータスDONEだが受入基準チェックボックスが全項目未チェックであり、実UIを起動したQAが行われていなかった（分析レポート原因6）。

### 関連する仕様

- REQ-002-007: 非練習パートのグレーアウト表示
- REQ-002-004: 小節クリックによるカーソル移動
- REQ-005-007: 鍵盤上の指番号表示
- US-004: 正誤判定（正解率・連続正解数の可視化）
- US-007: 繰り返し練習（ループ範囲の楽譜上表示）
- TASK-032完了後の時刻グループベース判定結果（`highlightNote` に渡す正誤情報のソース）

## 実装内容

### 修正対象

- ファイル: `src/renderer/src/components/ScoreRenderer/osmd-controller.ts`（`setPartOpacity` 94-96行目、`highlightNote` 111-113行目、`drawLoopBracket` 98-100行目の実装）
- ファイル: `src/renderer/src/App.tsx`（161行目 `onNoteClick`、172行目 `annotations={[]}` の結線修正）
- ファイル: `src/renderer/src/components/ScoreRenderer/index.tsx`（props経由でosmd-controllerメソッドを呼び出す配線の確認・追加）
- ファイル: 正解率・連続正解数表示用の新規UIコンポーネント（例: `src/renderer/src/components/StatsDisplay/index.tsx`）
- ファイル: 対応するテストファイル（`osmd-controller.test.ts` 等が存在する場合は期待値更新、新規テスト追加）
- 変更内容: 楽譜上の視覚フィードバック実装、UIスタブの結線解消、統計表示UIの追加

### 実装手順

1. `docs/sdd/design/components/score-renderer.md`（存在する場合）またはOSMDの `GraphicalNote`/`Instrument` APIを確認し、パート単位の透明度制御・ノート単位の色付け・小節範囲への矩形/ブラケット描画の実装方法を調査する
2. **`setPartOpacity`** を実装する: OSMDの `osmd.Sheet.Instruments` からpartIdに対応するInstrumentを取得し、SVG要素（該当パートの描画グループ）に対して `opacity` スタイルを適用する
3. **`highlightNote`** を実装する: 既存の `noteIdToSvgCoord`（`osmd-controller.ts:239` 周辺で構築済み）を使い、対象noteIdのSVG要素またはオーバーレイ円/矩形に対して `correct`（緑）/`incorrect`（赤）/`expected`（デフォルト色に戻す等）の色を適用する
4. **`drawLoopBracket`** を実装する: 開始小節・終了小節のSVG座標を取得し、ループ範囲を示すブラケットまたは背景矩形をSVGオーバーレイとして描画・除去する
5. `App.tsx:161` の `onNoteClick={() => {}}` を、クリックされた小節番号を受け取り `practiceEngine.resetToMeasure(measureNumber)` を呼ぶハンドラに置き換える
6. `App.tsx:172` の `annotations={[]}` を、store（またはannotation-store）から取得した実際のアノテーション配列に置き換え、`PianoKeyboard` に指番号が渡るようにする
7. 正解率・連続正解数を表示する `StatsDisplay` コンポーネントを新規作成し、`practiceEngine` の `stats`（`accuracy`, `correctNotes` 等）をZustand store経由で購読して表示する。日本語ラベルを付与する（NFR-U-002準拠）
8. `App.tsx` に `StatsDisplay` を配置する
9. 各実装に対するユニットテスト（osmd-controllerのDOM操作テスト、App.tsxの結線テスト、StatsDisplayの表示テスト）を追加する
10. `npm run dev` で実起動し、実際に非練習パートがグレーアウトされる・正誤で楽譜が色づく・ループ範囲が表示される・小節クリックでカーソルが移動する・鍵盤に指番号が出る・統計が表示されることを目視確認する
11. `npm run typecheck` / `npm run lint` / `npm run test` を実行する

### 注意事項

- 本タスクはTASK-032（時刻グループ単位の判定）完了後に着手する。`highlightNote` に渡す正誤情報は時刻グループ単位の判定結果と整合させること
- OSMDのSVG構造はレンダリング（`render()`）のたびに再構築されるため、`setZoom`（`osmd-controller.ts:102-109`）が既に行っているように、再描画後にオーバーレイ（ハイライト・ループブラケット）を再適用する仕組みが必要
- TASK-021/022のE2E不足（実UI未起動のQA）が原因6として指摘されているため、本タスクの完了条件には「`npm run dev` での実機能目視確認」を明記し、受入基準チェックを形骸化させないこと
- 「手:右手」ドロップダウン（運指計算対象）とLeft/Right/Both（練習対象パート）の2つの手選択の整理はフェーズAのToolbar UX改善（原因4）の範囲であり、本タスクはあくまで視覚フィードバックの結線に閉じる

## 受入基準

- [ ] `setPartOpacity` が実装され、非練習パートの音符がグレーアウト表示される（REQ-002-007）
- [ ] `highlightNote` が実装され、正誤判定結果に応じて楽譜上の音符が緑/赤にハイライトされる
- [ ] `drawLoopBracket` が実装され、ループ範囲が楽譜上に視覚表示される
- [ ] `App.tsx:161` の空関数が解消され、小節クリックでカーソルが該当小節に移動する（REQ-002-004）
- [ ] `App.tsx:172` の `annotations={[]}` 固定が解消され、鍵盤上に指番号アノテーションが表示される（REQ-005-007）
- [ ] 正解率・連続正解数を表示するUIが追加され、日本語ラベルで表示される（US-004、NFR-U-002）
- [ ] `npm run dev` での実機起動により、上記6項目すべてが目視で動作確認されている
- [ ] 既存のテストが通る
- [ ] 新規テストが追加されている

## テスト項目

- [ ] 非練習パート（例: 左手モード時の右手パート）のSVG要素にopacityが適用されることをDOMテストで確認する
- [ ] 正解時・不正解時にnoteIdに対応するSVG要素の色が変化することを確認する
- [ ] ループ設定後、楽譜上にブラケット/矩形要素が追加され、ループ解除で除去されることを確認する
- [ ] 小節クリックでstoreの `currentMeasure` が更新されることを確認する
- [ ] アノテーションが存在するnoteIdに対応する鍵盤位置に指番号が表示されることを確認する
- [ ] 統計表示が `correctNotes`/`incorrectNotes`/`accuracy` の変化に追従して更新されることを確認する
- [ ] 実機E2E: `npm run dev` 起動→曲を開く→MIDI（またはクリック）演奏→楽譜色づけ・鍵盤指番号・統計表示・ループ表示を目視確認する

## 情報の明確性

### 明示された情報

- 空実装箇所: `osmd-controller.ts:94-96`（setPartOpacity）、`osmd-controller.ts:111-113`（highlightNote）、`osmd-controller.ts:98-100`（drawLoopBracket）
- 未結線箇所: `App.tsx:161`（onNoteClick空関数）、`App.tsx:172`（annotations固定空配列）
- 追加UI: 正解率・連続正解数の表示（US-004）
- 対応要件: REQ-002-007（グレーアウト）、REQ-002-004（小節クリックカーソル移動）、REQ-005-007（鍵盤指番号表示）
- 依存: TASK-032（時刻グループ判定結果を正誤ハイライトに利用）
- 根拠: 分析レポート原因4・原因6（`docs/sdd/troubleshooting/2026-07-04-app-unusable/analysis.md`）

### 不明/要確認の情報

- ループブラケットの具体的な描画スタイル（矩形背景か線ブラケットか）はUXデザインの指定がないため、実装時に既存の楽譜UIと調和する簡潔な表現（半透明矩形など）を選択する。デザインレビューが必要な場合は実装後にユーザー確認を挟む
