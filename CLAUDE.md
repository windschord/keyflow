# CLAUDE.md

AIエージェント向けのプロジェクト情報。このファイルはコードを読まずに作業コンテキストを把握するためのものです。

## プロジェクト概要

MusicXMLに対応したデスクトップピアノ練習アプリ（Electron）。
MIDI入力の正誤判定・運指提案・A-Bループ練習を備え、Synthesiaライクな体験を目指す。

- **Phase 1 対象OS**: Windows 10/11
- **Phase 2 対象OS**: macOS 12+（将来）
- **外部ランタイム依存なし**: ユーザーはNode.js/Pythonを別途インストール不要

## 技術スタック

| 役割 | 採用技術 |
|------|---------|
| デスクトップフレームワーク | Electron v29+ |
| UI | React 18 + TypeScript 5 + Vite (electron-vite) |
| 楽譜レンダリング | OpenSheetMusicDisplay (OSMD) |
| MIDI入力 | Web MIDI API（Renderer Process直接利用、`src/renderer/src/lib/midi/web-midi.ts`） |
| 音声合成 | Tone.js |
| 状態管理 | Zustand v4 |
| 運指エンジン | 独自実装 TypeScript（Web Worker）Parncutt-Terzuolo DPモデル |
| 永続化 | electron-store（設定）、JSONサイドカー（アノテーション）、JSONL（練習履歴） |
| テスト | Vitest |
| Linter/Formatter | ESLint + Prettier |
| パッケージング | electron-builder（Windows: NSIS） |

## ドキュメント構成

```
docs/sdd/
├── requirements/          # 要件定義（EARS記法）
│   ├── index.md           # US-001〜009, NFR一覧
│   ├── stories/           # ユーザーストーリー詳細
│   └── nfr/               # 非機能要件（performance, usability, compatibility）
├── design/                # 技術設計書
│   ├── index.md           # アーキテクチャ概要・データモデル
│   ├── components/        # コンポーネント設計（9件）
│   ├── database/          # スキーマ定義
│   └── decisions/         # 技術的決定事項 DEC-001〜004
└── tasks/                 # 実装タスク計画
    ├── index.md           # 全22タスク・フェーズ概要
    ├── phase-1/           # TASK-001〜003: 開発環境構築
    ├── phase-2/           # TASK-004〜007: データ層・型定義
    ├── phase-3/           # TASK-008〜009: MIDI & IPC
    ├── phase-4/           # TASK-010〜013: UIコアコンポーネント
    ├── phase-5/           # TASK-014〜016: 練習エンジン統合
    ├── phase-6/           # TASK-017〜020: 運指エンジン（DP）
    └── phase-7/           # TASK-021〜022: パッケージング・QA
```

## ソースコード構成（予定）

実装開始後に `src/` 以下が生成される。設計上の配置：

```
src/
├── main/                  # Electron Main Process
│   ├── index.ts           # エントリーポイント（ファイルダイアログ・file:read/write・settings系IPCハンドラを実装）
│   ├── midi-controller.ts # node-midiラッパー（未使用・未結線。src/main/index.tsから参照されていない残存コード。
│   │                       #   MIDI入力は設計変更によりRendererのWeb MIDI API直接利用に切り替え済み。
│   │                       #   将来ネイティブMIDI実装へ戻す可能性がある場合の参考実装として残置。削除判断は未確定）
│   ├── settings.ts        # electron-store ラッパー（アプリ設定・最近使ったファイル）
│   └── path-allowlist.ts  # ファイル書き込み許可パスの検証
├── preload/
│   └── index.ts           # contextBridge 定義（file/settings系APIのみ公開。MIDI関連IPCは公開していない）
└── renderer/
    └── src/
        ├── lib/
        │   ├── musicxml-parser/   # MusicXML → Score変換
        │   ├── practice-engine/   # 正誤判定・ループ管理
        │   ├── annotation-store/  # 運指メモCRUD
        │   ├── audio-engine/      # Tone.js ラッパー
        │   ├── midi/              # Web MIDI API直接利用（web-midi.ts）。navigator.requestMIDIAccess()をRendererで呼び出す
        │   └── fingering-engine/  # FingeringEngineService（Workerクライアント）
        ├── workers/
        │   └── fingering/
        │       ├── types.ts
        │       ├── span-table.ts
        │       ├── cost-functions.ts
        │       ├── dp-solver.ts   # Parncutt-Terzuolo DP
        │       ├── scale-patterns.ts
        │       └── fingering.worker.ts
        ├── components/
        │   ├── ScoreRenderer/     # OSMD統合
        │   ├── PianoKeyboard/     # Canvas 2D 88鍵
        │   ├── Toolbar/           # テンポ・ループ・モード切替
        │   └── FingeringPanel/    # 運指提案UI
        ├── store/
        │   └── practice-session.ts  # Zustand store
        └── tests/
```

## よく使うコマンド

```bash
# 開発サーバー起動
npm run dev

# ユニットテスト
npm run test

# テスト（watchモード）
npm run test:watch

# カバレッジ
npm run test:coverage

# 実起動E2Eテスト（Playwright for Electron。初回のみブラウザ取得が必要）
npx playwright install chromium   # または: npm run playwright:install
npm run test:e2e                  # `npm run build` を実行してから実バイナリを起動して検証する

# 型チェック
npm run typecheck

# Lint
npm run lint

# Windowsインストーラービルド
npm run build:win

# macOSパッケージビルド（dmg/zip、arm64+x64。TASK-035）
npm run build:mac
```

## アーキテクチャ上の重要事項

### Electronセキュリティ設定
- `contextIsolation: true` / `nodeIntegration: false` を必ず維持すること
- Main↔Renderer通信はすべて `src/preload/index.ts` の `contextBridge` 経由のみ
- IPCチャンネル名は各ハンドラ実装箇所（`src/main/index.ts`）に文字列リテラルで直接記述している。
  型付き定数ファイル（`src/main/ipc-channels.ts`）は存在しない

### IPCチャンネル一覧
> MIDI入力はRendererのWeb MIDI API（`src/renderer/src/lib/midi/web-midi.ts`）で直接処理しており、
> MIDI関連のIPCチャンネル（`midi:note-on`等）は使用していない。設計変更済みであり、詳細は
> `docs/sdd/tasks/phase-3/TASK-008.md`を参照。当初の設計であるnode-midi＋IPC構成からの変更が
> 本ファイルに未反映のまま残っていたため、本節で是正した。

| チャンネル | 方向 | 用途 |
|-----------|------|------|
| `file:show-open-dialog` | Renderer→Main | ファイル選択ダイアログ |
| `file:read` | Renderer→Main | テキストファイル読み込み（.xml/.musicxml） |
| `file:read-binary` | Renderer→Main | バイナリファイル読み込み（.mxl） |
| `file:write` | Renderer→Main | アノテーションJSON書き込み |
| `settings:get` / `settings:set` | Renderer→Main | アプリ設定の取得・保存（electron-store） |
| `settings:get-recent-files` | Renderer→Main | 最近使ったファイル一覧の取得 |

### Web Worker（運指エンジン）
- `fingering.worker.ts` は Vite の `?worker` インポートで読み込む
- メッセージ型: `FingeringRequest` / `FingeringResponse`（`src/workers/fingering/types.ts`）
- タイムアウト: 60秒で強制終了、部分結果を返す

### データ永続化
- アノテーション: `{MusicXMLのパス}.annotation.json`（同フォルダに保存）
- `noteId` フォーマット: `{partId}-M{measureNumber}-N{noteIndex}` 例: `P1-M3-N0`

### 実起動E2Eテスト（Playwright for Electron、TASK-034）
- `tests/e2e/`: `npm run build` で生成した `out/main/index.js` を実際に起動し、実UI操作のみで検証するE2Eスイート（`playwright.config.ts`）
- 既存のVitest（`npm run test`）とは完全に独立したスクリプト（`npm run test:e2e`）。ヘッドレスLinux CIではXvfb等が無いと実行できない場合があるため、CI組み込みは未対応（ローカル実行が必達要件）
- ファイル選択ダイアログはOS依存で自動化できないため、`electronApp.evaluate()` でmainプロセスの `file:show-open-dialog` IPCハンドラのみを固定パスに差し替える（`file:read`等の他IPC・パース・レンダリングは実処理を使用）
- MIDI入力は実ハードウェアなしで検証するため、`usePractice.ts` が公開する `window.__e2eMidiHooks__`（実際のMIDI受信コールバックそのもの）を呼び出す。状態検証には `App.tsx` が公開する `window.__e2eStore__`（実際のZustandストア参照）を使う
- これらの `window.__e2e*__` はE2Eテスト専用の計装であり、テスト用に分岐したロジックではなく本番コードパスをそのまま呼び出す・読み取るためのフックである
- アプリ設定: electron-store（OS標準アプリデータフォルダ）
- 練習履歴: `history.jsonl`（JSON Lines形式）

## 実装ガイドライン

- **コスト関数**: `docs/sdd/design/components/fingering-engine.md` のコスト表を参照
- **スパン制約**: 同ファイルの `SPAN_TABLE` を `span-table.ts` として実装
- **テスト方針**: TDD。各タスクファイルにテストケースが記載済み
- **型安全**: `strict: true`、`any` 禁止。型キャストは `// @ts-expect-error` + コメント必須
- **エラーハンドリング**: ユーザーへのエラー表示は必ずダイアログまたはトースト通知で行う

### テスト方針の追加原則（2026-07-05 再発防止策。経緯: docs/sdd/troubleshooting/2026-07-05-test-escape/analysis.md）

- **E2Eはユーザー観測可能な結果を合格条件にする**: 内部stateの遷移だけの検証は不可（例: 再生なら「カーソルが実際に進む」を検証）。`if` ガード内のアサーション（前提要素がなければ無言スキップ）は禁止し、前提の存在を先にassertする
- **モック境界には結線テストを対で書く**: 何かをモックしたら「その境界が本体で実際に接続されている」ことを検証するテストをセットで用意する。統合機能は「実装ユニット＋結線テスト＋E2E」の3点セット（REQ-010-004/005が模範例）
- **テストの期待値は要件から導く**: 実装の現挙動を期待値にしない。実装に合わせてテストを弱める変更は禁止
- **テストがアプリ本体にないセットアップを行わない**: 本体の結線欠落を隠蔽するため（過去2度の事故原因）
- **REQトレーサビリティ**: `docs/sdd/requirements/traceability.md` をタスク完了時に更新し、検証なしREQを可視化する
- **Reactリソース管理**: useMemo/コンストラクタでの副作用生成を避け、「effect内生成・cleanup破棄・再生成可能」または「遅延初期化＋冪等dispose」に統一（StrictModeの実行→クリーンアップ→再実行に耐えること）。動作確認は開発モード（StrictMode有効）でも行う

## タスクの進め方

1. `docs/sdd/tasks/index.md` でフェーズと依存関係を確認
2. 各タスクファイル（例: `phase-1/TASK-001.md`）を読んで実装
3. タスク完了後にステータスを `DONE` に更新
4. 並列実行可能グループはindex.mdの「並列実行グループ」セクションを参照

## 参考資料

- [Parncutt & Terzuolo (1997)](https://doi.org/10.2307/40285402) — 運指モデルの原典論文
- [Balliauw et al. (2015)](https://doi.org/10.1007/978-3-319-20258-3_26) — 拡張DP実装参考
- [OSMD ドキュメント](https://opensheetmusicdisplay.github.io/opensheetmusicdisplay/)
- [electron-vite](https://electron-vite.org/)
