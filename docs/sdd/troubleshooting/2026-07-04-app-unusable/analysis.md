# トラブルシューティング分析レポート

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| 報告日 | 2026-07-04 |
| 分析完了日 | 2026-07-04 |
| 報告者 | ユーザー（スクリーンショット添付） |
| ステータス | 完了（TASK-024〜036実施済み。残件: TASK-037 鍵盤指番号描画） |

## 問題事象

### 報告された現象

1. 曲の再生ができない
2. 用途がわからないボタン・数字・チェックボックスがある（グレーに見えるMetronome/Loop、「1」「1」の数値フィールド等）
3. 楽譜を手動でスクロールできない（3段目がピアノ鍵盤に隠れて見切れる）
4. 全体として「MusicXMLを読み込みMIDI入力で練習するSynthesiaライクなアプリ」として使い物にならない

### 期待動作

- 曲を開いたら再生して聴ける
- MIDIキーボードで弾くと正誤判定され、カーソルが進み、次に弾く鍵盤がガイドされる
- 各UIコントロールの用途が見て分かる
- 楽譜を自由にスクロールできる

### 再現手順

1. `npm run dev` でアプリを起動し、Open File でMusicXMLを開く
2. 楽譜は表示されるが、再生手段がない（再生ボタンなし、Spaceキーはダミー）
3. MIDIキーボードを弾いても正誤判定・カーソル進行・ガイドが一切起きない
4. マウスホイールで楽譜をスクロールしようとしても動かない

### 発生環境

- 環境: macOS 12+（darwin）、開発ビルド（`npm run dev`）
- 頻度: 常に発生（機能欠落・結線漏れのため）

## 根本原因分析

4つの独立仮説をAgentによる並列調査で検証した。結果、単一のバグではなく「**ライブラリ層は実装済みだがUIへの結線が欠落**」という構造的問題と、「**要件定義がSynthesiaライク体験の核をスコープ外にしていた**」という仕様問題の複合であることを特定した。

### 原因1: 練習エンジンが永久に起動しない（最重要・実装バグ）

- 原因箇所: `src/renderer/src/App.tsx:85`（`handleOpenFile`）、`src/renderer/src/store/slices/score-slice.ts:15-16`
- 曲を開いた後に `practiceEngine.resetToMeasure(1)` を呼ぶコードがどこにも存在せず、`expectedNotes` が初期値 `[]` のまま。MIDIイベントは `src/renderer/src/lib/practice-engine/index.ts:22-25` で即 `'ignored'` になる。
- **結果: 正誤判定・鍵盤ガイド・カーソル進行・統計・ループ、練習機能のすべてが体感上動かない。**
- 統合テスト（`tests/integration/practice-flow.test.ts:73`）は `resetToMeasure(1)` を手動で呼んでおり、アプリ本体に存在しない初期化をテストが補完してグリーンになっていた。

### 原因2: 再生機能の不在（仕様漏れ＋統合スコープ漏れ）

- 「曲全体の再生（お手本演奏）」はユーザーストーリー（US-001〜009）に存在しない。`docs/sdd/requirements/nfr/usability.md:33` に「スペース: 再生/停止」とあるが対応する機能要件がない。
- `AudioEngineService`（`src/renderer/src/lib/audio-engine/index.ts`）には `loadAccompaniment` / `playAccompaniment` / `setBpm` / `setMetronomeEnabled` が実装済みだが、**UIからの呼び出しがゼロ**。`usePractice.ts:15` で生成され `dispose()` されるだけ。
- Spaceキーハンドラは `console.log('Play/Pause toggled')` のダミー（`src/renderer/src/components/Toolbar/index.tsx:15-19`）。`Tone.start()`（AudioContext解放）を呼ぶ箇所もない。
- **結果: アプリから音が一切出ない。テンポスライダー・BPM欄・Metronomeも聴覚的効果ゼロ。**
- 統合タスク `docs/sdd/tasks/phase-5/TASK-016.md` のスコープにAudioEngine結線が含まれていなかったことが直接原因。

### 原因3: 手動スクロール不可（実装バグ・CSS）

- 原因箇所: `src/renderer/src/App.tsx:153` — 高さが確定する唯一のコンテナが `overflow: 'hidden'` で楽譜をクリップ。
- `ScoreRenderer/index.tsx:89` の `overflow: 'auto'` は親がflexコンテナでないため `flexGrow: 1` が無効で高さ未確定、スクロール不発。内側の `height: '100%'`（同 95-105行）も解決不能。
- 自動スクロールだけは `osmd-controller.ts:78-91` の `scrollIntoView` が overflow: hidden 要素をプログラム的にスクロールできるため動作し、「自動は動くのに手動は不可」という非対称が発生。
- 鍵盤との「重なり」は実際には重なりではなく、overflow: hidden 境界でのクリップの見え方。
- TASK-023 の受入基準「手動でもスクロールできる」は `[x]` チェック済みだが未達（QA漏れ）。
- 付随: `src/renderer/src/assets/main.css` にelectron-viteテンプレートの残骸（body中央寄せ、`#root` の `margin-bottom: 80px`）が残存。

### 原因4: 用途不明UI（設計欠落）

- `docs/sdd/design/components/` にToolbarの設計書が存在せず、ラベル・ツールチップ・無効化理由表示のUX仕様が未定義のまま実装された。
- 具体的問題:
  - テンポスライダー・「120」欄・ループの「1」「1」欄に**ラベルが一切ない**（`TempoControl.tsx`, `LoopControl.tsx`）
  - 「手:右手」ドロップダウン（運指計算対象）と Left/Right/Both（練習対象パート）という**2つの手選択が説明なしで併存**
  - Metronome/Loopは disabled ではなく未チェックの標準描画がグレーに見えるだけ。Metronomeはチェックしても消費コードが存在しない**死にコントロール**
  - Resetの戻し先 `originalBpm` は楽譜から設定されず120固定
  - `App.tsx:159` が `loopRange={null}` をハードコードし、ループ範囲が楽譜上に可視化されない
  - NFR-U-002「日本語UI必須」に反しUIはほぼ英語（Open File / Loop / Metronome / Settings）
  - SettingsModalの「Enable Metronome by Default」とツールバーの `metronomeEnabled` が相互未接続

### 原因5: データモデルの構造的欠陥（両手曲が原理的に弾けない）

- パーサー（`src/renderer/src/lib/musicxml-parser/parser.ts:120-201`）は複数パートの音符を「P1全音符→P2全音符」の順で連結し、**音符に発音時刻の概念がない**。practice-engineは線形インデックスで1音ずつ進むため、両手同時演奏の判定が構造的に不可能。
- noteId不整合: パーサーはパート横断連番（`parser.ts:186`）、OSMD側はパート毎連番（`osmd-controller.ts:233-243`）でIDを振っており、2パート曲でカーソル追従・運指番号の描画位置が破綻する。
- Synthesiaライクな「時間ベースの曲進行」「落ちてくるノーツ」は要件で明示的にスコープ外（`docs/sdd/requirements/index.md:73`、US-005備考）。

### 原因6: ダミー実装の放置とQAプロセスの形骸化

- `osmd-controller.ts` の `setPartOpacity`（94-96行）・`highlightNote`（111-113行）・`drawLoopBracket`（98-100行）が空実装。楽譜上の正誤フィードバック・非練習パートのグレーアウト・ループ表示が存在しない。
- `App.tsx:161` の `onNoteClick={() => {}}`、`App.tsx:172` の `annotations={[]}` 固定など、結線の空スタブが多数。
- 正解率・連続正解数の表示コンポーネントが存在しない（US-004のUI要件未実装）。US-008の手動運指メモUI、US-001のドラッグ&ドロップも未実装。
- TASK-021/022はステータスDONEだが**受入基準チェックボックスは全項目未チェック**。E2Eは実UIを起動しないVitest+jsdomのストアレベルテスト3本のみ。パッケージングはWindows NSISのみでユーザー環境（macOS）では未検証。
- CLAUDE.md記載の「node-midi（Main Process）＋IPC」構成と実装（RendererのWeb MIDI API直接使用）が乖離しており、ドキュメントが実態を反映していない。

## 仕様照合結果

### 関連する要件

- US-004（正誤判定）: 要件あり・エンジン実装あり・**初期化欠落で全く動作せず**（実装バグ）
- US-005（鍵盤ガイド）: 同上
- REQ-003-004（非練習パート自動伴奏）・US-006（テンポ/メトロノーム）: 要件あり・エンジン実装あり・**UI結線ゼロ**（統合漏れ）
- 「曲全体の再生」: **ユーザーストーリー不在**（仕様漏れ）。NFR-U-003のショートカット記述と矛盾
- NFR-U-002（日本語UI）: 違反
- 「時間ベース進行・両手同時判定」: データモデルに時刻が存在せず**仕様レベルの欠陥**

### 乖離の分類

- [x] 実装バグ（原因1, 3, 6の一部）
- [x] 仕様バグ（原因5: 時刻なしデータモデル、noteId仕様不整合）
- [x] 仕様漏れ（原因2: 再生機能、原因4: Toolbar UX仕様）

## 修正方針

### 承認済み修正方針

フェーズA→B→Cを順に完遂する。フェーズAには「曲の再生（お手本演奏）」の暫定実装を含める（正式な要件化はフェーズBのTASK-029で実施）。

**フェーズA: 結線修正（既存要件を「動く」状態にする）**
1. スコア読み込み後の `practiceEngine.resetToMeasure(1)` 呼び出し追加 → MIDI練習フロー起動
2. AudioEngine結線: 再生/停止ボタン新設＋Spaceキー実装、`Tone.start()`、store→`setBpm`/`setMetronomeEnabled` 同期、正誤効果音
3. スクロールCSS修正（App.tsx:153のflex化とoverflow整理、テンプレートCSS残骸除去、スクロールコンテナの一本化）
4. Toolbar UX改善: 全コントロールへの日本語ラベル・ツールチップ、手選択の統合または明確な区分、死にコントロールの結線または削除、`loopRange` 結線

**フェーズB: 仕様の再定義（Synthesiaライク体験の要件化）**
5. requirements-defining で「曲の再生（お手本演奏）」ユーザーストーリーを追加
6. データモデル再設計: 音符への発音時刻付与、パート統合の時刻ベース化、noteId仕様統一 → 両手曲対応
7. osmd-controllerの空実装（highlightNote / setPartOpacity / drawLoopBracket）の実装

**フェーズC: プロセス改善**
8. 実起動E2E（Playwright for Electron等）の導入、受入基準チェックの運用徹底、macOSパッケージング追加、CLAUDE.md/設計書の実態同期

### 承認日時

2026-07-04（AskUserQuestionにて承認取得）

### 修正対象ファイル

1. `src/renderer/src/App.tsx`
2. `src/renderer/src/hooks/usePractice.ts`
3. `src/renderer/src/components/Toolbar/`（index / TempoControl / LoopControl / PracticeModeSelector）
4. `src/renderer/src/components/ScoreRenderer/index.tsx`, `osmd-controller.ts`
5. `src/renderer/src/assets/main.css`
6. `src/renderer/src/lib/musicxml-parser/parser.ts`（フェーズB）
7. `docs/sdd/requirements/`, `docs/sdd/design/`（フェーズB）

## 生成されたタスク

Phase 8（フェーズA: 結線修正・UX改善）、Phase 9（フェーズB: 仕様再定義・データモデル刷新）、Phase 10（フェーズC: QA・プロセス改善）として docs/sdd/tasks/ に追加。

| ID | タスク名 | ステータス |
| ---- | --------- | ----------- |
| TASK-024 | [BugFix] スコア読み込み後の練習セッション初期化 | DONE |
| TASK-025 | [BugFix] 楽譜スクロールのCSSレイアウト修正 | DONE |
| TASK-026 | [BugFix] 曲の再生/停止機能の暫定実装 | DONE |
| TASK-027 | [BugFix] テンポ・メトロノーム・効果音の結線 | DONE |
| TASK-028 | [BugFix] Toolbar UXの全面改善（日本語ラベル・機能整理） | DONE |
| TASK-029 | 要件定義追加: US-010 曲の再生（お手本演奏） | DONE |
| TASK-030 | 設計: 時刻ベースデータモデルへの再設計 | DONE |
| TASK-031 | パーサーの時刻付与・noteId統一実装 | DONE |
| TASK-032 | practice-engineの両手・和音同時判定対応 | DONE |
| TASK-033 | 楽譜上の視覚フィードバック実装（osmd-controller空実装の解消） | DONE |
| TASK-034 | 実起動E2Eテストの導入（Playwright for Electron） | DONE |
| TASK-035 | macOSパッケージングの追加 | DONE |
| TASK-036 | ドキュメントの実態同期とQA運用是正 | DONE |
| TASK-037 | 鍵盤上の指番号描画（TASK-033残件。PianoKeyboard配下がセッション権限でdenyだったため分離） | TODO |

## 備考

- 全23タスクDONEにもかかわらず本問題が発生した根本は「タスク単体のテストは通るが、統合結線をスコープに持つタスクが存在せず、実UIを動かすQAが行われなかった」こと。テストが手動初期化で欠落を隠蔽した点は今後のテスト設計の教訓とする。
- 楽譜表示（OSMD）と運指提案（Web Worker DP）は正常に動作しており、資産として再利用可能。
