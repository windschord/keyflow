# TASK-036: ドキュメントの実態同期とQA運用是正

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-036 |
| タイプ | docs |
| ステータス | DONE |
| 優先度 | Medium |
| 見積もり | 30分 |
| 依存タスク | なし |

## 背景

### 問題の概要

`docs/sdd/troubleshooting/2026-07-04-app-unusable/analysis.md` の調査により、以下4点のドキュメント／プロセス上の問題が判明した。

1. CLAUDE.mdのMIDI構成記述が実装実態と乖離している（node-midi＋IPCと記載されているが、実装はRendererのWeb MIDI API直接利用）。
2. Toolbarコンポーネントの設計書が存在せず、UI仕様（ラベル・ツールチップ・無効化条件）が未定義のまま実装され、用途不明なUIが放置された。
3. TASK-021・TASK-022の受入基準チェックボックスが全項目未チェックのままステータスがDONEにされており、QAが実施されたかの記録が信頼できない。
4. 「受入基準が全てチェックされるまでDONEにしない」というタスク運用ルールが `docs/sdd/tasks/index.md` に明文化されていない。

### 根本原因

- `analysis.md:92` 「CLAUDE.md記載の『node-midi（Main Process）＋IPC』構成と実装（RendererのWeb MIDI API直接使用）が乖離しており、ドキュメントが実態を反映していない。」
  - CLAUDE.md側の記述箇所: `CLAUDE.md:21`（技術スタック表「MIDI入力 | node-midi（Main Process）」）。`CLAUDE.md:60-64`（ソースコード構成の`src/main/midi-controller.ts`・`src/main/ipc-handler.ts`）。`CLAUDE.md:121`（IPCチャンネル名を`src/main/ipc-channels.ts`で管理と記載しているが、同ファイルは存在しない）。`CLAUDE.md:123-128`（`midi:note-on`等のIPCチャンネル一覧）。
  - 実装側の実態: `src/renderer/src/lib/midi/web-midi.ts` がRendererで直接 `navigator.requestMIDIAccess()` を呼び出している。`src/main/index.ts` および `src/preload/index.ts` にMIDI関連のIPC呼び出しは存在しない（実コード確認済み）。`src/main/midi-controller.ts`（node-midiラッパー）はファイルとして存在するが、`src/main/index.ts`から参照されておらず未結線・未使用のコードとして残存している。
- `analysis.md:70` 「`docs/sdd/design/components/` にToolbarの設計書が存在せず、ラベル・ツールチップ・無効化理由表示のUX仕様が未定義のまま実装された。」
  - `docs/sdd/design/components/` には `annotation-store.md` `audio-engine.md` `fingering-engine.md` `midi-controller.md` の4件がある。さらに `musicxml-parser.md` `piano-keyboard.md` `practice-engine.md` `score-renderer.md` を加えた計8件が存在する。しかし`toolbar.md` に相当するファイルは存在しない（実ディレクトリ確認済み）。
  - 関連する未定義UI仕様の具体例（`analysis.md:71-78`）: テンポスライダー・BPM欄・ループ範囲欄にラベルがない（`TempoControl.tsx`, `LoopControl.tsx`）。運指計算対象の「手:右手」ドロップダウンと練習対象パートのLeft/Right/Both選択（`PracticeModeSelector.tsx`）が説明なく併存。Metronomeチェックボックスが結線されていない死にコントロール。Resetの戻し先`originalBpm`が楽譜値でなく120固定。`App.tsx:159`の`loopRange={null}`ハードコードでループ範囲が可視化されない。NFR-U-002（日本語UI必須）違反。
- `docs/sdd/tasks/phase-7/TASK-021.md:78-83` の受入基準4項目、`docs/sdd/tasks/phase-7/TASK-022.md:71-76` の受入基準4項目は、いずれも `- [ ]`（未チェック）のままである。それにもかかわらずファイル冒頭のステータスは `DONE` になっている（実ファイル確認済み）。
- `docs/sdd/tasks/index.md:156-161` の「タスクステータスの凡例」には `TODO`/`IN_PROGRESS`/`BLOCKED`/`REVIEW`/`DONE`の定義のみがあり、DONE判定条件（受入基準の全項目チェック）についての運用ルールが存在しない。

### 関連する仕様

- CLAUDE.md（プロジェクトルート）— AIエージェントが実装前に参照する一次情報源。実態との乖離は将来の実装ミスの直接原因になり得る。
- `docs/sdd/design/components/`（設計書ディレクトリ）— 8コンポーネント中Toolbarのみ欠落。
- `docs/sdd/tasks/phase-7/TASK-021.md`, `docs/sdd/tasks/phase-7/TASK-022.md` — 受入基準未チェックでDONE化された実例。
- `docs/sdd/tasks/index.md` — タスク運用ルールの一次情報源。

## 実装内容

### 修正対象

- ファイル: `CLAUDE.md`
  - 変更内容: 技術スタック表のMIDI入力欄、ソースコード構成のMain Process部分、アーキテクチャ上の重要事項のIPCチャンネル一覧を実態（Web MIDI API直接利用、IPC不使用）に合わせて修正する。
- ファイル: `docs/sdd/design/components/toolbar.md`（新規）
  - 変更内容: Toolbar配下の全コントロール（TempoControl, LoopControl, PracticeModeSelector, Metronomeチェックボックス, Reset, Settingsボタン等）について、用途・ラベル・ツールチップ・無効化条件を定義する。
- ファイル: `docs/sdd/tasks/phase-7/TASK-021.md`, `docs/sdd/tasks/phase-7/TASK-022.md`
  - 変更内容: 受入基準チェックボックスを実際に確認できた項目のみチェックし、未達項目には本フェーズ（phase-10）の対応タスクへの参照を注記する。
- ファイル: `docs/sdd/tasks/index.md`
  - 変更内容: 「タスクステータスの凡例」セクションに「受入基準が全てチェックされるまでDONEにしない」という運用ルールを追記する。

### 実装手順

1. **CLAUDE.md実態同期**
   - `CLAUDE.md:21` の技術スタック表「MIDI入力 | node-midi（Main Process）」を「MIDI入力 | Web MIDI API（Renderer Process直接利用、`src/renderer/src/lib/midi/web-midi.ts`）」に修正する。
   - `CLAUDE.md:60-64` のMain Process構成例から、実装で未結線・未使用となっている`midi-controller.ts`（node-midiラッパー）・`ipc-handler.ts`の記載を実際の構成に合わせて更新する。実際の構成は`src/main/index.ts`, `src/main/midi-controller.ts`（未使用として明記または削除方針を記載）, `src/main/settings.ts`, `src/main/path-allowlist.ts`である。node-midiベースの実装を将来復活させる可能性がある場合はその旨を注記する。
   - `CLAUDE.md:121` の「IPCチャンネル名は`src/main/ipc-channels.ts`で型付き定数として管理」の記述を、実態（同ファイルが存在せず、MIDI関連IPCチャンネル自体が未使用）に合わせて修正する。さらにIPCチャンネル一覧（`CLAUDE.md:123-131`）から`midi:note-on`/`midi:note-off`/`midi:devices-changed`の3行を削除するか、「未使用（設計変更によりRenderer直接処理に変更）」と注記する。
   - `docs/sdd/tasks/phase-3/TASK-008.md`のタイトルに「Web MIDI API・設計変更済」とあることから、この設計変更自体は過去に承認済みであることを確認し、CLAUDE.mdへの反映漏れであった旨を記載する。
2. **Toolbar設計書の新規作成**
   - `docs/sdd/design/components/toolbar.md` を作成し、既存の他コンポーネント設計書（例: `audio-engine.md`）と同等の構成で、以下を最低限定義する。
     - 各コントロール（テンポスライダー、BPM数値入力、ループ範囲の開始/終了小節入力、Metronomeチェックボックス、練習対象パート選択(Left/Right/Both)、運指計算対象の手選択、Reset、Settings）ごとの日本語ラベル・ツールチップ文言。
     - 手選択が2種類（運指計算対象／練習対象パート）存在する理由の説明、またはUIとしての統合方針。
     - Metronomeチェックボックスの有効化に必要な結線（AudioEngineとの接続、TASK-027で対応）への参照。
     - 各コントロールの無効化条件（例: 楽譜未読み込み時は全コントロール無効）。
3. **TASK-021/TASK-022の受入基準是正**
   - `docs/sdd/tasks/phase-7/TASK-021.md`の受入基準4項目について、実際にビルド・起動確認が取れている項目のみ`- [x]`にし、未確認項目（macOSでの動作確認等）は`- [ ]`のまま残す。そのうえで注記に「macOS版はTASK-035で対応」等、対応するphase-10タスクへの参照を追加する。
   - `docs/sdd/tasks/phase-7/TASK-022.md`の受入基準4項目についても同様に、実際に確認できた項目のみチェックし、未達項目（実UIレベルのE2E等）には「実起動E2EはTASK-034で対応」という参照を追記する。
   - いずれのファイルもステータス欄（`DONE`）は変更しない（本タスクは受入基準の正確な記録を目的とし、ステータス自体の再判定は別途QAプロセスで行う）。
4. **タスク運用ルールの追記**
   - `docs/sdd/tasks/index.md:156-161`の「タスクステータスの凡例」セクションに、次のルールを追記する。「受入基準のチェックボックスが全て`[x]`になるまで、ステータスを`DONE`にしてはならない。未達の受入基準がある場合は`REVIEW`または`BLOCKED`とし、対応する後続タスクへの参照を明記すること。」

### 注意事項

- 本タスクはドキュメント修正のみであり、`src/`配下のソースコード（node-midiラッパー等）の削除・改修は行わない。node-midi関連コードの扱い（削除するか将来のネイティブMIDI実装のために残すか）は別途技術的決定として`docs/sdd/design/decisions/`に記載する判断が必要だが、本タスクのスコープ外とする。
- TASK-021/022の受入基準チェック修正は「虚偽のDONE化の是正」が目的であり、後から都合よく全項目をチェックして帳尻を合わせることのないよう、実際に動作確認できた事実のみを反映すること。
- Toolbar設計書は今後のUI改修（TASK-028）の仕様根拠になるため、TASK-028実装前に本タスクを完了させることが望ましい（ただし依存関係としては強制しない＝TASK-036はTASK-028と依存関係なしで独立に着手可能）。

## 受入基準

- [x] CLAUDE.mdのMIDI入力欄・Main Process構成・IPCチャンネル一覧が実装実態（Web MIDI API直接利用、MIDI関連IPC不使用）と一致している
- [x] `docs/sdd/design/components/toolbar.md` が新規作成され、全コントロールの用途・ラベル・ツールチップ・無効化条件が定義されている
- [x] `docs/sdd/tasks/phase-7/TASK-021.md` と `TASK-022.md` の受入基準チェックボックスが、実態に即して修正され（確認済み項目のみチェック）、未達項目には後続タスク（phase-10）への参照が付記されている
- [x] `docs/sdd/tasks/index.md` の「タスクステータスの凡例」セクションに「受入基準が全てチェックされるまでDONEにしない」旨のルールが追記されている
- [x] 既存のテストが通る（`npm run test`・`npm run typecheck`・`npm run lint`をいずれも実行し、成功を確認済み。ソースコードは変更していないため無影響であることも確認した）
- [x] 新規テストが追加されている（該当なし。ドキュメント変更のため対象外）

## テスト項目

- [x] `npm run lint:jp:md`（textlintによるMarkdown日本語チェック）が新規・修正ファイルに対してパスする
  新規作成・修正した`CLAUDE.md`、`docs/sdd/design/components/toolbar.md`、`docs/sdd/design/index.md`、
  `docs/sdd/design/decisions/DEC-004.md`、`docs/sdd/tasks/phase-7/TASK-021.md`、`TASK-022.md`、
  `docs/sdd/tasks/index.md`について個別にtextlintを実行し、エラー0件を確認した。
  本ファイル（TASK-036.md）の「背景」節は本タスク着手前から既存のtextlintエラーを含んでいる。
  タスク計画時に作成された分析記述であり本タスクの変更範囲外のため、当該箇所の修正はスコープ外とする。
- [x] `docs/sdd/design/components/toolbar.md` の内容と `src/renderer/src/components/Toolbar/` 配下の実装の対応関係を目視確認する。対象は`index.tsx`, `TempoControl.tsx`, `LoopControl.tsx`, `PracticeModeSelector.tsx`。
- [x] CLAUDE.md修正後の内容と `src/renderer/src/lib/midi/web-midi.ts`, `src/main/index.ts`, `src/preload/index.ts` の実装が一致していることを目視確認する

## 完了サマリー

### 実施内容

1. `CLAUDE.md`のMIDI入力欄を「Web MIDI API（Renderer Process直接利用）」に修正した。
   ソースコード構成のMain Process部分を実態（`index.ts`・`settings.ts`・`path-allowlist.ts`、
   未結線の`midi-controller.ts`）に更新した。
   IPCチャンネル一覧から`midi:note-on`等のMIDI関連3行を削除し、実際に使用中のfile/settings系チャンネルに置き換えた。
   「よく使うコマンド」に`npm run build:mac`を追記した。`npm run test:e2e`はTASK-034で追記済みのため今回は対象外とした。
2. `docs/sdd/design/components/toolbar.md`を新規作成した。
   `App.tsx`ヘッダー領域と`Toolbar`本体の全コントロール（ファイルを開く・運指対象/運指提案・練習対象L/R/B・
   テンポ/BPM/リセット・メトロノーム・ループ/開始終了小節・再生/一時停止/停止・統計表示・設定）について、
   ラベル・ツールチップ・無効化条件・対応要件IDを表で整理した。
   `docs/sdd/design/index.md`のコンポーネント一覧・ドキュメント構成ツリーにも追記した。
3. `docs/sdd/design/index.md`のDEC-004行と`decisions/DEC-004.md`本体に、実装がWeb MIDI APIへ変更済み
   （PR #16、TASK-008）である旨の注記を追加した。ビルドパイプライン節のmacOS表記を「[Phase 2]」から
   「対応済み（TASK-035）」に更新した。
4. `docs/sdd/tasks/phase-7/TASK-021.md`・`TASK-022.md`の受入基準を、実際に確認できた事実に基づいて是正した。
   TASK-022は`npm run test`（51ファイル・289テスト全パス）・`npm run test:coverage`の実行結果に基づき4項目中3項目を
   チェック済みとし、`dp-solver.ts`のカバレッジが72.97%で80%基準未達であることを実測値付きで明記した。
   TASK-021はWindows実機での検証記録が存在しないため4項目とも未チェックのまま、macOS版（TASK-035）での
   代替確認状況と、対応するWindows専用タスクがPhase 10に存在しない旨を注記した。
5. `docs/sdd/tasks/index.md`の「タスクステータスの凡例」に、受入基準が全てチェックされるまでDONEにしない
   運用ルールを追記した。
6. `npm run test`・`npm run typecheck`・`npm run lint`・`npm run test:coverage`を実行し、いずれも成功することを確認した
   （ソースコード変更なしの確認を兼ねる）。

### 注意事項・残課題

- `src/main/midi-controller.ts`（node-midiラッパー、未結線）の削除可否は本タスクのスコープ外のまま
  未確定である（別途技術的決定が必要）。
- TASK-021の受入基準4項目はWindows実機がない環境のため未チェックのまま残っている。Windows実機での
  検証する専用タスクは現時点のPhase 10には存在しないため、将来必要に応じて新規タスク化を検討すること。
- TASK-022の「カバレッジが主要モジュールで80%以上」は`dp-solver.ts`（72.97%）が未達のため未チェックのまま
  残している。カバレッジ改善タスクは現時点でPhase 10に存在しない。

## 情報の明確性

### 明示された情報

- CLAUDE.mdのMIDI構成記述（node-midi + IPCチャンネル`midi:note-on`等）と実装実態が乖離していること（`analysis.md:92`、実コード確認済み）。実装実態はRendererのWeb MIDI API直接使用（`src/renderer/src/lib/midi/web-midi.ts`）。
- `docs/sdd/design/components/`にToolbar設計書が存在しないこと（実ディレクトリ確認済み）
- 新規Toolbar設計書に定義すべき内容（各コントロールの用途・ラベル・ツールチップ・無効化条件）
- TASK-021/TASK-022の受入基準チェックボックスが全項目未チェックのままDONE化されていること（実ファイル確認済み、`TASK-021.md:80-83`, `TASK-022.md:73-76`）
- 是正方法（実際に確認できた項目のみチェック、未達項目は本フェーズのタスクへの参照を記載）
- タスク運用ルール「受入基準が全てチェックされるまでDONEにしない」を`docs/sdd/tasks/index.md`の凡例セクションに追記すること
- 依存タスクなし

### 不明/要確認の情報

- node-midiベースの`src/main/midi-controller.ts`を将来的に削除するか残すかの技術的決定は未確定のため、本タスクでは「未使用である事実の明記」に留め、削除判断は別タスク（設計決定）に委ねる
