# TASK-063: 一拍目アクセントのUIオプションと永続化

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-063 |
| タイプ | feature |
| ステータス | TODO |
| 優先度 | High |
| 見積もり | 40分 |
| 依存タスク | TASK-062 |

## 背景

TASK-062 で実装したメトロノーム一拍目アクセントを、ユーザーが操作できるUIオプションとして
公開し、設定を永続化する（REQ-006-008）。配置はツールバーのメトロノームチェックボックス横、
既定値は有効（ON）。永続化は既存の `practice.metronomeEnabled` と同一パターンで行う。

（分析レポート: `docs/sdd/troubleshooting/2026-07-07-metronome-no-sound/analysis.md`）

## 実装内容

### 修正対象

- ファイル: `src/renderer/src/store/slices/ui-slice.ts`
  - `metronomeAccentEnabled: boolean`（初期値 `true`）と
    `setMetronomeAccentEnabled: (enabled: boolean) => void` を追加
    （`metronomeEnabled` と同一パターン）。
- ファイル: `src/renderer/src/hooks/usePractice.ts`
  - store の `metronomeAccentEnabled` を購読し、変更時に
    `audioEngine.setMetronomeAccentEnabled(enabled)` を呼ぶ同期エフェクトを追加
    （既存の `metronomeEnabled` 同期エフェクト（:131-139 付近）と同一パターン）。
- ファイル: `src/renderer/src/components/Toolbar/TempoControl.tsx`
  - メトロノームチェックボックスの隣に「1拍目強調」チェックボックスを追加。
    `metronomeAccentEnabled` / `setMetronomeAccentEnabled` に結線する。
    メトロノームOFF時も操作可能のままでよい（無効化しない。メトロノームON時に効く）。
- ファイル: `src/renderer/src/types/settings.ts`
  - `AppSettings.practice` に `metronomeAccentEnabled: boolean` を追加。
- ファイル: `src/main/settings.ts`
  - electron-store の既定値 `practice` に `metronomeAccentEnabled: true` を追加。
- ファイル: `src/renderer/src/components/SettingsModal/index.tsx`
  - ローカルの `DEFAULT` 定数の `practice` に `metronomeAccentEnabled: true` を追加。
  - 「既定で1拍目を強調する」チェックボックスを追加し、変更時は
    `usePracticeStore.getState().setMetronomeAccentEnabled(value)` へ即時反映する
    （`metronomeEnabled` の既存パターン踏襲。`handlePracticeChange` の分岐に追加）。
- ファイル: `src/renderer/src/App.tsx`
  - 起動時反映エフェクト（:171-223）で
    `if (typeof practiceSettings.metronomeAccentEnabled === 'boolean')` ガード付きで
    `setMetronomeAccentEnabled(...)` を呼ぶ。ガードは既存ストアファイルにキーが
    存在しない場合の後方互換のため必須（未定義なら store 初期値 `true` を維持）。
- ファイル: テスト（`ui-slice` を検証している store テスト、`TempoControl.test.tsx`、
  `usePractice.test.ts`、`SettingsModal.test.tsx` の該当スイート）
  - 下記テスト項目を追加。

### 実装手順

TDDで進める。

1. 失敗するテストを先に書く:
   - (a) store: `metronomeAccentEnabled` の初期値が `true`、setter で更新できる。
   - (b) TempoControl: 「1拍目強調」チェックボックスが表示され、操作で
     `setMetronomeAccentEnabled` が呼ばれる。チェック状態が store を反映する。
   - (c) usePractice（結線）: `metronomeAccentEnabled` の変更で
     `audioEngine.setMetronomeAccentEnabled` が呼ばれる。
   - (d) SettingsModal: 既定値チェックボックスの変更で settings 保存と store 即時反映が行われる。
   - (e) App 起動時反映: 永続化値 `false` が store へ反映される。キー欠落時は `true` のまま。
2. Red を確認してコミットする。
3. store → hook → UI → 永続化の順に実装し、Green を確認する。
4. `docs/sdd/requirements/traceability.md` の REQ-006-008 行を「UI結線まで検証済み」に更新する。
5. `docs/sdd/tasks/index.md` の Phase 14 ステータスを更新する。

### 注意事項

- チェックボックスラベルは日本語「1拍目強調」とする（Toolbar の既存ラベル群と統一）。
  ラベルの視認性は TASK-054 で是正済みのCSSパターンに従うこと。
- ツールバーのチェック操作は store のみを更新する（electron-store への書き戻しは行わない）。
  永続化されるのは SettingsModal の既定値設定である。これは `metronomeEnabled` の
  既存挙動と同一であり、変更しないこと。
- E2E（`tests/e2e/`）への追加は必須としないが、既存E2Eが全件通ることを確認する
  （音声出力自体はE2Eで検証不能なため、ユニット＋結線テストで担保する方針。
  再発防止原則の「モック境界の結線テスト」は (c) で満たす）。

## 受入基準

- [ ] ツールバーのメトロノームチェックボックス横に「1拍目強調」チェックボックスが表示される
- [ ] 既定でONになっている
- [ ] チェック操作が AudioEngine まで結線されている（usePractice の同期エフェクト）
- [ ] SettingsModal で既定値を変更でき、electron-store に永続化される
- [ ] 起動時に永続化値が store へ反映される（キー欠落時は `true`）
- [ ] `docs/sdd/requirements/traceability.md` の REQ-006-008 行が更新されている
- [ ] `npm run test` / `npm run typecheck` / `npm run lint` が全てパスする

## テスト項目

- [ ] （新規・ユニット）store 初期値 `true`・setter 動作
- [ ] （新規・UI）TempoControl のチェックボックス表示・操作・store 反映
- [ ] （新規・結線）store 変更 → `audioEngine.setMetronomeAccentEnabled` 呼び出し
- [ ] （新規・UI）SettingsModal の既定値変更 → 保存＋store 即時反映
- [ ] （新規・結線）App 起動時反映（永続化値 `false` の反映、キー欠落時のフォールバック）
- [ ] （回帰）`npm run test` 全件グリーン、既存E2Eが通る

## 情報の明確性

### 明示された情報

- UI配置・既定値ON・永続化（AskUserQuestionで承認済み 2026-07-07）
- 永続化パターン（`metronomeEnabled` と同一、実コードで確認済み）

### 不明/要確認の情報

- なし（すべて確認済み）
