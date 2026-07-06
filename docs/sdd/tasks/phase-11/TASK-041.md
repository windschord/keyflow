# TASK-041: [BugFix] 鍵盤ガイドの左右色分け修正

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-041 |
| タイプ | bugfix |
| ステータス | DONE |
| 優先度 | High |
| 見積もり | 30分 |
| 依存タスク | なし |

## 背景

### 問題の概要

画面下部の鍵盤ガイドで、右手パート/左手パートの色分け（REQ-005-002）が機能しない。両手モードでは左右どちらのパートの音符も左手色で表示される（右手練習モード時のみ全ノーツが右手色になる）。

（分析レポート: `docs/sdd/troubleshooting/2026-07-05-test-escape/analysis.md` H5）

### 根本原因

- `src/renderer/src/components/PianoKeyboard/keyboard-renderer.ts:48-49` が
  `expectedNote.partId.toLowerCase().includes('right') || practiceMode === 'right'`
  というヒューリスティックで右手判定している。
- 実際のpartIdはMusicXML由来の `P1` / `P2` 形式であり、`'right'` を含むことはないため、partIdによる判定は常にfalse。`practiceMode === 'right'` の場合を除き全ノーツが左手色になる。
- 一方、parserは `Part.hand`（`src/renderer/src/types/score.ts:19`、hand-detectorで算出済み・テスト済み）を持っており、`ScoreRenderer/index.tsx:94-101` ではこれを正しく使用している。PianoKeyboardへの伝搬だけが欠落している。

### 関連する仕様

- REQ-005-002: 右手の音符は青色、左手の音符は緑色でハイライト表示しなければならない
- REQ-001-003（parserの手判定。実装・テスト済み）
- `docs/sdd/requirements/traceability.md` REQ-005-001/002行: 「×※ 鍵盤ハイライトの色検証なし。左右色分けはpartId判定バグで機能せず（TASK-041）」

## 実装内容

### 修正対象

- ファイル: `src/renderer/src/components/PianoKeyboard/keyboard-renderer.ts`
  - 変更内容: `partId.includes('right')` ヒューリスティック（:48-49）を廃止し、呼び出し元から渡される手情報（`partId → hand` のマップ、または `Part[]`）に基づいて `hand === 'right'` で判定する。`RenderOptions` にパラメータを追加する。
- ファイル: `src/renderer/src/components/PianoKeyboard/index.tsx`
  - 変更内容: propsに `parts: Part[]`（または `Map<string, Hand>`）を追加し、`renderKeyboard` へ渡す。
- ファイル: `src/renderer/src/App.tsx`
  - 変更内容: `<PianoKeyboard>`（:266-274）に `score.parts` 由来の手情報を渡す（`score` が `null` の場合は空を渡す）。
- ファイル: `src/renderer/src/components/PianoKeyboard/PianoKeyboard.test.tsx`（または keyboard-renderer のテスト）
  - 変更内容: `P1`（右手）/`P2`（左手）形式のpartIdで期待ノーツを与え、`KEY_COLORS.*.guidRight` / `guidLeft` が使われることを検証する色アサーションを追加する。

### 実装手順

TDDで進める。

1. 失敗するテストを先に書く: partIdが `P1`（hand: 'right'）の期待ノーツで `guidRight` 色、`P2`（hand: 'left'）で `guidLeft` 色が `ctx.fillStyle` に設定されることを検証する。実際のpartId形式 `P1`/`P2` を必ず使い、`'right'` を含むpartIdでテストしないこと。
2. テストを実行し、失敗（red）を確認してコミットする（現実装は `P1`/`P2` をすべて左手色にするため、右手ケースが失敗するはず）。
3. `keyboard-renderer.ts` の `RenderOptions` に手情報を追加し、判定を `hand === 'right'` に置き換える。
4. `PianoKeyboard/index.tsx` にpropsを追加し、`App.tsx` から `score.parts` を伝搬する。
5. テストが通る（green）ことを確認する。
6. `docs/sdd/requirements/traceability.md` の REQ-005-001/002 行を更新する。

### 注意事項

- `practiceMode === 'right'` の条件（:49）も合わせて廃止する。片手モードではexpectedNotes自体がそのパートにフィルタ済みのため、色はあくまで `Part.hand` に基づくべき（右手モードで左手ノーツが右手色になる副作用を残さない）。
- 手情報が引けないpartId（マップに存在しない場合）のフォールバック色を決めて実装すること（左手色フォールバックで可。ただし挙動をテストで固定する）。
- `KEY_COLORS`（`key-layout.ts`）の色定義自体は変更しない。
- TASK-044（運指メモUI）が本タスクのprops形状に依存するため、propsの型（`Part[]` とマップのいずれか）はテスト容易性を優先して決定し、コメントで明記する。

## 受入基準

- [x] 両手モードで、右手パート（hand: 'right'）の期待ノーツが右手色、左手パート（hand: 'left'）が左手色で描画される
- [x] 実際のpartId形式（`P1`/`P2`）でテストされており、`'right'` を含む合成partIdに依存したテストがない
- [x] `keyboard-renderer.ts` から `partId.includes('right')` ヒューリスティックが削除されている
- [x] 片手練習モードでも色は `Part.hand` に基づく
- [x] `docs/sdd/requirements/traceability.md` の REQ-005-001/002 行が更新されている
- [x] 既存のテストが通る
- [x] 新規テストが追加されている（必要な場合）

## テスト項目

- [x] （新規・描画）`P1`（右手）の期待ノーツ→ `guidRight` 色（白鍵・黒鍵両方）
- [x] （新規・描画）`P2`（左手）の期待ノーツ→ `guidLeft` 色
- [x] （新規・描画）手情報が引けないpartId→フォールバック色（挙動固定）
- [x] （回帰）押鍵中（correct）・誤答（incorrect）の色が従来どおり優先される
- [x] （回帰）`npm run test` 全件グリーン、`npm run typecheck` / `npm run lint` パス

## 完了サマリー

- `src/renderer/src/components/PianoKeyboard/keyboard-renderer.ts`: `RenderOptions` に
  `parts?: Part[]`（parser算出済み `Score.parts`）を追加。`expectedNote.partId.toLowerCase()
  .includes('right') || practiceMode === 'right'` ヒューリスティックを削除し、
  `parts` から構築した `partId → Hand` のマップ（`handByPartId`）を参照して
  `hand === 'right'` で判定するよう修正。`practiceMode` は判定に使用しなくなった
  （破壊的変更を避けるため `RenderOptions` 自体からは削除せず、関数内で未使用）。
  partIdがマップに存在しない場合は左手色にフォールバック（挙動をテストで固定）。
- `src/renderer/src/components/PianoKeyboard/index.tsx`: `PianoKeyboardProps` に
  `parts?: Part[]`（デフォルト `[]`）を追加し、`renderKeyboard`呼び出しとuseEffectの
  依存配列に伝搬。
- `src/renderer/src/App.tsx`: `<PianoKeyboard>` に `parts={score?.parts ?? []}` を追加。
- `src/renderer/src/components/PianoKeyboard/PianoKeyboard.test.tsx`: 実際のpartId形式
  （`P1`=hand:right、`P2`=hand:left）を用いた色分けテストを追加（TDD Red→Green）。
  `fillRect` 呼び出し時点の `ctx.fillStyle` を記録する `createColorTrackingCtx` ヘルパーで、
  白鍵・黒鍵それぞれの `guidRight`/`guidLeft`、partsに存在しないpartIdのフォールバック
  （`guidLeft`）、片手練習モード（`practiceMode: 'right'`）でも左手パートは`guidLeft`の
  ままであること、押鍵中（correct）・誤答（incorrect）の色がガイド色より優先されることを検証。
  既存の指番号描画テスト（9件）は変更なしで全てグリーン。
- `docs/sdd/requirements/traceability.md` の REQ-005-001/002 行を `×※` から `○` に更新。
- 確認結果: `npm run test`（32ファイル / 243テスト 全通過）、`npm run typecheck`、
  `npm run lint` すべてパス。

## 情報の明確性

### 明示された情報

- 根本原因のfile:line（H5、実コードで検証済み: `keyboard-renderer.ts:48-49`、`types/score.ts:19` の `Part.hand`、`App.tsx:266-274` のprops）
- 修正方針: parser算出済みの `Part.hand` をPianoKeyboardまで伝搬して判定（分析レポート承認待ち方針TASK-041）
- 色検証テストを追加すること

### 不明/要確認の情報

- なし（すべて確認済み）
