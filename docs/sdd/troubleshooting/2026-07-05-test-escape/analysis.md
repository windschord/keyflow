# トラブルシューティング分析レポート — 再生バグのテストすり抜け原因と再発防止

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| 報告日 | 2026-07-05 |
| 分析完了日 | 2026-07-05 |
| 報告者 | ユーザー（「テストで検知できなかった原因の分析と再発防止策、同様の事象のチェック」） |
| ステータス | 分析完了（修正タスク承認待ち） |

## 対象事象

再生ボタン無音バグ（`2026-07-05-playback-silent/analysis.md` の原因1〜4）が、ユニットテスト全緑・E2E合格・型/6lint通過にもかかわらず実機で発覚した。同型の「テスト緑なのに動かない」は2026-07-04の `resetToMeasure` 事件に続き2度目。

## なぜテストで検知できなかったか（5つの構造要因）

### 要因1: E2Eが「状態遷移」を合格条件にし、「ユーザー観測可能な結果」を検証しなかった

- 旧 `tests/e2e/app.spec.ts:121-133` は再生ボタン押下後に `playbackState === 'playing'` とボタンの活性切替のみを検証。音・Transport・カーソル進行は対象外。
- 「状態は変わるが何も起きない」実装が構造的に合格する。今回のバグ4つすべてがこの網の目を通過した。

### 要因2: モック境界の「実結線」を検証するテストが不在

- ユニットテストはTone.jsを全面モックしており、モックの向こう側（実Tone.js・AudioContext・CSP）の問題は原理的に検知不能。これ自体は正当な設計だが、**「モックした境界が本体で実際に接続されているか」を検証する結線テストが対になっていなかった**。
- `PlaybackControls.test.tsx:99-103` はさらに、audioEngine未接続でも `playbackState` が 'playing' になることを正常系として期待しており、「鳴らない再生」をテストが承認していた。

### 要因3: テスト実行環境がユーザーの実行環境と異なり、StrictMode起因バグがどの環境でも再現しなかった

- jsdomのReactテストは `render()` をStrictModeでラップしないため、エフェクトの「実行→クリーンアップ→再実行」が起きず、dispose問題（原因1）が再現しない。
- E2Eはプロダクションビルドで実行され、StrictModeの二重実行は開発モード限定のため、こちらでも再現しない。
- つまり「ユーザーが実際に使う `npm run dev`（StrictMode有効）」だけが再現環境であり、自動テストの網から外れていた。

### 要因4: フレームワーク内部（モックの奥）で起きる環境要因は、実挙動テストでしか捕捉できない

- CSP問題（原因4）はTone.jsが内部生成するblob URL Web Workerのブロックであり、アプリコードのどの行にもバグがない。しかも `Transport.seconds` は `AudioContext.currentTime` 由来の純粋getterのため見かけ上正常に進行し、偽の正常シグナルを出していた。
- 「Transportのコールバックが実際に発火して観測可能な結果（カーソル進行）が起きる」ことを実UIで検証するテストが存在して初めて検知できる種類の欠陥だった。

### 要因5: プロセス要因 — 「暫定実装」のフォローアップタスクが未起票のまま完了扱いになった

- TASK-026は意図的な暫定実装（再生開始/停止のみ結線）だったが、残りのREQ-010-005〜008を実装するタスクを**同時に起票しなかった**。US-010は「要件化のみ」で事実上完了扱いとなり、ギャップが追跡不能になった。
- 受入基準の書き方も「再生状態になる」であり、「音が鳴る/カーソルの前進」という観測可能な結果ではなかった。

## 再発防止策（要因に1対1対応）

| # | 防止策 | 対応要因 | 適用方法 |
|---|--------|---------|---------|
| 1 | **E2Eはユーザー観測可能な結果のみを合格条件にする**（状態遷移・内部stateのみの検証を禁止）。`if` ガード内のアサーション（要素がなければ無言スキップ）を禁止し、前提要素の存在を先にassertする | 要因1 | CLAUDE.mdテスト方針に追記（本タスクで実施）。既存E2Eの空虚合格箇所はTASK-046で是正 |
| 2 | **モック境界には結線テストを対で書く**。「実装ユニットテスト＋結線テスト＋E2E」の3点セット（REQ-010-004/005で実証済みのパターン）を統合機能の標準とする | 要因2 | 同上 |
| 3 | **開発モード（StrictMode）での実起動スモークをQAに含める**。コンポーネント/フックのテストはStrictModeラッパーでのレンダリングを段階導入する | 要因3 | TASK-046（テスト是正）に含める |
| 4 | **リソース管理の設計ルール**: useMemo/コンストラクタでの副作用生成を避け、「effect内生成・cleanup破棄・再生成可能」または「遅延初期化＋冪等dispose」のいずれかに統一 | 要因3 | CLAUDE.md実装ガイドラインに追記（本タスクで実施） |
| 5 | **暫定実装はフォローアップタスクの同時起票を必須にする**。受入基準は「観測可能な結果」で書く。REQ→テスト対応表（traceability.md）を導入し、タスクDONE時に対応REQの検証状況を更新する | 要因5 | traceability.md 新設（本タスクで実施）。運用ルールをtasks/index.md凡例に追記済み（TASK-036)＋CLAUDE.mdに追記 |

## 横断チェック結果（同様の事象の捜索）

3系統の読み取り専用検査（未結線・空実装／ライフサイクル耐性／テスト妥当性）を並列実施した。**resetToMeasure事件と同型の「結線欠落をテストが隠蔽している」事象が現在進行形で1件、要件未達なのにテスト緑の事象が複数見つかった。**

### High（本番で機能が壊れている/存在しないのにテスト緑）

| # | 事象 | 根拠 |
|---|------|------|
| H1 | **ファイル履歴が永久に空**: `SettingsService.addRecentFile`（`src/main/settings.ts:34`）の呼び出しがゼロ。`SettingsModal.test` はモックデータで緑（resetToMeasure事件と同型の隠蔽） | REQ-001-006未達 |
| H2 | **エラーモード設定が完全に形だけ**: SettingsModalの「Default Error Mode」はelectron-storeに保存されるだけで、Zustandの `errorMode` に反映するコードがなく、setterも存在しない。practice-engineの `'pass'` 分岐は本番で到達不能 | REQ-004-006のUI経路未達 |
| H3 | **スケール定型運指が未統合のデッドコード**: `scale-patterns.ts` は `dp-solver.ts`/`fingering.worker.ts` からimportされておらず、運指提案に反映されない。しかも `dp-solver.test.ts:26-39` はコメントで要件を実装に合わせて弱体化 | REQ-009-A06未達 |
| H4 | **US-008 運指メモの手動編集UIが皆無**: 右クリック入力・削除・コメントのUIが存在しない（contextmenuハンドラ0件）。annotation-storeユニットテストの緑が偽の安心感を与えている | REQ-008-001/003/006、REQ-009-005/006未達 |
| H5 | **鍵盤ガイドの左右色分けが機能しない**: `keyboard-renderer.ts:48-49` が `partId.includes('right')` で判定するが、実際のpartIdは `P1`/`P2` 形式。parserが算出済みの `Part.hand` が未伝搬 | REQ-005-002未達 |

### Medium（機能欠け・状態不整合）

| # | 事象 | 根拠 |
|---|------|------|
| M1 | **メトロノームONがグローバルTransportを開始し、OFFでも止めない**（`metronome.ts:24-30`）。スコアロード済みだとメトロノーム操作で意図せず伴奏再生が開始し、`playbackState` と乖離する | 状態不整合（本番発現） |
| M2 | MIDIデバイス選択が未実装: `getDevices` 呼び出しゼロ、設定キー `midi.selectedDeviceId` の読み手ゼロ、選択UIなし | REQ-004-008未達 |
| M3 | ズームUIが存在しない: `setZoom` を呼ぶUIゼロ（E2Eはstore直呼びで隠蔽）。pianoHeightも設定不能な固定値 | REQ-002-006未達 |
| M4 | OSMDの `load()` に再入・キャンセル処理がなく、ファイル連続オープンでnoteIdマップと表示が不一致になりうる（`ScoreRenderer/index.tsx:42-55`） | 潜在レース |
| M5 | 画面鍵盤クリックで「その音」が鳴らない（フィードバック音のみ）。テストが現挙動を期待値化 | REQ-005-006一部未達 |
| M6 | BPMクランプが要件（元テンポ比20〜200%）でなく絶対値20〜400で実装され、テストが実装値を仕様化 | REQ-006-003不一致 |
| M7 | 非練習パートの自動伴奏（片手練習時に反対の手を鳴らす）が未実装。TASK-038で再生は全パート固定になった | REQ-003-004未達 |
| M8 | テストの弱点: `ScoreRenderer.test` がsetPartOpacity結線を未アサート、`thumbPassingCost`/`fiveOnBlackCost` テストゼロ、E2Eのカーソル座標検証が空虚合格しうる（`app.spec.ts:244-248`） | 検証欠落 |

### Low（無害だが掃除推奨）

- `src/main/midi-controller.ts`（完全な死にコード）、`Versions.tsx`、`ping` IPC、`createWindow` の重複、preloadの空 `window.api`
- OSMDControllerにdispose不在（現構成では顕在化しないが将来のルーティング導入でリーク化）
- `App.tsx:25` の `useRef(new AnnotationStoreService())`（毎レンダー評価パターン）
- 練習履歴 `history.jsonl` はCLAUDE.mdに記載があるが実装・要件ともに存在しない（ドキュメント乖離）
- `PracticeEngineService.setLoop/clearLoop`、`FingeringEngineService.cancel` の死にAPI

### 問題なしと確認された項目

- useMidi/WebMidiService・FingeringPanelのWorkerライフサイクル・PracticeEngine・window リスナー解除・Transportイベントの再スケジュール掃除は健全（StrictMode「即死級」は audioEngine 以外に存在しない）
- IPC/preloadの結線（`ping` 以外）、storeの主要フィールド、コンポーネントprops、osmd-controller公開メソッドの結線は健全
- practice-engine・parser・annotation-store・PianoKeyboard指番号のテストは要件検証として良質

## 修正方針（承認待ち）

検出事象を以下のタスクに分割して docs/sdd/tasks/ に追加する。

| 提案ID | 内容 | 優先度 | 規模 |
|--------|------|--------|------|
| TASK-039 | [BugFix] ファイル履歴の結線（addRecentFile呼び出し＋モック隠蔽テストの是正）(H1) | High | 小 |
| TASK-040 | [BugFix] エラーモード設定の結線（electron-store→Zustand→practice-engine）(H2) | High | 小 |
| TASK-041 | [BugFix] 鍵盤ガイド左右色分けの修正（Part.hand伝搬）(H5) | High | 小 |
| TASK-042 | [BugFix] メトロノームのTransport起動/停止の非対称修正（M1） | High | 小 |
| TASK-043 | 運指エンジンへのscale-patterns統合＋弱体化テストの是正（H3） | Medium | 中 |
| TASK-044 | US-008 運指メモ手動編集UIの実装（右クリック入力・削除・コメント・承認）(H4) | Medium | 大 |
| TASK-045 | MIDIデバイス選択UI（M2）とズーム/鍵盤高さ設定UI（M3） | Medium | 中 |
| TASK-046 | テストスイート是正（再発防止策1〜3の適用: E2E空虚合格ガード、setPartOpacity結線テスト、コスト関数テスト追加、BPMクランプの要件整合、StrictModeレンダリング導入） | Medium | 中 |
| TASK-047 | 残課題の要件整理（REQ-003-004自動伴奏とUS-010再生の関係再定義、REQ-005-006、OSMD load再入対策）＋死にコード掃除・ドキュメント整合 | Low | 中 |

## 備考

- 再発防止策のうちドキュメント整備（CLAUDE.mdテスト方針・traceability.md新設）は本分析と同時に実施した。
- REQ→テスト対応の全表は `docs/sdd/requirements/traceability.md` を参照。
