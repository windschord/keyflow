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
| MIDI入力 | node-midi（Main Process） |
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
│   ├── components/        # コンポーネント設計（8件）
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
│   ├── index.ts           # エントリーポイント
│   ├── midi-controller.ts # node-midi ラッパー
│   ├── ipc-handler.ts     # IPCチャンネル登録
│   └── preload.ts         # contextBridge 定義
└── renderer/
    └── src/
        ├── lib/
        │   ├── musicxml-parser/   # MusicXML → Score変換
        │   ├── practice-engine/   # 正誤判定・ループ管理
        │   ├── annotation-store/  # 運指メモCRUD
        │   ├── audio-engine/      # Tone.js ラッパー
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

# 型チェック
npm run typecheck

# Lint
npm run lint

# Windowsインストーラービルド
npm run build:win
```

## アーキテクチャ上の重要事項

### Electronセキュリティ設定
- `contextIsolation: true` / `nodeIntegration: false` を必ず維持すること
- Main↔Renderer通信はすべて `preload.ts` の `contextBridge` 経由のみ
- IPCチャンネル名は `src/main/ipc-channels.ts` で型付き定数として管理

### IPCチャンネル一覧
| チャンネル | 方向 | 用途 |
|-----------|------|------|
| `midi:note-on` | Main→Renderer | MIDI NoteOn イベント |
| `midi:note-off` | Main→Renderer | MIDI NoteOff イベント |
| `midi:devices-changed` | Main→Renderer | MIDIデバイス一覧更新 |
| `file:open-musicxml` | Renderer→Main | ファイル選択ダイアログ |
| `file:read` | Renderer→Main | ファイル読み込み |
| `file:write` | Renderer→Main | アノテーションJSON書き込み |

### Web Worker（運指エンジン）
- `fingering.worker.ts` は Vite の `?worker` インポートで読み込む
- メッセージ型: `FingeringRequest` / `FingeringResponse`（`src/workers/fingering/types.ts`）
- タイムアウト: 60秒で強制終了、部分結果を返す

### データ永続化
- アノテーション: `{MusicXMLのパス}.annotation.json`（同フォルダに保存）
- `noteId` フォーマット: `{partId}-M{measureNumber}-N{noteIndex}` 例: `P1-M3-N0`
- アプリ設定: electron-store（OS標準アプリデータフォルダ）
- 練習履歴: `history.jsonl`（JSON Lines形式）

## 実装ガイドライン

- **コスト関数**: `docs/sdd/design/components/fingering-engine.md` のコスト表を参照
- **スパン制約**: 同ファイルの `SPAN_TABLE` を `span-table.ts` として実装
- **テスト方針**: TDD。各タスクファイルにテストケースが記載済み
- **型安全**: `strict: true`、`any` 禁止。型キャストは `// @ts-expect-error` + コメント必須
- **エラーハンドリング**: ユーザーへのエラー表示は必ずダイアログまたはトースト通知で行う

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
