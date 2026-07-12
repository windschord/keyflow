# TASK-090: Phase 17統合検証・ドキュメント同期

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-090 |
| タイプ | chore |
| ステータス | DONE |
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

- [x] 検証項目1〜5がすべて通過し、結果が完了サマリーに記録されている（項目3の手動スモークのみ、E2Eでのカバー範囲と非カバー範囲を明記のうえ残件化。下記「残件」参照）
- [x] CLAUDE.mdのセキュリティ・IPC・E2E関連記述が実装と一致している
- [x] `docs/sdd/requirements/traceability.md` が更新されている
- [x] `docs/sdd/tasks/index.md` のPhase 17ステータスが実態と一致している

## テスト項目

- [x] 統合状態での全自動テスト通過（unit / typecheck / lint / e2e）
- [x] 手動スモーク4項目のうちE2Eでカバーされる範囲を確認（詳細は完了サマリー参照。ドロップUI操作の実シミュレート・アノテーション保存・設定の実変更保存はエージェント実行環境では検証不能なため残件）

## 情報の明確性

### 明示された情報

- 検証・同期の対象範囲（Phase 17の4タスクの変更内容）
- Phase 15のTASK-077と同じ統合検証運用

### 不明/要確認の情報

- 特になし（先行タスクの完了サマリーを入力とする）

## 完了サマリー（2026-07-11）

### 統合検証結果

| 項目 | 結果 |
|---|---|
| `npm run test` | 777件全通過（55ファイル） |
| `npm run typecheck` | エラーなし |
| `npm run lint` | エラーなし |
| `npm run test:e2e` | 5件全通過（`app.spec.ts` 4件 + `e2e-instrumentation-guard.spec.ts` 1件）。本番ビルド（`npm run build`）を起動しての実行。終了後に残留Electronプロセスがないことを`ps aux`で確認済み |
| `npm audit` | 0 vulnerabilities |
| 本番ビルドでの`window.__e2eStore__`確認 | `e2e-instrumentation-guard.spec.ts`が環境変数なし起動（本番ビルド相当）で`window.__e2eStore__`/`window.__e2eMidiHooks__`がともに`undefined`であることを自動検証済み（TASK-088で追加）。手動でのDevToolsコンソール確認は行っていないが、自動テストが同等の検証を担保している |

### 手動スモーク4項目の検証範囲（`npm run dev`での対話的操作はエージェント実行環境では実施不可のため、既存E2Eでのカバー状況を確認）

- **ファイルオープン（ダイアログ経由）**: `tests/e2e/app.spec.ts`のメインシナリオでカバー（`file:show-open-dialog`をモックしサンプルMusicXMLを開き楽譜表示まで確認）
- **ファイルオープン（ドロップ経由）**: 同シナリオ内で本物の`file:register-dropped-file` IPCを直接呼び出し、allowlist登録経路を検証している。ただし実際のDOMドラッグ&ドロップイベント（`dragover`/`drop`）自体のシミュレートは行っていない
- **ファイルオープン（最近使ったファイル）**: TASK-086の事前調査で判明済みのとおり、SettingsModalの「最近使ったファイル」一覧はクリックして開く導線自体が実装に存在しないため、検証対象外
- **再生**: メインシナリオでカバー（実際に再生しMIDIモック注入で正誤判定・カーソル進行を確認）
- **アノテーション保存**: 既存E2Eスイートに`file:write`を経由するシナリオはなく、未カバー
- **設定変更**: `設定モーダル→音色セクションの表示`シナリオは表示確認のみで、音色選択の変更・`settings:set`への保存操作はカバーしていない

### ドキュメント同期

- `CLAUDE.md`: 実ファイルを確認のうえ以下の各節を更新した。
  - 「Electronセキュリティ設定」節: sandbox: true採用・読み取りallowlist・navigation-policy
  - 「IPCチャンネル一覧」: `file:read-if-exists` / `file:register-dropped-file` 追加、allowlist検証の明記
  - 「実起動E2Eテスト」節: KEYFLOW_E2Eフラグ伝搬経路・e2e-instrumentation-guard.spec.tsの記載
  - ソースコード構成: `src/main/file-handlers.ts` / `src/main/navigation-policy.ts` の追加
- `docs/sdd/requirements/traceability.md`: Phase 17は新規REQを追加していないため、既存表への行追加ではなく
  「Phase 17: セキュリティ強化（2026-07-11）の検証状況」節を新設しTASK-086〜090の検証状況を記録
- `docs/sdd/tasks/index.md`: 進捗サマリのPhase 17行を「4/0/1/0」→「5/0/0/0」へ更新、TASK-090行をDONEへ更新

### 残件（ユーザーの実機確認が必要な事項）

- ドラッグ&ドロップの実UI操作（実際のファイルをウィンドウへドロップする操作）
- アノテーション（運指メモ・コメント）を右クリックで保存し、`.annotation.json`が実際に書き込まれる一連の操作
- 設定モーダルで音色を実際に変更し、再起動後も選択が復元されることの確認（`REQ-013-006`はユニット・結線レベルの検証にとどまっており、`traceability.md`にも既存の記載として残っている）
- 本番ビルドの実バイナリをDevToolsで開き`window.__e2eStore__`が`undefined`であることを目視確認する手動チェック（自動テストでは同等の検証を`e2e-instrumentation-guard.spec.ts`が担保済みだが、手動確認そのものは未実施）
