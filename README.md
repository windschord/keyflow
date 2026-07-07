# KeyFlow — MusicXML ピアノ練習アプリ

MusicXMLファイルを読み込み、MIDI入力で練習できるデスクトップアプリ。  
Synthesia / Piano Marvel ライクな体験を、自分の楽譜で実現します。

> **ステータス**: 設計完了 / 実装フェーズ準備中

---

## 主な機能

| 機能 | 説明 |
|------|------|
| 🎼 MusicXMLインポート | `.xml` / `.mxl` ファイルを読み込んで五線譜表示 |
| 🤚 右手・左手分離練習 | 右手のみ / 左手のみ / 両手モードを切替 |
| 🎹 MIDI正誤判定 | MIDIキーボードの入力を楽譜と照合してリアルタイム判定 |
| 💡 光るキーガイド | 次に押すべき鍵盤を画面上で視覚的にガイド |
| ⏱️ テンポ調整 | 20%〜200% の範囲でテンポを変えて練習 |
| 🔁 A-Bループ | 苦手な小節範囲を指定して繰り返し練習 |
| ✍️ 運指メモ | 楽譜上の音符に指番号・コメントを書き込んで保存 |
| 🤖 運指提案 | AI（Parncutt-Terzuolo DPモデル）が運指を自動提案 |

---

## 動作環境

| 項目 | 要件 |
|------|------|
| OS | Windows 10 / 11 (Phase 1) |
| MIDI | USB/Bluetooth MIDIキーボード（任意） |
| インストール要否 | **不要** — インストーラー (.exe) を実行するだけ |

> Node.js・Pythonなどの追加インストールは一切不要です。

---

## 技術スタック

```
Electron v29+          デスクトップフレームワーク（Node.jsをバンドル）
React 18 + TypeScript  UI + 全ビジネスロジック
Vite (electron-vite)   ビルドツール
OpenSheetMusicDisplay  MusicXML → 五線譜レンダリング
node-midi              低遅延MIDIネイティブ処理（<10ms）
Tone.js                伴奏・メトロノーム音声合成
Zustand v4             グローバル状態管理
Web Worker             運指DP計算（UIブロックなし）
electron-builder       Windows NSISインストーラー生成
Vitest                 ユニット・統合テスト
```

---

## 開発手順

### 前提条件

- Node.js 18+ （開発者のみ必要。エンドユーザーは不要）
- npm 9+
- Windows: `windows-build-tools`（node-midiのネイティブビルド用）

### セットアップ

```bash
git clone https://github.com/yourname/keyflow.git
cd keyflow
npm install          # node-midiの自動ビルドを含む（postinstall で electron-rebuild が走る）
npm run dev          # 開発サーバー起動
```

### 主要コマンド

```bash
npm run dev           # 開発モード（ホットリロード）
npm run build         # プロダクションビルド
npm run build:win     # Windows NSISインストーラー生成
npm run test          # ユニットテスト
npm run test:coverage # カバレッジレポート
npm run lint          # Lintチェック
npm run typecheck     # TypeScript型チェック
```

---

## ドキュメント

設計ドキュメント（SDD）は `docs/sdd/` 以下に格納されています。

```
docs/sdd/
├── requirements/   要件定義（US-001〜009, NFR）
├── design/         技術設計書（アーキテクチャ・コンポーネント・スキーマ）
└── tasks/          実装タスク計画（22タスク / 7フェーズ）
```

AIエージェントが作業する場合は [CLAUDE.md](./CLAUDE.md) を参照してください。

---

## アーキテクチャ概要

```
┌─────────────────────────────────────┐
│  Electron Main Process (Node.js)    │
│  ・MIDI入力 (node-midi)              │
│  ・ファイルI/O                        │
│  ・IPC Handler                      │
└────────────────┬────────────────────┘
                 │ IPC (contextBridge)
┌────────────────▼────────────────────┐
│  Renderer Process (Chromium)        │
│  ・React UI                         │
│    ├ ScoreRenderer (OSMD)           │
│    ├ PianoKeyboard (Canvas)         │
│    └ Toolbar / Controls             │
│  ・Practice Engine (正誤判定)        │
│  ・Annotation Store                  │
│  ・Audio Engine (Tone.js)           │
│                                     │
│  [Web Worker]                       │
│  └ Fingering Engine (DP Solver)     │
└─────────────────────────────────────┘
```

### 運指エンジンについて

Python/music21 に依存せず、**TypeScript のみで実装**した独自運指エンジンを搭載。  
[Parncutt & Terzuolo (1997)](https://doi.org/10.2307/40285402) の動的計画法モデルに基づき、
スパン制約・親指くぐり・弱指コストなど8種のコスト関数で最適運指を計算します。
Web Worker 上で非同期実行するため、計算中もUIは 60fps を維持します。

### 再生音色（グランドピアノ）のサンプル音源について

グランドピアノ音色（既定の再生音色）は **Salamander Grand Piano V3**
（[Alexander Holm](https://archive.org/details/SalamanderGrandPianoV3) 制作、
CC-BY 3.0）のサンプルを間引いて同梱しています。

- クレジット表記: **Salamander Grand Piano V3 by Alexander Holm (CC-BY 3.0)**
- 同梱ファイル: `src/renderer/src/assets/samples/salamander/*.mp3`
  （短3度間隔 A/C/D#/F# × 各オクターブ、A0〜C8の計30ファイル、単一ベロシティレイヤー、
  合計約2MB）
- 取得元: [Tone.js公式が配布する変換済みmp3](https://tonejs.github.io/audio/salamander/)
  （Internet Archive上の元配布物をTone.js側が変換・ホストしているもの。開発時に一回
  ダウンロードして同梱しており、アプリ自体はビルド後もオフラインで動作します）
- コード本体（本リポジトリのソース）はMITライセンスですが、上記の同梱音源のみ
  CC-BY 3.0（要クレジット表記）が適用されます。詳細は
  [docs/sdd/design/decisions/DEC-006.md](docs/sdd/design/decisions/DEC-006.md) を参照

---

## ライセンス

MIT

（同梱のSalamanderピアノサンプル音源のみCC-BY 3.0。上記「再生音色について」参照）
