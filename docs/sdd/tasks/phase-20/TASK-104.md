# TASK-104: Phase 20統合検証・ライブラリE2E・ドキュメント同期

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-104 |
| タイプ | chore（統合検証・ドキュメント） |
| ステータス | TODO |
| 優先度 | High |
| 見積もり | 60分 |
| 依存タスク | TASK-101〜103 |

## 背景

Phase 20（楽譜ライブラリ）の統合検証・E2E・ドキュメント同期。
Phase 19のTASK-100と同じ位置づけ。E2Eの隔離userData方式（tests/e2e/e2e-user-data.ts）を
再利用する。

## 実装内容

### E2E（Playwright for Electron）

- ライブラリの一連操作E2Eを追加する（ユーザー観測可能な結果を合格条件、getByRole使用、
  ifガード内アサーション禁止）:
  1. 起動→ライブラリ画面（空状態）が表示される
  2. 楽譜を開く（既存のダイアログモック方式）→楽譜画面へ遷移
  3. ヘッダーのライブラリボタン→一覧に開いた楽譜が登録されている
  4. 行クリックで再び楽譜が開ける
  5. 削除→確認→一覧から消える
- 既存E2E（起動時の表示前提が変わるもの）があれば、ライブラリ初期表示に合わせて
  更新する（テストの意味を変えない範囲で導線を追加）

### 統合検証

- `npm run test` / `npm run typecheck` / `npm run lint` / `npm run lint:jp` /
  `npm run format:check` / `npm run build` / `npm run test:e2e` の全通過

### ドキュメント同期

- `docs/sdd/requirements/traceability.md`: REQ-017-001〜011の検証状況を追記
- `CLAUDE.md`: ソースコード構成（library.ts・library-handlers.ts・LibraryView）、
  IPCチャンネル一覧（library:*4本）、データ永続化（libraryストア）を追記
- `docs/sdd/tasks/index.md`: Phase 20タスクのステータス更新

### 実機確認できない項目の扱い

`npm run dev`での目視確認が必要な項目は完了サマリーへ「ユーザー実機確認待ち」として
明記し、本タスクのステータスはREVIEWとする（TASK-100と同運用）。

## 受入基準

- [ ] ライブラリ一連操作のE2Eが実UI操作で通過する
- [ ] 既存E2Eの回帰なし
- [ ] ローカル全ゲート通過
- [ ] traceability.md・CLAUDE.md・tasks/index.mdが同期されている

## テスト項目

- [ ] E2E: 空状態→開く→登録確認→ライブラリから開く→削除の一連操作
- [ ] E2E: 既存スイートの回帰なし
