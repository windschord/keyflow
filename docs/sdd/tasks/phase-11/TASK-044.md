# TASK-044: US-008 運指メモ手動編集UIの実装

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-044 |
| タイプ | feature |
| ステータス | TODO |
| 優先度 | Medium |
| 見積もり | 90分 |
| 依存タスク | TASK-041 |

## 背景

### 問題の概要

US-008（運指メモ）のユーザー向けUIが皆無。楽譜上の音符を右クリックしても何も起きず（`contextmenu` ハンドラ0件）、運指番号の手動入力・削除・コメント編集ができない。AI提案運指の「承認」操作（REQ-009-005）のUIも存在しない。annotation-store（CRUD・永続化）はユニットテスト済みで緑だが、ユーザーから到達する経路がなく、偽の安心感を与えている。

（分析レポート: `docs/sdd/troubleshooting/2026-07-05-test-escape/analysis.md` H4）

### 根本原因

- Phase 2でannotation-storeのデータ層（`src/renderer/src/lib/annotation-store/index.ts`: `setFinger`:53、`setComment`:60、`removeFinger`:67、`getAnnotation`:78、`approveAnnotation`:101）を実装した後、UI層のタスクが起票されないまま完了扱いになった（分析レポート要因5と同型のプロセス欠落）。
- 承認済み運指の色分け表示は `osmd-controller.ts:454` に実装済み（`isApproved ? '#2563eb' : '#93c5fd'`）だが、`ScoreRenderer/index.tsx:73` が常に `isApproved: false` を渡すため死に分岐になっている。

### 関連する仕様

- REQ-008-001: ユーザーが音符を右クリックした時、システムは運指番号（1〜5）を入力できるメニューまたはポップアップを表示しなければならない
- REQ-008-003: ユーザーが小節や音符にテキストコメントを追加できるよう、システムはノートコメント機能を提供しなければならない
- REQ-008-006: ユーザーが運指番号を削除したい時、システムは右クリックメニューから削除できなければならない
- REQ-009-005: ユーザーが提案された運指を「承認」した時、システムはその運指をアノテーションとして保存しなければならない
- REQ-009-006（個別上書き）、REQ-008-004（JSONサイドカー保存。実装済み）
- `docs/sdd/requirements/traceability.md` REQ-008-001/003/006、REQ-009-005/006の各行（TASK-044参照が記載済み）

## 実装内容

### 修正対象

- ファイル: `src/renderer/src/components/ScoreRenderer/osmd-controller.ts`
  - 変更内容: `contextmenu` イベントを処理し、クリック座標から最も近い音符を解決してコールバックに渡す `setOnNoteContextMenu` を追加する。座標→noteId解決は既存の `findNearestNoteId`（:382、クリック処理:351で使用中）を流用する。
- ファイル: `src/renderer/src/components/ScoreRenderer/index.tsx`
  - 変更内容: (1) contextmenuコールバックのprops追加と結線。(2) `:73` の `isApproved: false` 固定をやめ、App.tsxから渡される実アノテーション（`Annotation.isApproved` 相当）に基づいて渡す（死に分岐 `osmd-controller.ts:454` の結線）。
- ファイル: `src/renderer/src/components/ScoreRenderer/` 配下（新規コンポーネント。例: `NoteContextMenu.tsx`）
  - 変更内容: 指番号1〜5の入力、運指削除、コメント編集、（AI提案がある音符では）承認ができるコンテキストメニューUI。
- ファイル: `src/renderer/src/App.tsx`
  - 変更内容: コンテキストメニュー操作→annotation-store（`annotationStore.current`、:25）のCRUD呼び出し→`save()`→`keyboardAnnotations` / `fingeringAnnotations` の更新、という一連の結線。承認操作は `approveAnnotation` を呼ぶ。
- ファイル: 各テスト（`osmd-controller.test.ts`、`ScoreRenderer.test.tsx`、新規メニューコンポーネントのテスト、`App` 統合テスト）

### 実装手順

TDDで進める。

1. 失敗するテストを先に書く: (a) osmd-controllerのcontextmenuでnoteIdが解決されコールバックされる、(b) メニューで「3」を選ぶと `setFinger(noteId, 3)` が呼ばれ保存される、(c) 「削除」で `removeFinger`、(d) コメント編集で `setComment`、(e) AI提案のある音符で「承認」すると `approveAnnotation` が呼ばれる、(f) 承認済みアノテーションが `isApproved: true` で `showFingerings` に渡る。
2. テストを実行し、失敗（red）を確認してコミットする。
3. osmd-controllerに `setOnNoteContextMenu` を実装する（既存 `setOnMeasureClick` のパターンを踏襲）。
4. コンテキストメニューコンポーネントを実装する（表示位置はクリック座標、Escや外側クリックで閉じる）。
5. App.tsxでannotation-store CRUDと結線し、変更後に `save()` と表示状態（鍵盤・楽譜の指番号）の更新を行う。
6. `ScoreRenderer/index.tsx:73` の `isApproved` を実データ由来に修正し、承認済みが濃い青（`#2563eb`）で描画されることを確認する。
7. テストが通る（green）ことを確認し、traceability.mdの REQ-008-001/003/006、REQ-009-005/006 行を更新する。

### 注意事項

- annotation-storeの既存API（`setFinger` / `setComment` / `removeFinger` / `approveAnnotation` / `save`）をそのまま使い、データ層は変更しない。
- noteIdフォーマットは `{partId}-M{measureNumber}-N{noteIndex}`（CLAUDE.md記載）。osmd-controllerの `noteIdToSvgCoord` / `findNearestNoteId` が既にこの形式で動作している。
- 変更のたびに `save()` を呼び、JSONサイドカーへ即時永続化する（REQ-008-004準拠。App.tsxの `handleFingering`:173-187 と同じエラーハンドリング＝失敗時alert）。
- 鍵盤上の指番号表示（`keyboardAnnotations`）と楽譜上の指番号表示（`fingeringAnnotations`）の両方を更新すること。片方だけ更新されて表示が食い違う状態を作らない。
- ブラウザ標準のコンテキストメニューは `preventDefault` で抑止する。楽譜以外の領域では既定動作を妨げない。
- 依存タスクTASK-041（PianoKeyboardへの手情報伝搬）と同じファイル（App.tsx、PianoKeyboard props）に触れるため、TASK-041完了後に着手する。

## 受入基準

- [ ] 楽譜上の音符を右クリックするとコンテキストメニューが開き、指番号1〜5を選択して保存できる（REQ-008-001）
- [ ] 右クリックメニューから既存の運指番号を削除できる（REQ-008-006）
- [ ] 右クリックメニューから音符へのテキストコメントを追加・編集できる（REQ-008-003）
- [ ] AI提案運指を承認でき、承認結果がアノテーションとして保存される（REQ-009-005）
- [ ] 承認済み運指が楽譜上で濃い青（未承認の提案は淡い青）で表示される（`osmd-controller.ts:454` の分岐が実データで到達可能）
- [ ] 編集結果がJSONサイドカーに永続化され、ファイルを開き直すと復元される
- [ ] 手動編集した指番号が鍵盤上の指番号表示（REQ-005-007）にも反映される
- [ ] `docs/sdd/requirements/traceability.md` の該当行が更新されている
- [ ] 既存のテストが通る
- [ ] 新規テストが追加されている（必要な場合）

## テスト項目

- [ ] （新規・ユニット）osmd-controller: contextmenu座標→noteId解決→コールバック
- [ ] （新規・コンポーネント）メニューUI: 指番号選択・削除・コメント編集・承認の各操作がコールバックを発火する
- [ ] （新規・統合）右クリック→指番号入力→annotation-store反映→`save()` 呼び出し→鍵盤・楽譜表示更新
- [ ] （新規・統合）承認操作→`approveAnnotation`→`showFingerings` に `isApproved: true` が渡り色分けされる
- [ ] （新規・回帰）AI提案適用（`applyAISuggestions`）と手動編集が共存する（手動値が上書きされない: REQ-009-006）
- [ ] （回帰）`npm run test` 全件グリーン、`npm run typecheck` / `npm run lint` パス

## 情報の明確性

### 明示された情報

- UI欠落の根拠（H4、実コードで検証済み: contextmenuハンドラ0件、annotation-store API :53/:60/:67/:101、死に分岐 `osmd-controller.ts:454` と `ScoreRenderer/index.tsx:73` の `isApproved: false` 固定）
- 流用する既存実装: `findNearestNoteId`（`osmd-controller.ts:382`）、annotation-store既存API、`setOnMeasureClick` のコールバックパターン
- AI提案の承認フローと承認済み色分けの結線も本タスクに含めること

### 不明/要確認の情報

- なし（すべて確認済み。メニューの見た目・配置の詳細は既存UIのスタイル（SettingsModal等のインラインスタイル基調）に合わせて実装時に決定する）
