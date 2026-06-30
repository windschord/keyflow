# TASK-021: 楽譜の自動スクロール・カーソル追従実装（OSMD連携）

**ステータス**: TODO
**推定工数**: 50分
**依存**: TASK-011, TASK-016

---

## 説明

`REQ-002-003`（練習中に現在演奏中の小節が画面内に収まるよう自動スクロールする）を満たすため、
OSMD のカーソル制御と表示領域スクロールを実装する。
TASK-011 で `ScoreRenderer` / `OSMDController` の骨格は作成済みである。
ただし `moveCursor()` をはじめとする主要メソッドが未実装（ダミー）のままで、
楽譜のスクロールとカーソル追従が動作しない。
本タスクでそのギャップを解消する。

## 背景（現状の課題）

- `osmd-controller.ts` の `moveCursor()` は noteId から OSMD の音符へのマッピングが未実装で、カーソルが移動しない。
- 同ファイルの `setPartOpacity()` / `drawLoopBracket()` / `highlightNote()` / `buildNoteIdMap()` も空実装。
- `ScoreRenderer/index.tsx` のコンテナは `overflowY: 'auto'` だが、OSMD が `autoResize: true` で領域に合わせて描画するため縦スクロールが発生せず、横スクロールも未対応。

## 対象ファイル

- `src/renderer/src/components/ScoreRenderer/osmd-controller.ts` — カーソル移動・noteId マッピング・スクロール処理の実体化
- `src/renderer/src/components/ScoreRenderer/index.tsx` — スクロールコンテナの調整・カーソル追従の結線
- `src/renderer/src/components/ScoreRenderer/ScoreRenderer.test.tsx` — テスト追加

## 実装すべき内容

- `buildNoteIdMap()` を実装し、`{partId}-M{measureNumber}-N{noteIndex}` 形式の noteId を OSMD の音符参照へ対応付ける。
- `moveCursor(noteId)` を実装し、対象音符の位置へカーソルを移動する。
- カーソル移動後、現在演奏位置（小節）がビューポート内に収まるよう、コンテナを縦（必要なら横）スクロールする。
  - 例: カーソル/対象小節の DOM 矩形を取得し、`scrollIntoView`（`block: 'nearest'`）相当の処理を行う。
- 楽譜が表示領域からはみ出す場合に手動スクロールも可能であることを確認する（`autoResize` とスクロールの両立方針を決める）。

## 実装のポイント

- noteId の生成規則は MusicXML Parser（`parser.ts`）の `{partId}-M{measureNumber}-N{noteIndex}` と一致させる。
- カーソル追従は `currentNoteId` の変化を契機に `moveCursor()` → スクロールの順で行う。
- 自動スクロールはユーザーの手動スクロール操作を妨げないよう、追従はカーソル更新時のみに限定する。

## 受入基準

- [ ] `currentNoteId` が変化すると、対応する音符へカーソルが移動する。
- [ ] 練習進行に伴い、現在演奏中の小節が常に画面内に収まるよう自動スクロールする（`REQ-002-003`）。
- [ ] 楽譜が表示領域より大きい場合、ユーザーが手動でもスクロールできる。
- [ ] 既存の zoom 変更・パートハイライトの挙動を壊さない。
- [ ] 追加した挙動に対する単体テストが通る。

**依存関係**: TASK-011, TASK-016

## 関連

- [requirements/stories/US-002.md](../../requirements/stories/US-002.md) @US-002.md
- [design/components/score-renderer.md](../../design/components/score-renderer.md) @score-renderer.md
- [tasks/phase-4/TASK-011.md](../phase-4/TASK-011.md) @TASK-011.md
- [tasks/phase-5/TASK-016.md](TASK-016.md) @TASK-016.md
