# keyflow — MusicXML ピアノ練習アプリ

[English](./README.md) | 日本語

MusicXMLファイルを読み込み、MIDI入力で練習できるデスクトップアプリ。
Synthesia / Piano Marvel ライクな体験を、自分の楽譜で実現します。

> **ステータス**: プレリリース段階 — v0.1.0 リリース候補を公開中

---

## 主な機能

| 機能                  | 説明                                                         |
| --------------------- | ------------------------------------------------------------ |
| 🎼 MusicXMLインポート | `.xml` / `.musicxml` / `.mxl` ファイルを読み込んで五線譜表示 |
| 🤚 右手・左手分離練習 | 右手のみ / 左手のみ / 両手モードを切替                       |
| 🎹 MIDI正誤判定       | MIDIキーボードの入力を楽譜と照合してリアルタイム判定         |
| 💡 光るキーガイド     | 次に押すべき鍵盤を画面上で視覚的にガイド                     |
| ⏱️ テンポ調整         | 20%〜200% の範囲でテンポを変えて練習                         |
| 🔁 A-Bループ          | 苦手な小節範囲を指定して繰り返し練習                         |
| ✍️ 運指メモ           | 楽譜上の音符に指番号・コメントを書き込んで保存               |
| 🤖 運指提案           | Parncutt-Terzuolo 動的計画法モデルによる運指の自動提案       |

---

## 動作環境

| 項目             | 要件                                                                        |
| ---------------- | --------------------------------------------------------------------------- |
| OS               | Windows 10 / 11（Phase 1）、macOS 12+（パッケージビルドあり・未署名）       |
| MIDI             | USB/Bluetooth MIDIキーボード（任意）                                        |
| インストール要否 | **追加ランタイム不要** — インストーラー (.exe) の実行または .dmg を開くだけ |

> Node.js・Pythonなどの追加インストールは一切不要です。

---

## リリース成果物の完全性検証

GitHub Releaseに添付される成果物（.exe / .dmg / .zip）は、次の2通りで完全性を検証できます。
なおコード署名・公証は現時点で未対応のため、初回起動時にOSの警告が出ます（既知の制約）。

### SHA256チェックサム

各Releaseに `SHA256SUMS.txt` を添付しています。成果物と同じフォルダにダウンロードし、照合してください。

```bash
# Linux
sha256sum -c SHA256SUMS.txt

# macOS（sha256sum が無いため shasum を使う）
shasum -a 256 -c SHA256SUMS.txt
```

```powershell
# Windows (PowerShell): 算出したハッシュを SHA256SUMS.txt の期待値と目視で比較する
Get-FileHash .\keyflow.Setup.<version>.exe -Algorithm SHA256
Get-Content .\SHA256SUMS.txt
```

### ビルド来歴証明（build provenance attestation）

成果物にはGitHub Actionsが生成した来歴証明（provenance）が付与されます。
どのワークフロー・コミットから生成されたかを次のコマンドで検証できます。

```bash
gh attestation verify <ダウンロードしたファイル> --repo windschord/keyflow
```

---

## 技術スタック

```
Electron               デスクトップフレームワーク（Node.jsをバンドル）
React 18 + TypeScript  UI + 全ビジネスロジック
Vite (electron-vite)   ビルドツール
OpenSheetMusicDisplay  MusicXML → 五線譜レンダリング
Web MIDI API           MIDI入力（Rendererプロセスで直接処理）
Tone.js                音声合成（再生音色・メトロノーム）
Zustand v4             グローバル状態管理
Web Worker             運指DP計算（UIブロックなし）
electron-builder       Windows NSISインストーラー / macOS dmg+zip 生成
Vitest                 ユニット・統合テスト
Playwright             実ビルドを起動するE2Eテスト
```

---

## 開発手順

### 前提条件

- Node.js 20.19+ または 22.12+（開発者のみ必要。エンドユーザーは不要）
- npm 9+

### セットアップ

```bash
git clone https://github.com/windschord/keyflow.git
cd keyflow
npm install          # postinstall で Electron バイナリを取得
npm run dev          # 開発サーバー起動
```

### 主要コマンド

```bash
npm run dev           # 開発モード（ホットリロード）
npm run build         # プロダクションビルド
npm run build:win     # Windows NSISインストーラー生成
npm run build:mac     # macOSパッケージビルド（dmg/zip、arm64+x64）
npm run test          # ユニットテスト
npm run test:coverage # カバレッジレポート
npm run test:e2e      # 実起動E2Eテスト（Playwright for Electron。先に `npm run build` が走る）
npm run lint          # Lintチェック
npm run typecheck     # TypeScript型チェック
```

### 開発モードでの表示について（US-011、TASK-080）

`npm run dev` で起動した開発モードは、正式なアプリ名・アイコンの一部がElectron本体の
既定値のまま表示される。Dockアイコン（macOS）は`app.dock.setIcon()`により開発モードでも
独自アイコン（ピアノ+八分音符）が適用されるが、メニューバーのアプリ名（macOS上部の
アプリケーションメニュー名）は開発モードのElectronバイナリ由来のため変更できない
（Electronの既知の制約）。正式な見た目（アプリ名・全アイコン）は`npm run build:mac`等の
パッケージビルド版で確認すること。

### リリース前チェック（TASK-084）

macOS向けリリース前は`npm run build:mac`でパッケージビルドした後、実バイナリの
起動スモークテスト`npm run test:packaged`を実行し、メインウィンドウが表示されることを確認する。

### リリース手順（メンテナ向け）

リリースはタグのpushで自動化されている（`.github/workflows/release.yml`）。手順は以下のとおり。

1. **事前確認**: mainが緑（CI通過）で、`npm run build:mac` → `npm run test:packaged` のスモークが通ること（上記「リリース前チェック」）。
2. **タグを打ってpush**（`v` プレフィックス必須。これがワークフローのトリガー）:

   ```bash
   git checkout main && git pull
   git tag v0.1.0
   git push origin v0.1.0
   ```

3. **ワークフローの通し確認**: `build-windows` / `build-macos` / `release` の3ジョブが実行される。ビルド2ジョブは成果物へビルド来歴証明（attestation）を付与し、`release` ジョブが全成果物と `SHA256SUMS.txt` を単一のGitHub Releaseへ添付する。

   ```bash
   gh run watch                        # 実行中ジョブの進捗を追う
   gh run list --workflow=release.yml  # 3ジョブの成否を一覧確認
   ```

4. **成果物の検証**: 添付物が揃っていること（Windows .exe、macOS .dmg×2 / .zip×2、`SHA256SUMS.txt`）を確認し、来歴証明とチェックサムを検証する。

   ```bash
   gh release download v0.1.0 -D ./verify   # 成果物とSHA256SUMS.txtをまとめて取得
   cd verify
   for f in *.exe *.dmg *.zip; do            # 全成果物（.exe/.dmg/.zip）の来歴証明を検証
     gh attestation verify "$f" --repo windschord/keyflow
   done
   shasum -a 256 -c SHA256SUMS.txt          # Linuxは sha256sum -c
   ```

コード署名・公証は未対応（`electron-builder.yml` の `identity: null`）。初回起動時のOS警告は既知の制約。
検証用のプレリリースを試す場合は `v0.1.0-rc.1` のようなSemVerプレリリース識別子（ハイフン付き）のタグを使う。
ワークフローがハイフン付きタグを自動でプレリリースとしてマークするため、通常版のlatestには露出しない。

---

## ドキュメント

設計ドキュメント（SDD）は `docs/sdd/` 以下に格納されています（日本語）。

```
docs/sdd/
├── requirements/   要件定義（US-001〜009, NFR）
├── design/         技術設計書（アーキテクチャ・コンポーネント・スキーマ）
└── tasks/          実装タスク計画
```

AIエージェントが作業する場合は [CLAUDE.md](./CLAUDE.md) を参照してください。

---

## アーキテクチャ概要

```
┌─────────────────────────────────────┐
│  Electron Main Process (Node.js)    │
│  ・ファイルI/O（読み取りallowlist）    │
│  ・設定管理 (electron-store)         │
│  ・IPC Handler                      │
└────────────────┬────────────────────┘
                 │ IPC (contextBridge)
┌────────────────▼────────────────────┐
│  Renderer Process (Chromium)        │
│  ・React UI                         │
│    ├ ScoreRenderer (OSMD)           │
│    ├ PianoKeyboard (Canvas)         │
│    └ Header / Controls              │
│  ・MIDI入力 (Web MIDI API)           │
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
- コード本体（本リポジトリのソース）はApache License 2.0ですが、上記の同梱音源のみ
  CC-BY 3.0（要クレジット表記）が適用されます。詳細は
  [docs/sdd/design/decisions/DEC-006.md](docs/sdd/design/decisions/DEC-006.md) を参照

---

## ライセンス

Apache License 2.0（[LICENSE](./LICENSE)参照）

（同梱のSalamanderピアノサンプル音源のみCC-BY 3.0。上記「再生音色について」参照）
