# TASK-034: 実起動E2Eテストの導入（Playwright for Electron）

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-034 |
| タイプ | chore |
| ステータス | DONE |
| 優先度 | Medium |
| 見積もり | 60分 |
| 依存タスク | TASK-028（フェーズA完了） |

## 背景

### 問題の概要

現状の「E2E」テストは `src/renderer/src/tests/integration/practice-flow.test.ts` ほか2本のみである。他の2本は `fingering-benchmark.test.ts` と `musicxml-parser-integration.test.ts` である。いずれもVitest + jsdom上でストア／サービスをユニット的に呼び出すテストであり、実際のElectronアプリを起動してUIを操作するものではない。そのため「アプリを開いて実際に弾いたら動くか」を検証する仕組みがQAプロセスに存在しなかった。その結果、`docs/sdd/troubleshooting/2026-07-04-app-unusable/analysis.md` では致命的な結線漏れ・回帰が報告された。具体的には「曲の再生ができない」「MIDI入力で正誤判定・カーソル進行が一切起きない」「楽譜を手動スクロールできない」の3点であり、これらが23タスク全DONEの状態で市場（ユーザー）まで到達してしまった。

### 根本原因

- `analysis.md:49` 「統合テスト（`tests/integration/practice-flow.test.ts:73`）は `resetToMeasure(1)` を手動で呼んでおり、アプリ本体に存在しない初期化をテストが補完してグリーンになっていた。」
  - 実ファイル `src/renderer/src/tests/integration/practice-flow.test.ts:73` で `engine.resetToMeasure(1);` を直接呼び出している（同ファイル95行目・116行目にも同様の呼び出しあり）。この呼び出しにより、`App.tsx` の実際のファイルオープン処理にこの初期化が存在しないこと（原因1、`analysis.md:46-49`）をテストが隠蔽していた。
- `analysis.md:91` 「E2Eは実UIを起動しないVitest+jsdomのストアレベルテスト3本のみ。」
- `docs/sdd/tasks/phase-7/TASK-022.md` （統合テスト・E2Eシナリオ整備）はストアとサービスの単体呼び出しをもって「統合テスト」と称しており、実Electronプロセス起動・実UI操作・実MIDIイベント注入を伴うテストがタスクスコープに含まれていなかった。

### 関連する仕様

- `docs/sdd/tasks/phase-7/TASK-022.md`: 既存の統合テストタスク。本タスクはこれを補完し、実UIレベルのE2Eを追加する。
- `analysis.md` 修正方針フェーズC 項番8「実起動E2E（Playwright for Electron等）の導入」。
- `analysis.md` 備考「テストが手動初期化で欠落を隠蔽した点は今後のテスト設計の教訓とする」。

## 実装内容

### 修正対象

- ファイル: `package.json`
  - 変更内容: `@playwright/test` を devDependencies に追加し、`test:e2e`（または `test:e2e:electron`）スクリプトを追加する。
- ファイル: `tests/e2e/`（新規ディレクトリ）
  - 変更内容: Playwright for Electron（`_electron` API）を使ったE2Eテストスイートを新設する。
- ファイル: `playwright.config.ts`（新規、リポジトリルート）
  - 変更内容: Electronアプリ起動設定（`out/main/index.js` を起点にする等）、タイムアウト、レポーター設定。
- ファイル: `resources/`（サンプルMusicXML）
  - 変更内容: E2Eで開くための最小サンプルMusicXMLファイルが存在しない場合は追加する（既存のfixtureがあれば流用）。

### 実装手順

1. `@playwright/test` を devDependencies に追加し、`npx playwright install` 相当のセットアップ手順をREADMEまたはCLAUDE.mdに記載する。
2. `playwright.config.ts` を作成し、`electron.launch()` でビルド済み（`npm run build` 後の `out/main/index.js`）または `electron-vite` の開発ビルドを起動できるようにする。
3. 最低限のシナリオを1本のE2Eテストとして実装する（詳細は「テスト項目」参照）。MIDIイベントは実ハードウェアなしで注入する必要があるため、`window`経由でRendererの`WebMidiService`相当のコールバックをテスト用に呼び出すモック機構（`page.evaluate()`でのイベント発火、またはテストビルド用のグローバルフック）を用意する。
4. `npm run test:e2e` で実行できるスクリプトを `package.json` に追加する。
5. `.github/workflows/ci.yml`（`ubuntu-latest`上でlint/test/buildを実行）にE2Eジョブを追加するかを検討する。Electronの実UI起動はヘッドレスLinux CIでは`xvfb-run`等の仮想ディスプレイが必要になるため、まずはローカルで手動実行可能な`npm run test:e2e`を必達要件とし、CIジョブ追加は`xvfb`セットアップの動作確認が取れてから行う。
6. 実行手順をCLAUDE.mdの「よく使うコマンド」に追記する。
7. 本タスク導入時点でTASK-024〜TASK-028（フェーズA）が未完了の場合、E2Eシナリオの一部（再生開始・MIDI正誤判定）は失敗して当然のため、依存タスク（フェーズA）完了後に本タスクを実施する運用とする。

### 注意事項

- 実MIDIハードウェアへの依存を避けるため、MIDIイベントはモック注入とする（`analysis.md`のTASK-022既存記述「実際のMIDIハードウェアなしでIPCレイテンシのみを計測」と同じ考え方を踏襲）。
- Playwright for ElectronはElectronの`BrowserWindow`を直接操作するため、`contextIsolation: true`環境でも`page.evaluate()`はRendererのグローバルスコープで実行される。この点に注意し、`contextBridge`経由のAPIのみを操作対象とする。
- 実行時間が長くなりやすいため、CIタイムアウトとVitestのユニットテストとは別ジョブ・別スクリプトに分離すること。
- 既存のVitest統合テスト（`tests/integration/practice-flow.test.ts`等）は削除・置換せず、ユニット/統合レベルの検証として維持する（テストピラミッドの下位層として引き続き有効）。

## 受入基準

- [x] `npm run test:e2e`（または同等スクリプト）でPlaywright for ElectronによるE2Eテストが実行できる（`npm run build && playwright test`。macOS実機で実行し合格を確認済み）
- [x] シナリオ「アプリ起動→サンプルMusicXMLを開く→楽譜表示→再生開始→手動スクロール→MIDIイベント（モック）で正誤判定・カーソル進行」が自動テストとして実装され、フェーズA完了後にパスする（`tests/e2e/app.spec.ts`、実行結果は下記「完了サマリー」参照）
- [x] E2E実行手順がCLAUDE.mdまたはREADMEの「よく使うコマンド」に記載されている（CLAUDE.md「よく使うコマンド」および「実起動E2Eテスト（Playwright for Electron、TASK-034）」節）
- [x] 既存のテスト（Vitestユニット/統合テスト）が引き続き通る（`npm run test` 全件成功、TASK-034追加分もVitestの対象から除外済み）
- [x] 新規テストが追加されている（Playwright E2Eスイート）（`tests/e2e/app.spec.ts`）

## テスト項目

- [x] アプリ起動（Electronプロセスが起動し、メインウィンドウが表示される）
- [x] サンプルMusicXMLファイルを開く（ファイルダイアログまたはテスト用IPCショートカット経由）（`electronApp.evaluate()`でmainプロセスのIPCハンドラのみ差し替え、`file:read`等は実処理を使用）
- [x] 楽譜（OSMD）が表示される
- [x] 再生ボタンまたはSpaceキーで再生が開始される（TASK-026実装後に有効化）
- [x] マウスホイール等で楽譜を手動スクロールできる（TASK-025実装後に有効化）（テストではズームを引き上げてオーバーフローを作った上でscrollTop変化を確認）
- [x] モックMIDIイベント（NoteOn）を注入すると正誤判定結果が表示され、カーソルが進行する（TASK-024実装後に有効化）。`window.__e2eMidiHooks__`経由で本番と同一の判定コードパスを呼び出し、stats・currentMeasure/currentNoteIndex・OSMDカーソル描画位置の変化で確認した

## 情報の明確性

### 明示された情報

- 現状のE2Eは`src/renderer/src/tests/integration/practice-flow.test.ts`ほか2本のVitest+jsdomテストのみで実UIを起動しないこと（`analysis.md:91`、実ファイル確認済み）
- 統合テストが`resetToMeasure(1)`を手動呼び出しして結線欠落を隠蔽していたこと（`src/renderer/src/tests/integration/practice-flow.test.ts:73`、`95`、`116`）
- 導入するツールはPlaywright for Electron（`_electron`）
- 最低限のシナリオ内容（アプリ起動〜MIDIイベントでの正誤判定・カーソル進行）
- 依存タスクはTASK-028（フェーズA完了）
- CIないしnpm scriptで実行可能にすること

### 不明/要確認の情報

- `.github/workflows/ci.yml`は`ubuntu-latest`上でlint/test/buildを実行しているが、ElectronのE2Eをヘッドレスで動かす`xvfb`等の設定有無は未確認。CI組み込みは「ローカル実行可能なnpm script」を必達要件とし、CI組み込みは動作確認後の追加対応とする（本タスクではCIジョブへの組み込みは未実施。macOS実機での`npm run test:e2e`実行成功のみ確認済み）

## 完了サマリー

- `@playwright/test`をdevDependenciesに追加し、`playwright.config.ts`（`tests/e2e`配下を対象、`workers:1`、Vitestとは独立）を新設。`npm run test:e2e`（`npm run build && playwright test`）と`npm run playwright:install`（`playwright install chromium`）を追加した。
- `tests/e2e/fixtures/sample-two-hands.musicxml`（右手/左手各8小節・32音のMusicXML）を新設し、`tests/e2e/app.spec.ts`に単一のE2Eシナリオを実装した。シナリオ前半は「アプリ起動→メインウィンドウ表示確認→ファイルダイアログをバイパスしてサンプルMusicXMLを読み込み→OSMD描画確認→練習対象を右手に切替」である。シナリオ後半は「再生/停止ボタンで`playbackState`が実際に遷移→ズームを上げて楽譜をオーバーフローさせ`scrollTop`が実際に変化することを確認」する。さらに「MIDIモック注入で正誤判定（`stats.correctNotes`増加・正解率100%表示）」を確認する。あわせて「カーソル進行（`currentMeasure`/`currentNoteIndex`変化、OSMDカーソル`#cursorImg-0`の描画位置変化）」を確認し、この一連を1本のテストとして実装した。
- ファイル選択ダイアログの自動化はOS依存で不安定である。そのためPlaywright公式の推奨手法である`electronApp.evaluate()`でmainプロセスの`ipcMain`の`file:show-open-dialog`ハンドラのみを固定パスに差し替える方式を採用した。`window.electronAPI`はcontextBridgeで公開されているためrenderer側から再代入できないことを実機検証で確認し、この方式に決定した。`file:read`等その他のIPC・パース処理・レンダリングはすべて実処理のまま検証している。
- MIDI入力の検証には、実MIDIハードウェアなしで本番と同一の判定コードパスを検証できるよう、E2E専用の読み取り専用計装を2つ追加した。`usePractice.ts`には`window.__e2eMidiHooks__`（実際の`handleMidiNoteOn`/`handleMidiNoteOff`コールバックそのもの）を追加した。`App.tsx`には`window.__e2eStore__`（実際に使用しているZustandストアの参照）を追加した。いずれもテスト用に分岐したロジックを持たず、本番コードパスをそのまま呼び出す・読み取るのみである。この設計は、`docs/sdd/troubleshooting/2026-07-04-app-unusable/analysis.md`が指摘した「テストが手動初期化で結線欠落を隠蔽した」教訓を踏まえたものである。production側の初期化・判定ロジックを一切迂回しない設計とした。
- `ScoreRenderer`のスクロールコンテナに`data-testid="score-scroll-container"`を追加し、手動スクロールの検証を安定したセレクタで行えるようにした。
- `vitest.config.ts`の`test.exclude`に`tests/e2e/**`を追加し、既存のVitest（jsdom）実行から新設のPlaywrightスイートを分離した。`.gitignore`に`test-results/`・`playwright-report/`・`playwright/.cache/`を追加した。
- 実行結果: macOS実機（Darwin, Electron ^42.4.1）で`npm run test:e2e`を複数回実行し、いずれも1件合格（1.5〜4.8秒）を確認した。テスト終了後にElectron/Playwrightプロセスが残存していないことを`ps aux`で確認済み。ヘッドレスLinux CIでの動作確認は本タスクのスコープ外（未実施）。
- 回帰確認: `npm run test`（Vitest、51ファイル・289件）全件成功、`npm run typecheck`成功、`npm run lint`エラーなしを確認した。
