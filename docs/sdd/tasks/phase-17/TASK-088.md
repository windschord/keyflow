# TASK-088: E2E計装（__e2eStore__/__e2eMidiHooks__）の本番ビルド無効化

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-088 |
| タイプ | fix（セキュリティ強化） |
| ステータス | DONE |
| 優先度 | Medium |
| 見積もり | 50分 |
| 依存タスク | TASK-087（`src/main/index.ts` を共有するため順次実行） |

## 背景

### 問題の概要

2026-07-11のセキュリティ調査で、E2Eテスト用の計装 `window.__e2eStore__`（`src/renderer/src/App.tsx:156-159`）と `window.__e2eMidiHooks__`（`src/renderer/src/hooks/usePractice.ts:284-297`）が環境分岐なしの `useEffect` で登録されており、本番ビルドでも `window` 上に公開されることが判明した。単独での悪用は困難だが、攻撃対象領域を無用に広げている。

### 制約（重要）

実起動E2E（`npm run test:e2e`）は `npm run build` で生成した本番ビルドを起動して検証するため、`import.meta.env.DEV` によるガードではE2Eが壊れる。そこで「E2E実行時のみ明示的にオプトインするフラグ」を環境変数からレンダラーまで届ける経路を実装する。

### 関連する仕様

- `docs/sdd/tasks/phase-10/TASK-034.md` — 実起動E2E導入時の計装設計（本番コードパスをそのまま呼び出す方針）
- CLAUDE.md「実起動E2Eテスト」節
- テスト方針の追加原則「テストがアプリ本体にないセットアップを行わない」— 計装自体は本体に残し、公開の有無だけをフラグで制御する（E2E専用ロジック分岐を作らない方針は維持）

## 実装内容

### フラグ伝搬経路

```
Playwright起動時: 環境変数 KEYFLOW_E2E=1
  → main: process.env.KEYFLOW_E2E === '1' のとき webPreferences.additionalArguments に '--keyflow-e2e' を追加
  → preload: process.argv.includes('--keyflow-e2e') を判定し electronAPI.isE2E: boolean として公開
  → renderer: window.electronAPI.isE2E === true のときのみ __e2eStore__/__e2eMidiHooks__ を登録
```

### 修正対象

- ファイル: `src/main/index.ts` — `createWindow()` の `webPreferences` に条件付きで `additionalArguments: ['--keyflow-e2e']` を追加
- ファイル: `src/preload/index.ts` — `electronAPI.isE2E` を公開（contextIsolated/非isolatedの両分岐）
- ファイル: `src/preload/index.d.ts`（存在する場合）および renderer 側の型定義 — `isE2E: boolean` を型に追加
- ファイル: `src/renderer/src/App.tsx` — `__e2eStore__` 登録の useEffect を `isE2E` でガード
- ファイル: `src/renderer/src/hooks/usePractice.ts` — `__e2eMidiHooks__` 登録の useEffect を `isE2E` でガード
- ファイル: `src/renderer/src/hooks/usePractice.test.ts` — ガード有無のテストを追加
- ファイル: `tests/e2e/app.spec.ts` / `playwright.config.ts` — Electron起動時に `env: { KEYFLOW_E2E: '1' }` を渡す（`electron.launch` の `env` オプション。既存の環境変数を引き継ぐこと）

### 注意事項

- `import.meta.env.DEV`（開発モード）でも計装を有効にするかは実装時に判断してよいが、本番パッケージ（環境変数なし起動）で `window.__e2eStore__` / `window.__e2eMidiHooks__` が `undefined` になることが必須要件
- preloadはsandbox化（TASK-087の採否）と両立すること（`process.argv` はsandbox下のpreloadでも参照可能）
- E2Eスイート全件が引き続き通過すること（フラグ結線の検証を兼ねる）

## 実装手順（TDD）

1. テスト作成: `usePractice.test.ts` に「isE2E=falseでは `window.__e2eMidiHooks__` が登録されない」「isE2E=trueでは登録される」テストを追加。App側も同様（適切なテストファイルに配置）
2. テスト実行: `npm run test` で失敗を確認
3. テストコミット
4. 実装: preload → main → renderer の順にフラグ経路を実装
5. E2E結線: Playwright起動に環境変数を追加し `npm run test:e2e` で全件通過を確認（E2E自体が「本番ビルド＋フラグありで計装が有効」の結線テストとなる）
6. 手動確認: 環境変数なしで `npm run build` 起動し、DevToolsコンソールで `window.__e2eStore__ === undefined` を確認
7. `npm run test` / `npm run typecheck` / `npm run lint` 通過を確認しコミット

## 受入基準

- [x] 環境変数なしの起動で `window.__e2eStore__` / `window.__e2eMidiHooks__` が公開されない（ユニットテストで検証。加えてE2E `e2e-instrumentation-guard.spec.ts` でも本番ビルド相当の起動で検証済み）
- [x] `KEYFLOW_E2E=1` 起動で従来どおり計装が公開される
- [x] `npm run test:e2e` が全件通過する（本番ビルド＋フラグの結線検証）
- [x] 計装の実体（本番コードパスを呼び出す方針）は変更していない
- [x] `npm run test` / `npm run typecheck` / `npm run lint` がすべて通過する

## テスト項目

- [x] isE2E=false時に `__e2eMidiHooks__` / `__e2eStore__` が window に登録されない
- [x] isE2E=true時に登録され、既存のE2Eシナリオが動作する
- [x] preloadの `isE2E` が `--keyflow-e2e` 引数の有無に追随する
- [x] E2Eスイート全件通過

## 完了サマリー（2026-07-11）

### 実装したフラグ伝搬経路

設計どおり `KEYFLOW_E2E環境変数 → additionalArguments('--keyflow-e2e') → preloadのprocess.argv判定 → electronAPI.isE2E → rendererガード` の経路で実装した。

- `src/main/index.ts`: `createWindow()` 冒頭で `process.env['KEYFLOW_E2E'] === '1'` を判定し、trueの場合のみ `webPreferences.additionalArguments: ['--keyflow-e2e']` を追加
- `src/preload/index.ts`: `process.argv.includes('--keyflow-e2e')` を `isE2E` として算出し、contextIsolated/非isolated両分岐の `electronAPI` に `isE2E: boolean` として公開
- `src/renderer/src/types/electron-api.d.ts`: `ElectronAPI` インターフェースへ `isE2E: boolean` を追加
- `src/renderer/src/App.tsx`: `__e2eStore__` 登録の `useEffect` 冒頭に `if (!window.electronAPI?.isE2E) return;` を追加
- `src/renderer/src/hooks/usePractice.ts`: `__e2eMidiHooks__` 登録の `useEffect` 冒頭に同様のガードを追加（既存のcleanup=`delete`はそのまま維持）

計装の実体（本番のMIDI処理経路・実際のZustandストアをそのまま公開する方針）は変更せず、公開の有無のみをフラグで制御した。

### テスト

- ユニットテスト: `usePractice.test.ts` / `App.test.tsx` に「isE2E未設定時は非公開」「isE2E=true時は公開」の各テストケースを追加（TDD: 先に失敗するテストを追加してコミットし、実装後に通過を確認）
- E2E結線: `tests/e2e/app.spec.ts` のElectron起動に `env: { ...process.env, KEYFLOW_E2E: '1' }` を追加。既存4テストが引き続き通過することで、フラグが実際にmain→preload→rendererへ伝搬していることを検証した
- E2E非公開検証: 新規 `tests/e2e/e2e-instrumentation-guard.spec.ts` を追加し、環境変数を渡さない起動（本番ビルド相当）で `window.__e2eStore__` / `window.__e2eMidiHooks__` がともに `undefined` であることを自動テストで検証した（タスクファイルが「望ましい」としていた追加ケースを実装。手動確認は不要になった）
- `npm run test`（777件）/ `npm run typecheck` / `npm run lint` / `npm run test:e2e`（5件）すべて通過を確認済み

### 変更ファイル

- `src/main/index.ts`
- `src/preload/index.ts`
- `src/renderer/src/types/electron-api.d.ts`
- `src/renderer/src/App.tsx`
- `src/renderer/src/hooks/usePractice.ts`
- `src/renderer/src/App.test.tsx`
- `src/renderer/src/hooks/usePractice.test.ts`
- `tests/e2e/app.spec.ts`
- `tests/e2e/e2e-instrumentation-guard.spec.ts`（新規）

### 残件

なし。TASK-090（Phase 17統合検証・ドキュメント同期）で本タスクを含む横断確認を行う想定。

## 情報の明確性

### 明示された情報

- 計装の現状（無条件useEffect登録、実ファイル確認済み）
- E2Eが本番ビルドを起動する構成（`playwright.config.ts` / CLAUDE.md確認済み）
- フラグ伝搬経路の設計（環境変数→additionalArguments→process.argv→electronAPI.isE2E。ユーザー承認済みの修正方針）

### 不明/要確認の情報

- 特になし
