# TASK-095: Phase 18統合検証・ドキュメント同期

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-095 |
| タイプ | chore |
| ステータス | TODO |
| 優先度 | Medium |
| 見積もり | 30分 |
| 依存タスク | TASK-091, TASK-092, TASK-093, TASK-094 |

## 背景

Phase 18（サプライチェーン・入力堅牢性強化）の4タスク完了後に、全体の統合検証とドキュメント同期を行う（Phase 15のTASK-077・Phase 17のTASK-090と同じ運用）。

## 実装内容

### 検証項目

1. `npm run test` / `npm run typecheck` / `npm run lint` / `npm run lint:jp` の全件通過
2. `npm run test:e2e` の全件通過（本番ビルドでの実起動）
3. `npm run build` の成功（electronパッチ更新後の起動回帰）
4. `npm audit` に新規脆弱性がないこと
5. 悪意入力に対する拒否がユーザーに分かるエラーとして表示される経路の確認（E2Eでカバーできない範囲は残件化）

### ドキュメント同期対象

- ファイル: `CLAUDE.md`
  - 「MusicXML → Score変換」節: パースのサイズ上限・DOCTYPE拒否・zip展開上限の追記
  - 「データ永続化」節: アノテーションJSONの検証（フェイルソフト）の追記
  - CI/リリース節（あれば）: リリース成果物のSHA256・attestation、dependabot導入の追記
- ファイル: `README`
  - 成果物の完全性検証手順（`gh attestation verify` / SHA256照合）の記載（TASK-093で追記済みなら整合確認）
- ファイル: `docs/sdd/requirements/traceability.md` — Phase 18の検証状況を追記
- ファイル: `docs/sdd/tasks/index.md` — Phase 18各タスクのステータス更新

## 実装手順

1. TASK-091〜094の完了を確認する
2. 検証項目1〜5を順に実施し、結果を本ファイルの完了サマリーに記録する
3. ドキュメント同期対象を更新する
4. コミットする

## 受入基準

- [ ] 検証項目1〜5がすべて実施され、結果が完了サマリーに記録されている
- [ ] CLAUDE.mdのパース・永続化・CI関連記述が実装と一致している
- [ ] `docs/sdd/requirements/traceability.md` が更新されている
- [ ] `docs/sdd/tasks/index.md` のPhase 18ステータスが実態と一致している

## テスト項目

- [ ] 統合状態での全自動テスト通過（unit / typecheck / lint / lint:jp / e2e / build）
- [ ] `npm audit` 新規脆弱性なし

## 情報の明確性

### 明示された情報

- 検証・同期の対象範囲（Phase 18の4タスクの変更内容）
- Phase 17のTASK-090と同じ統合検証運用

### 不明/要確認の情報

- 特になし（先行タスクの完了サマリーを入力とする）
