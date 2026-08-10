# 互換性・移植性要件

## 概要

WindowsでのリリースをPhase 1とし、macOSへの対応をPhase 2で実施する。
Electronベースのアーキテクチャにより、同一コードベースでクロスプラットフォーム対応を実現する。

## 要件一覧

| ID | 要件概要 | 優先度 |
|----|---------|--------|
| NFR-C-001 | Windows 10/11対応 | 必須（Phase 1） |
| NFR-C-002 | macOS 12以降対応 | 必須（Phase 2） |
| NFR-C-003 | MusicXML 3.1準拠 | 必須 |
| NFR-C-004 | MIDI規格準拠 | 必須 |
| NFR-C-005 | 主要MIDIデバイス対応 | 推奨 |

## 詳細要件

### NFR-C-001/002: OS対応

- **NFR-C-001**: システムはWindows 10（バージョン1903以降）およびWindows 11で動作しなければならない
  - 対応アーキテクチャ: x64およびarm64（Windows on ARM）。詳細は [US-018](../stories/US-018.md) を参照
- **NFR-C-002**: システムはmacOS 12（Monterey）以降で動作しなければならない
- **NFR-C-001/002共通**: クロスプラットフォーム対応のためElectron v29以降を使用する

### NFR-C-003: MusicXML対応

- **NFR-C-003**: システムはMusicXML 3.1仕様（W3C/MusicXML 4.0仕様書参照）に準拠したファイルを読み込めなければならない
- 対応形式: .xml（非圧縮）および .mxl（MusicXML Compressed）

### NFR-C-004/005: MIDI対応

- **NFR-C-004**: システムはGeneral MIDI規格に準拠したMIDIデバイスと通信できなければならない
- **NFR-C-005**: システムはUSB-MIDI接続された一般的なピアノ・キーボードと動作しなければならない
  - 動作確認対象例: Roland, Yamaha, Kawai の主要モデル

## 配布・インストール要件

- **NFR-C-006**: システムはWindowsではMicrosoft Store経由のMSIX/AppX（x64/arm64）、macOSではDMG/zipとして配布しなければならない。WindowsのStore配布への移行と`.exe`配布の廃止は [US-019](../stories/US-019.md)、その前身のNSIS/portable配布は [US-018](../stories/US-018.md) を参照
- **NFR-C-007**: 自動アップデートの提供方針はプラットフォームごとに異なる
  - **Windows（必須・充足済み）**: Microsoft Storeが更新を管理する。electron-builderのAppXターゲットは`electron-updater`による自動更新に対応しないため、Store側の更新機構に委ねる（[US-019](../stories/US-019.md)）。アプリ側の実装は不要である
  - **macOS（将来要件・Phase 2対象）**: `electron-updater`（Squirrel.Mac）による自動更新を導入する。現時点で未実装であり、**現行リリースの受入要件には含めない**。対応時期はmacOSを正式対応とするPhase 2（[NFR-C-002](#nfr-c-001002-os対応)）とする
- **NFR-C-008**: エンドユーザーはNode.js・Python・その他ランタイムを別途インストールすることなく、アプリを起動して全機能を使用できなければならない
- **NFR-C-009**: アプリのインストーラーはElectronのバンドルNode.jsランタイムを含み、完全に自己完結したパッケージとして配布しなければならない
- **NFR-C-010**: 運指提案を含む全機能は、外部プロセス・外部サービスへの依存なしにアプリ単体で動作しなければならない
