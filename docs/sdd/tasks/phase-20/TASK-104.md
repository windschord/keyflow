# TASK-104: Phase 20統合検証・ライブラリE2E・ドキュメント同期

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-104 |
| タイプ | chore（統合検証・ドキュメント） |
| ステータス | REVIEW（`npm run dev`実起動での目視確認が未実施のため。詳細は完了サマリー参照） |
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

- [x] ライブラリ一連操作のE2Eが実UI操作で通過する
- [x] 既存E2Eの回帰なし
- [x] ローカル全ゲート通過
- [x] traceability.md・CLAUDE.md・tasks/index.mdが同期されている

## テスト項目

- [x] E2E: 空状態→開く→登録確認→ライブラリから開く→削除の一連操作
- [x] E2E: 既存スイートの回帰なし

## 完了サマリー（2026-07-12）

### 既存E2Eへの変更と理由

TASK-103でui-slice.activeViewの初期値が'library'になったことで、起動直後は
ScoreRendererではなくライブラリ画面（空状態）が表示されるようになった。これに
`tests/e2e/app.spec.ts`の2箇所が影響を受けたため、検証の意味を変えずに前提を
更新した。

- 起動直後のプレースホルダー可視性チェックを廃止した。`placeholder`は親コンテナが
  `display:none`のため不可視になった。代わりに新しい「楽譜未読み込み」の
  ユーザー観測可能な状態として、ライブラリ空状態表示（`getByRole('region', { name: 'ライブラリ' })`と空状態文言）を確認する形へ置き換えた
- ヘッダーの「ファイルを開く」ボタンをクリックする箇所が、LibraryView空状態の
  同名ボタンとの2件マッチでstrict-mode違反を起こすようになった。そのため
  `Header/index.tsx`のボタンへ`data-testid="header-open-file-button"`を追加した。
  この属性追加は表示・挙動に影響しない。testidで一意に特定するよう変更し、
  言語切り替えE2E（日本語↔英語のアクセシブルネーム往復確認）も同様に
  testidスコープのlocatorへ変更した。ヘッダーボタンの表示言語が実際に
  切り替わることを検証する意図は維持している
- 楽譜を開いた後、ライブラリ画面がアンマウントされる（画面遷移が実際に
  起きたこと）を示すアサーションを追加した

### 追加したライブラリE2E（`tests/e2e/library.spec.ts`）

隔離userData方式（`tests/e2e/e2e-user-data.ts`）を再利用し、ライブラリストアも
テストごとに独立させた（他のE2Eやユーザー環境のライブラリを汚染しない）。
1本のテストで以下を実UI操作のみで検証する。

1. 起動直後、ライブラリ画面（空状態）が表示される（REQ-017-010）
2. 既存のダイアログモック方式でサンプル楽譜を開く→楽譜画面へ遷移し
   ライブラリ画面はアンマウントされる
3. ヘッダーのライブラリボタンで戻ると、開いた楽譜が自動登録されている
   （REQ-017-001）
4. 一覧の行クリックで再び楽譜が開ける（REQ-017-007）
5. 削除→確認ダイアログ→削除実行で一覧から消え、空状態表示へ戻る
   （REQ-017-006）

タイトルの重複マッチ（行の開くボタンと削除ボタンのaria-labelが部分一致する）は
`exact: true`で一意化した。

### 統合検証の結果

| コマンド | 結果 |
|---|---|
| `npm run test` | 897件全通過 |
| `npm run typecheck` | 通過（node/web） |
| `npm run lint` | 通過 |
| `npm run lint:jp` | 通過 |
| `npm run format:check` | 通過 |
| `npm run test:e2e`（`npm run build`を内包） | 7件全通過（既存5件＋計装ガード1件＋新規ライブラリE2E1件） |

### 変更ファイル

- `src/renderer/src/components/Header/index.tsx`（`data-testid`追加のみ、挙動不変）
- `tests/e2e/app.spec.ts`（既存前提の更新）
- `tests/e2e/library.spec.ts`（新規）
- `docs/sdd/requirements/traceability.md`（Phase 20節を新設）
- `CLAUDE.md`（ソースコード構成・IPCチャンネル一覧・データ永続化・
  楽譜ライブラリ節を追記）
- `docs/sdd/tasks/index.md`（Phase 20のTASK-101〜103をDONE、TASK-104をREVIEWへ更新）
- `docs/sdd/tasks/phase-20/TASK-104.md`（本ファイル）

### ユーザー実機確認が必要な残項目

以下は本タスクのスコープ内で自動テストによる代替検証を行ったが、
`npm run dev`実起動での目視確認は実施していない（そのため本タスクの
ステータスはDONEではなくREVIEWとする）。

1. ライブラリ画面（検索欄・並べ替えセレクタ・一覧テーブル・削除確認ダイアログ）の
   実際の見た目・レイアウト（機能はLibraryView.testで検証済み）
2. 欠損ファイル（REQ-017-008）をライブラリから開こうとした際の、ネイティブ
   `alert`ダイアログを含む実際の操作感（結線自体はApp.testで検証済みだが、
   実バイナリE2Eでは`window.alert`のダイアログハンドリングを追加していないため
   未実施）
