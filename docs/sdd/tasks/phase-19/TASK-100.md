# TASK-100: Phase 19統合検証・E2E言語切り替え・ドキュメント同期

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-100 |
| タイプ | chore（統合検証・ドキュメント） |
| ステータス | TODO |
| 優先度 | High |
| 見積もり | 60分 |
| 依存タスク | TASK-096〜099 |

## 背景

Phase 19（UI多言語対応）の統合検証と、E2E・ドキュメントの同期を行う。
Phase 17/18の統合検証タスク（TASK-090/095）と同じ位置づけ。

## 実装内容

### E2E（Playwright for Electron）

- 既存E2Eの言語前提を保証する: E2E起動時は設定未保存のためOSロケール解決となる。
  非日本語ロケール環境でも決定的になるよう、E2Eセットアップで `ui.language: 'ja'` を
  シードする（electron-storeの設定ファイルを一時ディレクトリへ用意する等。
  アプリ本体にテスト専用分岐を入れないこと）
- 言語切り替えE2Eを1本追加: 設定モーダルで言語をEnglishへ変更→ヘッダーの
  ボタン文言（アクセシブルネーム）が英語へ変わることを実UI操作で検証→日本語へ戻す。
  ユーザー観測可能な結果を合格条件とし、ifガード内アサーションを使わない

### 統合検証

- `npm run test` / `npm run typecheck` / `npm run lint` / `npm run lint:jp` /
  `npm run format:check` / `npm run build` / `npm run test:e2e` の全通過
- `npm run dev` 実起動で以下を目視確認（StrictMode有効の開発モード）:
  - 設定なしの初回起動でOSロケール由来の言語が選択される
  - 設定画面で言語切り替え→ヘッダー・設定・About・メニューバーが即時切り替わる
  - 再起動後も選択言語が復元される

### ドキュメント同期

- `docs/sdd/requirements/traceability.md`: REQ-016-001〜007の検証手段を記載
- `CLAUDE.md`: i18nコンポーネント（lib/i18n）・ui.language設定・メニュー多言語化の
  記載を追加
- `docs/sdd/tasks/index.md`: Phase 19タスクのステータスをDONEへ更新

## 受入基準

- [ ] 言語切り替えE2Eが実UI操作で通過する
- [ ] 既存E2Eが言語シードにより決定的に通過する
- [ ] ローカル全ゲート（lint/format:check/lint:jp/test/typecheck/build/test:e2e）通過
- [ ] traceability.md・CLAUDE.md・tasks/index.mdが同期されている

## テスト項目

- [ ] E2E: 言語切り替えでヘッダー文言が英語→日本語へ往復する
- [ ] E2E: 既存スイートの回帰なし
