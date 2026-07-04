# TASK-026: 曲の再生/停止機能の暫定実装

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-026 |
| タイプ | bugfix |
| ステータス | DONE |
| 優先度 | High |
| 見積もり | 40分 |
| 依存タスク | TASK-024 |

## 背景

### 問題の概要

アプリから音が一切出ない。曲を開いても再生手段がなく、Spaceキーはダミー実装で何も起きない。`AudioEngineService` には再生関連のメソッドが実装済みだが、UIからの呼び出しがゼロのため機能していない。

（分析レポート: `docs/sdd/troubleshooting/2026-07-04-app-unusable/analysis.md` 原因2）

### 根本原因

- `src/renderer/src/lib/audio-engine/index.ts` に `loadAccompaniment`（28-68行）、`playAccompaniment`（70-72行）、`pauseAccompaniment`（78-80行）、`stopAccompaniment`（74-76行）が実装済みだが、`src/renderer/src/hooks/usePractice.ts:15` で `AudioEngineService` を生成し41-45行目で `dispose()` するだけで、他のどこからも呼び出されていない。
- Spaceキーハンドラは `src/renderer/src/components/Toolbar/index.tsx:15-19` の `console.log('Play/Pause toggled')` というダミー実装。
- ブラウザ/ElectronのAudioContext解放に必要な `Tone.start()` を呼ぶ箇所がコードベースのどこにも存在しない。
- `usePractice.ts` は `audioEngine` を返す（47行目）が、`src/renderer/src/App.tsx:19` では `practiceEngine` のみを分割代入で取得しており、`audioEngine` はUI側で未使用。
- 「曲全体の再生（お手本演奏）」機能はユーザーストーリー（US-001〜009）に存在しない仕様漏れであり、`docs/sdd/requirements/nfr/usability.md:33` に「スペース: 再生/停止」という記述はあるが対応する機能要件が未定義。本タスクは暫定実装として結線のみ行い、正式な要件定義はTASK-029（別途フェーズBで起票予定）で行う。

### 関連する仕様

- NFR-U-003（キーボードショートカット、`docs/sdd/requirements/nfr/usability.md:33`）: 「スペース: 再生/停止」の記述はあるが対応するUS未定義。本タスクは暫定実装であり、正式な要件化は別タスク（TASK-029想定）で行う。
- REQ-003-004（非練習パート自動伴奏）: `loadAccompaniment` の `accompanimentHand` 引数で参照する対象パート決定ロジックに対応

## 実装内容

### 修正対象

- ファイル: `src/renderer/src/components/Toolbar/index.tsx`
  - 変更内容: 再生/一時停止/停止ボタンを新設する。Spaceキーのダミー実装（15-19行目）を、実際に再生/一時停止をトグルする実装に置換する。
- ファイル: `src/renderer/src/hooks/usePractice.ts`
  - 変更内容: 既に返している `audioEngine`（47行目）をApp.tsx側で利用できるよう、必要なら再生状態（`isPlaying`等）を追加で公開する。
- ファイル: `src/renderer/src/App.tsx`
  - 変更内容: `usePractice()` の分割代入（19行目）に `audioEngine` を追加し、`Toolbar` へ props として渡す。スコア読み込み時（`handleOpenFile` 内、TASK-024で追加される初期化の近辺）に `audioEngine.loadAccompaniment(parsedScore, ...)` を呼ぶ。
  - 変更内容: 初回のユーザー操作（再生ボタン押下等）時に `Tone.start()` を呼ぶ処理を追加する。

### 実装手順

TDDで進める。

1. 失敗するテストを先に書く: Toolbarに再生/一時停止/停止ボタンが表示され、クリックで `audioEngine.playAccompaniment` / `pauseAccompaniment` / `stopAccompaniment` が呼ばれることを検証するテスト（`Toolbar.test.tsx` に追加、`audioEngine` はモックを注入）。
2. テストを実行し、失敗（red）を確認してコミットする。
3. `Toolbar` コンポーネントに再生/一時停止/停止ボタンのUIを追加する（props経由で `audioEngine` または再生ハンドラを受け取る形にする）。
4. Spaceキーハンドラ（`Toolbar/index.tsx:15-19`）を、再生中なら一時停止・停止中なら再生をトグルする実装に置換する。
5. 初回操作時（ボタンクリックまたはSpaceキー初回押下）に `Tone.start()` を呼ぶ処理を追加する（AudioContextはユーザー操作起点でのみ解放されるため）。
6. `App.tsx` でスコア読み込み時（`handleOpenFile`、TASK-024の初期化処理と合わせて）に `audioEngine.loadAccompaniment(parsedScore, accompanimentHand)` を呼ぶ。`accompanimentHand` は非練習パートの決定ロジック（`practiceMode` の逆、または `'both'`）に従う。
7. `usePractice.ts` から `audioEngine` をUIへ公開し（既存の戻り値をそのまま利用可能）、App.tsx / Toolbarで結線する。
8. テストが通る（green）ことを確認する。
9. `npm run dev` で手動E2E確認: 曲を開き再生ボタンを押すと音が鳴り、一時停止・停止が機能する。

### 注意事項

- 本タスクは暫定実装であり、正式なユーザーストーリー化・要件定義は別タスク（フェーズB、TASK-029想定）で行う。UIとしては動作するが「お手本演奏」の詳細仕様（伴奏対象パートの選び方、再生位置とカーソルの同期等）は最小限の結線にとどめる。
- `AudioEngineService.loadAccompaniment` は簡易的なタイムスケジューリング（`audio-engine/index.ts:54` の `${measureIndex}:0:0`）のスタブ実装であることに留意し、本タスクでは音源スケジューリングロジック自体の改善は範囲外とする（結線のみ）。
- `Tone.start()` はユーザージェスチャー（クリック等）のコールバック内で呼ぶ必要がある。useEffect等でのマウント時呼び出しは失敗する可能性が高いため避ける。
- TASK-024（本タスクの依存）でスコア読み込み後の初期化処理が入るため、`loadAccompaniment` の呼び出しはその修正と整合する位置に追加する。

## 受入基準

- [x] Toolbarに再生・一時停止・停止ボタンが表示される
- [ ] 再生ボタン押下で曲の伴奏音が鳴り始める（`playAccompaniment`）※1
- [ ] 一時停止ボタン押下で再生が止まり、再度再生ボタンで続きから再開する ※1
- [ ] 停止ボタン押下で再生が止まり、位置が先頭に戻る（`stopAccompaniment`）※1
- [x] Spaceキーで再生/一時停止がトグルされる（ダミーのconsole.logではなく実処理）
- [ ] 初回操作時に `Tone.start()` が呼ばれ、以降音声が正常に再生される ※1
- [x] スコア読み込み時に `audioEngine.loadAccompaniment()` が呼ばれる
- [x] 既存のテストが通る
- [x] 新規テストが追加されている（必要な場合）

※1 いずれも `playAccompaniment`/`pauseAccompaniment`/`stopAccompaniment`/`Tone.start()` が正しい引数・タイミングで呼び出されることは自動テスト（モック検証）で確認済み。ただし本タスクの実行環境では実際にスピーカーから音が鳴ることの目視・聴覚確認ができないため、「音が鳴る」「音声が正常に再生される」という体感部分は未チェックのまま残す。`npm run dev` によるユーザー自身での実機確認を推奨する。

## テスト項目

- [x] （新規）Toolbarの再生ボタンクリックで `audioEngine.playAccompaniment` が呼ばれる
- [x] （新規）Toolbarの一時停止ボタンクリックで `audioEngine.pauseAccompaniment` が呼ばれる
- [x] （新規）Toolbarの停止ボタンクリックで `audioEngine.stopAccompaniment` が呼ばれる
- [x] （新規）Spaceキー押下で再生/一時停止がトグルされる
- [ ] （手動E2E）`npm run dev` で曲を開き再生ボタンを押すと実際に音が鳴る（実行環境の制約により未確認。根拠は上記※1参照）
- [x] （回帰）`npm run test` 全件グリーン、`npm run typecheck` / `npm run lint` パス

## 完了サマリー

TDDで以下を実装した。

1. Zustandに `playback-slice.ts` を追加し、再生状態（`playbackState`: `'stopped' | 'playing' | 'paused'`）をstoreで一元管理するようにした。
2. `Toolbar/PlaybackControls.tsx` を新設し、再生・一時停止・停止ボタン（日本語ラベル、`title`属性でツールチップ）を実装。ボタンクリックおよびSpaceキー押下で `audioEngine.playAccompaniment` / `pauseAccompaniment` / `stopAccompaniment` を呼び出し、初回の再生操作時のみ `Tone.start()` を呼ぶようにした（`Toolbar/index.tsx` のダミーconsole.log実装を置換）。
3. `App.tsx` で `usePractice()` から `audioEngine` を取得し、`Toolbar` へpropsとして渡すとともに、`handleOpenFile` 内でスコア読み込み後に `audioEngine.loadAccompaniment(parsedScore, accompanimentHand)` を呼ぶよう結線した。`accompanimentHand` は `practiceMode` の逆（片手練習時は反対の手、両手練習時は `'unknown'` にフォールバックし全パート再生扱い）とするヘルパー `getAccompanimentHand` を実装。
4. テスト: `PlaybackControls.test.tsx`（新規、7件）、`Toolbar.test.tsx`（2件追加）、`store.test.ts`（2件追加）、`App.test.tsx`（1件追加）。Tone.jsは既存の他テストと同様にモックした。

`npm run test`（全44ファイル・218テスト）、`npm run typecheck`、`npm run lint` すべて成功を確認済み。

## 情報の明確性

### 明示された情報

- 根本原因のfile:line（分析レポート原因2、実コードで検証済み: audio-engine/index.ts:20-105, usePractice.ts:15,41-47, Toolbar/index.tsx:15-19, App.tsx:19）
- 実装対象: 再生/一時停止/停止ボタン新設、Spaceキー本実装、Tone.start()呼び出し、スコア読み込み時のloadAccompaniment、play/pause/stopAccompanimentの結線、usePractice.tsからaudioEngineのUI公開
- 本タスクは暫定実装であり正式な要件化は別タスク（TASK-029想定）で行うという位置づけ

### 不明/要確認の情報

- なし（すべて確認済み）
