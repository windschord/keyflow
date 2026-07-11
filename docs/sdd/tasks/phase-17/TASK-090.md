# TASK-090: Phase 17統合検証・ドキュメント同期

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-090 |
| タイプ | chore |
| ステータス | TODO |
| 優先度 | Medium |
| 見積もり | 30分 |
| 依存タスク | TASK-086, TASK-087, TASK-088, TASK-089 |

## 背景

Phase 17（セキュリティ強化）の4タスク完了後に、全体の統合検証とドキュメント同期を行う。個別タスクのテスト通過だけでなく、全変更を統合した状態での実起動E2E・手動確認と、CLAUDE.mdおよびトレーサビリティの更新を完了条件とする（Phase 15のTASK-077と同じ運用）。

## 実装内容

### 検証項目

1. `npm run test` / `npm run typecheck` / `npm run lint` の全件通過
2. `npm run test:e2e` の全件通過（本番ビルドでの実起動検証）
3. `npm run dev` での手動スモーク: ファイルオープン（ダイアログ・ドロップ・最近使ったファイル）、再生、アノテーション保存、設定変更
4. 本番ビルド（環境変数なし）で `window.__e2eStore__` が undefined であることの確認
5. `npm audit` 0件の確認

### ドキュメント同期対象

- ファイル: `CLAUDE.md`
  - 「Electronセキュリティ設定」節: 読み取りallowlist・ナビゲーション制御・E2E計装フラグ（`KEYFLOW_E2E`）の追記、sandbox採否の反映
  - 「IPCチャンネル一覧」: `file:read` 系の説明にallowlist検証を追記（TASK-086でチャンネル名変更があれば反映）
  - 「実起動E2Eテスト」節: `KEYFLOW_E2E=1` フラグの記載
- ファイル: `docs/sdd/requirements/traceability.md` — 本フェーズの検証状況を追記
- ファイル: `docs/sdd/tasks/index.md` — Phase 17各タスクのステータス更新

## 実装手順

1. TASK-086〜089の完了を確認する
2. 検証項目1〜5を順に実施し、結果を本ファイルの完了サマリーに記録する
3. ドキュメント同期対象を更新する
4. コミット

## 受入基準

- [ ] 検証項目1〜5がすべて通過し、結果が完了サマリーに記録されている
- [ ] CLAUDE.mdのセキュリティ・IPC・E2E関連記述が実装と一致している
- [ ] `docs/sdd/requirements/traceability.md` が更新されている
- [ ] `docs/sdd/tasks/index.md` のPhase 17ステータスが実態と一致している

## テスト項目

- [ ] 統合状態での全自動テスト通過（unit / typecheck / lint / e2e）
- [ ] 手動スモーク4項目の通過

## 情報の明確性

### 明示された情報

- 検証・同期の対象範囲（Phase 17の4タスクの変更内容）
- Phase 15のTASK-077と同じ統合検証運用

### 不明/要確認の情報

- 特になし（先行タスクの完了サマリーを入力とする）
