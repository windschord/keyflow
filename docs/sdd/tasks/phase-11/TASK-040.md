# TASK-040: [BugFix] エラーモード設定の結線

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-040 |
| タイプ | bugfix |
| ステータス | TODO |
| 優先度 | High |
| 見積もり | 30分 |
| 依存タスク | なし |

## 背景

### 問題の概要

SettingsModalの「Default Error Mode」（wait / pass）を変更しても、練習の挙動が一切変わらない。practice-engineの「エラーを無視して進む（pass）」分岐は本番で到達不能であり、設定UIが完全に形だけになっている。

（分析レポート: `docs/sdd/troubleshooting/2026-07-05-test-escape/analysis.md` H2）

### 根本原因

- Zustandの `practice-slice.ts` には `errorMode` フィールド（`src/renderer/src/store/slices/practice-slice.ts:6`、初期値 `'wait'` 同 :31）はあるが、**setterアクションが存在しない**（`setPracticeMode` / `setLoopRange` / `toggleLoop` のみ）。
- SettingsModalの `updatePracticeSetting`（`src/renderer/src/components/SettingsModal/index.tsx:79-113`）は `defaultErrorMode` をelectron-storeに保存するだけで、storeの `errorMode` へ反映するコードがない。同関数内の `metronomeEnabled` には即時反映コード（同 :94-96、ロールバック :107-109）があり、非対称。
- App起動時の設定ロード（`src/renderer/src/App.tsx:96-116`）は `practice.metronomeEnabled` のみを反映し、`practice.defaultErrorMode` を読まない。
- その結果、practice-engineの `if (errorMode === 'pass')` 分岐（`src/renderer/src/lib/practice-engine/index.ts:99`）はユニットテストでのみ到達し、本番では永遠に `'wait'` のまま。

### 関連する仕様

- REQ-004-006: もし「エラーを無視して進む」モードが有効ならば、システムは誤りがあっても次の音符に自動進行しなければならない
- `docs/sdd/requirements/traceability.md` REQ-004-006行: 「△※ passモードロジックは○だが、設定UI→storeの結線が存在しない（TASK-040）」

## 実装内容

### 修正対象

- ファイル: `src/renderer/src/store/slices/practice-slice.ts`
  - 変更内容: `setErrorMode: (mode: ErrorMode) => void` アクションを追加する。
- ファイル: `src/renderer/src/components/SettingsModal/index.tsx`
  - 変更内容: `updatePracticeSetting` で `key === 'defaultErrorMode'` の場合に `usePracticeStore.getState().setErrorMode(value)` を即時反映する（`metronomeEnabled` の既存パターン :94-96 と同じ構造。保存失敗時のロールバック :107-109 も同様に実装）。
- ファイル: `src/renderer/src/App.tsx`
  - 変更内容: 起動時の設定ロードeffect（:96-116）で `practice.defaultErrorMode` も読み取り、`setErrorMode` でstoreへ反映する。
- ファイル: `src/renderer/src/store/slices/practice-slice.test.ts`、`src/renderer/src/components/SettingsModal/SettingsModal.test.tsx`
  - 変更内容: setterの動作、SettingsModal変更→store反映、起動時ロード→store反映のテストを追加する。

### 実装手順

TDDで進める。

1. 失敗するテストを先に書く: (a) `setErrorMode('pass')` でstoreの `errorMode` が変わる、(b) SettingsModalで「Default Error Mode」を変更するとstoreの `errorMode` が即時に変わる、(c) electron-storeに `defaultErrorMode: 'pass'` が保存された状態でApp起動相当の初期化を行うとstoreの `errorMode` が `'pass'` になる。
2. テストを実行し、失敗（red）を確認してコミットする。
3. `practice-slice.ts` に `setErrorMode` を追加する。
4. `SettingsModal/index.tsx` の `updatePracticeSetting` に即時反映＋ロールバックを追加する。
5. `App.tsx` の起動時ロードeffectを拡張する。
6. テストが通る（green）ことを確認し、practice-engineの `'pass'` 分岐が本番経路（UI→store→engine）で到達可能になったことを結線テストで確認する。
7. `docs/sdd/requirements/traceability.md` の REQ-004-006 行を更新する。

### 注意事項

- `metronomeEnabled` の既存実装（即時反映＋保存失敗時のロールバック）と同じパターンに揃えること。片方だけロールバックしない等の非対称を作らない。
- 起動時ロードは既存effect（`App.tsx:96-116`）を拡張する形でよい（`settings.get('practice')` の戻り値に両方含まれるため、IPC呼び出しを増やさない）。
- `ErrorMode` 型は `src/renderer/src/types` の既存定義を使用し、新しい型を定義しない。
- practice-engine本体（`src/renderer/src/lib/practice-engine/index.ts`）のロジックは変更しない（結線のみのタスク）。

## 受入基準

- [ ] SettingsModalで「Pass through on error」を選ぶと、直後からstoreの `errorMode` が `'pass'` になる（再起動不要）
- [ ] electron-storeに保存された `practice.defaultErrorMode` がアプリ起動時にstoreへロードされる
- [ ] 保存失敗時はstoreの `errorMode` も元に戻る（metronomeEnabledと同じロールバック挙動）
- [ ] practice-engineの `'pass'` 分岐（誤りがあっても次へ自動進行）が本番経路で到達可能であることがテストで検証されている
- [ ] `docs/sdd/requirements/traceability.md` の REQ-004-006 行が更新されている
- [ ] 既存のテストが通る
- [ ] 新規テストが追加されている（必要な場合）

## テスト項目

- [ ] （新規・ユニット）`setErrorMode` でstoreの `errorMode` が更新される
- [ ] （新規・結線）SettingsModalのselect変更→storeの `errorMode` 即時反映
- [ ] （新規・結線）保存失敗時のロールバックでstoreの `errorMode` も戻る
- [ ] （新規・結線）起動時ロードで `defaultErrorMode` がstoreへ反映される
- [ ] （新規・統合）`errorMode: 'pass'` の状態で誤入力するとpractice-engineが次の音符へ自動進行する（UI→store→engineの経路）
- [ ] （回帰）`npm run test` 全件グリーン、`npm run typecheck` / `npm run lint` パス

## 情報の明確性

### 明示された情報

- 根本原因のfile:line（H2、実コードで検証済み: `practice-slice.ts:6,31` setter欠落、`SettingsModal/index.tsx:79-113` 保存のみ、`App.tsx:96-116` ロード対象外、`practice-engine/index.ts:99` 到達不能分岐）
- 修正方針: setterの追加＋SettingsModal即時反映（metronomeEnabledパターン踏襲）＋起動時ロード（分析レポート承認待ち方針TASK-040）

### 不明/要確認の情報

- なし（すべて確認済み）
