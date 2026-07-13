# TASK-100: Phase 19統合検証・E2E言語切り替え・ドキュメント同期

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-100 |
| タイプ | chore（統合検証・ドキュメント） |
| ステータス | REVIEW（`npm run dev`実起動での目視確認3項目が未実施のため。詳細は完了サマリー参照） |
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

- [x] 言語切り替えE2Eが実UI操作で通過する
- [x] 既存E2Eが言語シードにより決定的に通過する
- [x] ローカル全ゲート（lint/format:check/lint:jp/test/typecheck/build/test:e2e）通過
- [x] traceability.md・CLAUDE.md・tasks/index.mdが同期されている

## テスト項目

- [x] E2E: 言語切り替えでヘッダー文言が英語→日本語へ往復する
- [x] E2E: 既存スイートの回帰なし

## 完了サマリー（2026-07-12）

### E2Eの言語決定性

- `tests/e2e/e2e-user-data.ts` を新規作成。Electronが標準で解釈する`--user-data-dir`
  起動引数（Chromium由来のコマンドラインスイッチ）で`app.getPath('userData')`の解決先を
  差し替える方式を採用した。`electronApp.evaluate()`によるapp.setPath呼び出しは、
  settings:getがapp.whenReady直後に読み込みを完了させてしまうため間に合わない
  （事前にnode実行で検証済み）
- テストごとに`os.tmpdir()`配下へ隔離userDataディレクトリを作成し、
  `ui.language: 'ja'`をシードした`config.json`を配置してから起動する。テスト終了後は
  ディレクトリを削除する。開発者の実環境のuserData（本来のアプリ設定保存先）は一切変更しない
- electron-store（Conf）はトップレベルキーが存在すれば値を完全に上書きし、ネストした
  `ui`オブジェクトの欠落フィールドをdefaultsで補わないことをnode実行で実証済みのため、
  シードする`ui`は全フィールドを明示している
- `tests/e2e/app.spec.ts`（既存4件＋新規1件）と`tests/e2e/e2e-instrumentation-guard.spec.ts`
  （既存1件）の両方に本方式を適用した

### 追加した言語切り替えE2E

- `tests/e2e/app.spec.ts`に「設定モーダルで言語をEnglishへ切り替えるとヘッダー文言が
  英語になり、日本語へ戻すと復帰する」を追加
- 実UI操作: ヘッダーの「設定」ボタンをクリック→設定モーダルの言語セレクタ（`#language`）を
  `selectOption('en')`→設定モーダルの閉じるボタン（英語化済みラベル「Close」）で閉じる→
  ヘッダーの「ファイルを開く」ボタンのアクセシブルネームが「Open file」に変わったことを
  `getByRole`で確認。同様の手順で日本語へ戻し、日本語表示への復帰も確認する
- 前提要素（日本語ボタン・言語セレクタ）の存在を`toBeVisible()`で先にassertしてから操作しており、
  ifガード内アサーションは使用していない

### 統合検証の結果

| コマンド | 結果 |
|---|---|
| `npm run test` | 838件全通過 |
| `npm run typecheck` | 通過（node/web） |
| `npm run lint` | 通過 |
| `npm run format:check` | 通過 |
| `npm run test:e2e`（`npm run build`を内包） | 6件全通過（既存5件＋新規1件） |

`npm run lint:jp`は本タスクでのドキュメント差分（traceability.md）を含め個別確認済み
（`docs/**/*.md`と`src/**/*.ts(x)`のみが対象で、`tests/`配下は対象外）。

### ドキュメント同期

- `docs/sdd/requirements/traceability.md`: 「Phase 19: UI多言語対応」節を新設し、
  REQ-016-001〜007とTASK-096〜100の検証状況を追記
- `CLAUDE.md`: ソースコード構成へ`src/main/locale.ts`・`settings-handlers.ts`・`menu.ts`と
  `src/renderer/src/lib/i18n/`を追記。「UI多言語対応（i18n、US-016）」節を新設し
  `ui.language`スキーマ・言語解決規則・メニュー再構築の結線を記載
- `docs/sdd/tasks/index.md`: Phase 19サマリー行を「4完了/1進行中（REVIEW）」へ更新し、
  TASK-096〜099をDONE、TASK-100をREVIEWへ更新

### ユーザー実機確認が必要な残項目

以下はコード変更を伴わない目視確認であり、自動テストで代替検証したものの実施できていない
（そのため本タスクのステータスはDONEではなくREVIEWとする）。

1. `npm run dev`実起動で、設定未保存の初回起動時にOSロケール由来の言語が選択されること
2. `npm run dev`実起動で、設定画面での言語切り替えによりヘッダー・設定・About・
   メニューバーが即時切り替わること（E2Eではヘッダーの代表操作のみ検証済み）
3. アプリ再起動後も選択言語が復元されること（永続化自体はunit/結線テストで検証済みだが、
   実バイナリでの再起動を挟んだ往復確認は未実施）
