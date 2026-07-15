# 要件定義 — MusicXMLピアノ練習アプリ

## 概要

MusicXMLファイルに対応したデスクトップピアノ練習アプリケーション。
MIDI入力による正誤判定・運指提案・繰り返し練習機能を備え、
SynthesiaやPiano Marvelに匹敵する練習体験を実現する。

**対象ユーザー**: ピアノ練習者（初心者〜上級者）
**プラットフォーム**: Windows 10/11（Phase 1）、macOS 12+（Phase 2）
**技術スタック**: Electron + React/TypeScript（UI・運指エンジン含む全機能）、外部ランタイム依存なし

---

## ユーザーストーリー一覧

| ID | タイトル | 優先度 | ステータス | 詳細リンク |
|----|---------|--------|-----------|------------|
| US-001 | MusicXMLファイルのインポート | 高 | 承認済 | [詳細](stories/US-001.md) @stories/US-001.md |
| US-002 | 楽譜の表示とスクロール | 高 | 承認済 | [詳細](stories/US-002.md) @stories/US-002.md |
| US-003 | 右手/左手分離練習 | 高 | 承認済 | [詳細](stories/US-003.md) @stories/US-003.md |
| US-004 | MIDI入力と正誤判定 | 高 | 承認済 | [詳細](stories/US-004.md) @stories/US-004.md |
| US-005 | 画面鍵盤ガイド（光るキーガイド） | 高 | 承認済 | [詳細](stories/US-005.md) @stories/US-005.md |
| US-006 | テンポ調整 | 高 | 承認済 | [詳細](stories/US-006.md) @stories/US-006.md |
| US-007 | 繰り返し練習（ループ範囲設定） | 高 | 承認済 | [詳細](stories/US-007.md) @stories/US-007.md |
| US-008 | 運指メモの書き込み | 中 | 承認済 | [詳細](stories/US-008.md) @stories/US-008.md |
| US-009 | 運指提案 | 中 | 承認済 | [詳細](stories/US-009.md) @stories/US-009.md |
| US-010 | 曲の再生（お手本演奏） | 高 | 承認済 | [詳細](stories/US-010.md) @stories/US-010.md |
| US-011 | アプリのブランディング（アイコン・タイトル） | 中 | 定義済 | [詳細](stories/US-011.md) @stories/US-011.md |
| US-012 | ヘッダーの1行集約と操作の再分類 | 高 | 定義済 | [詳細](stories/US-012.md) @stories/US-012.md |
| US-013 | 再生音色・メトロノーム音色の選択 | 高 | 定義済 | [詳細](stories/US-013.md) @stories/US-013.md |
| US-014 | ペダル記号の再生反映 | 中 | 定義済 | [詳細](stories/US-014.md) @stories/US-014.md |
| US-015 | Aboutページ（バージョン・ライセンス表示） | 中 | 定義済 | [詳細](stories/US-015.md) @stories/US-015.md |
| US-016 | UIの多言語対応（日本語・英語切り替え） | 中 | 定義済 | [詳細](stories/US-016.md) @stories/US-016.md |
| US-017 | 楽譜ライブラリ（一覧管理画面） | 高 | 定義済 | [詳細](stories/US-017.md) @stories/US-017.md |
| US-018 | Windowsの配布形態拡充（arm64対応・インストール不要版） | 中 | 定義済 | [詳細](stories/US-018.md) @stories/US-018.md |

---

## 機能要件サマリ

| 要件ID | 概要 | 関連ストーリー | ステータス |
|--------|------|---------------|-----------|
| REQ-001 | MusicXML(.xml/.mxl)のインポートと解析 | US-001 | 定義済 |
| REQ-002 | 五線譜形式の楽譜レンダリング（OSMD使用） | US-002 | 定義済 |
| REQ-003 | 右手/左手/両手の練習モード切替 | US-003 | 定義済 |
| REQ-004 | MIDI入力の10ms以内リアルタイム正誤判定 | US-004 | 定義済 |
| REQ-005 | 画面上88鍵盤の光るキーガイド | US-005 | 定義済 |
| REQ-006 | テンポ20%〜200%の範囲調整・メトロノーム | US-006 | 定義済 |
| REQ-007 | A-Bループ（小節範囲の繰り返し練習） | US-007 | 定義済 |
| REQ-008 | 運指番号・コメントのアノテーション書き込み | US-008 | 定義済 |
| REQ-009 | TypeScript独自実装エンジンによる運指提案（Parncutt-TerzuoloモデルDP） | US-009 | 定義済 |
| REQ-010 | 楽曲全体の再生・一時停止・停止（お手本演奏、カーソル連動） | US-010 | 定義済 |
| REQ-011 | 独自アイコン（全OS形式）とウィンドウタイトルの設定 | US-011 | 定義済 |
| REQ-012 | ヘッダー1行化（約48px）と低頻度操作のポップオーバー移設 | US-012 | 定義済 |
| REQ-013 | 再生音色（Salamanderピアノ+シンセ）・メトロノーム音色（4種）の選択と永続化 | US-013 | 定義済 |
| REQ-014 | ペダル記号（`<pedal>`）の解析と再生時のリリース延長 | US-014 | 定義済 |
| REQ-015 | Aboutページ（バージョン・本体/ライブラリ/音源ライセンス表示） | US-015 | 定義済 |
| REQ-016 | UI表示言語の日英切り替え（OSロケール自動判定・即時切替・永続化） | US-016 | 定義済 |
| REQ-017 | 楽譜ライブラリ（自動登録・一覧・検索・並べ替え・削除・永続化） | US-017 | 定義済 |
| REQ-018 | Windows配布形態の拡充（x64/arm64・NSIS/portable・完全性検証対象） | US-018 | 定義済 |

---

## 非機能要件一覧

| カテゴリ | 詳細リンク | 主要要件 |
|----------|------------|---------|
| 性能要件 | [詳細](nfr/performance.md) @nfr/performance.md | MIDI遅延<10ms、楽譜描画<3秒 |
| ユーザビリティ要件 | [詳細](nfr/usability.md) @nfr/usability.md | 3クリック以内、日本語UI、高DPI対応 |
| 互換性・移植性要件 | [詳細](nfr/compatibility.md) @nfr/compatibility.md | Windows10/11（Phase1）、macOS（Phase2） |

---

## 依存関係（全てアプリにバンドル、別途インストール不要）

- **OpenSheetMusicDisplay (OSMD)**: MusicXMLを楽譜にレンダリングするJSライブラリ
- **Web MIDI API / Electron MIDI binding**: MIDIデバイス入力
- **Tone.js**: 音声合成・再生（伴奏・メトロノーム）
- **独自フィンガリングエンジン（TypeScript）**: Parncutt-Terzuoloモデルに基づくDP実装、Web Worker上で動作
- **Electron v29+**: Node.jsランタイムをバンドル（エンドユーザーのインストール不要）

---

## スコープ外

- Webブラウザ版（デスクトップアプリ専用）
- オンライン楽譜配信サービスとの連携
- 音声認識（マイクからの音符認識）
- 動画録画機能
- Synthesiaスタイルの落下ノートビジュアル（将来の拡張検討）

---

## ドキュメント構成

```
docs/sdd/requirements/
├── index.md                    # このファイル（目次）
├── stories/
│   ├── US-001.md              # MusicXMLインポート
│   ├── US-002.md              # 楽譜表示
│   ├── US-003.md              # 右手/左手分離練習
│   ├── US-004.md              # MIDI入力と正誤判定
│   ├── US-005.md              # 画面鍵盤ガイド
│   ├── US-006.md              # テンポ調整
│   ├── US-007.md              # 繰り返し練習
│   ├── US-008.md              # 運指メモ書き込み
│   ├── US-009.md              # 運指提案
│   ├── US-010.md              # 曲の再生（お手本演奏）
│   ├── US-011.md              # アプリのブランディング（アイコン・タイトル）
│   ├── US-012.md              # ヘッダーの1行集約と操作の再分類
│   ├── US-013.md              # 再生音色・メトロノーム音色の選択
│   ├── US-014.md              # ペダル記号の再生反映
│   ├── US-015.md              # Aboutページ（バージョン・ライセンス表示）
│   ├── US-016.md              # UIの多言語対応（日本語・英語切り替え）
│   ├── US-017.md              # 楽譜ライブラリ（一覧管理画面）
│   └── US-018.md              # Windowsの配布形態拡充（arm64・portable）
└── nfr/
    ├── performance.md          # 性能要件
    ├── usability.md            # ユーザビリティ要件
    └── compatibility.md        # 互換性・移植性要件
```
