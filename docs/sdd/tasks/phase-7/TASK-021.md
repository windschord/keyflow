# TASK-021: electron-builder設定（Windows NSISインストーラー）

**ステータス**: DONE
**推定工数**: 30分
**依存**: Phase 6

---

## 説明

electron-builderを使ってWindowsのNSISインストーラーを生成する完全な設定をする。
エンドユーザーはNode.js不要で `setup.exe` をダブルクリックするだけでインストールできること。

## 対象ファイル

- `electron-builder.yml` — ビルド設定（既存のものを完成させる）
- `build/icon.ico` — Windowsアイコン（512x512のicoファイルを配置）
- `package.json` — buildスクリプトの最終確認

## 参照設計

- [requirements/nfr/compatibility.md「NFR-C-006〜010」](../../requirements/nfr/compatibility.md)

## electron-builder.yml 最終設定

```yaml
appId: com.musicxml.piano-practice
productName: MusicXML Piano Practice
copyright: Copyright © 2026

directories:
  output: dist-electron
  buildResources: build

win:
  target:
    - target: nsis
      arch: [x64]
  icon: build/icon.ico
  requestedExecutionLevel: asInvoker

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
  installerLanguages: [Japanese, English]

files:
  - dist/**/*
  - node_modules/midi/build/Release/midi.node
  - "!node_modules/**/{CHANGELOG.md,README.md,readme.md}"
  - "!node_modules/**/*.{ts,map}"

extraResources:
  - from: "node_modules/midi/build/Release/"
    to: "midi/build/Release/"
    filter: ["**/*.node"]

publish: null  # Phase 1では自動アップデート不要
```

## 確認事項

```bash
# ビルド前確認
npm run postinstall   # node-midi がビルド済みか確認
npm run build         # Viteビルド

# インストーラー生成
npm run build:win

# 生成物確認
ls dist-electron/
# → "MusicXML Piano Practice Setup X.X.X.exe" が存在すること
```

## 受入基準

> **是正（TASK-036、2026-07-04）**: 本タスクは元々ステータス`DONE`のまま以下4項目が全て未チェックで
> 放置されていた（QA実施の記録が信頼できない状態）。本節はTASK-036の調査時点で実際に確認できた事実
> のみをチェックし、確認できない項目は未チェックのまま根拠・参照を付記する形に是正したものである。
> ステータス欄自体の再判定（DONE取り消し等）はTASK-036のスコープ外とし、行わない。

- [ ] `npm run build:win` が成功してNSISインストーラー(.exe)が生成される
  - 未検証。開発・検証環境はmacOS（darwin）である。Windows実機またはWindows CIランナーでの`npm run build:win`実行記録は存在しない。
    macOS向け同等ビルド（`npm run build:mac`）は[phase-10/TASK-035.md](../phase-10/TASK-035.md)で成功を確認済みである。
    その過程で`electron-builder.yml`の`files`パス誤り・`npmRebuild`設定・`electron`依存区分の3件の既存バグを修正した
    （いずれも`win`セクションにも影響する共通バグのため、修正後は`build:win`成功の見込みは高いものの未実測）。
    Windows実機で検証する専用タスクはPhase 10に存在しない（将来タスク化が必要）。
- [ ] インストーラー実行後にアプリが起動できる（手動確認）
  - 未検証（上記と同じ理由でWindows実機なし）。macOS版の`.app`起動確認は[phase-10/TASK-035.md](../phase-10/TASK-035.md)で実施済み。
- [ ] アプリ起動後にNode.js不要でMIDI機能が動作する（node-midiがバンドルされている）
  - この受入基準自体が設計変更（MIDI入力をWeb MIDI APIに変更、[phase-3/TASK-008.md](../phase-3/TASK-008.md)、
    CLAUDE.md・[decisions/DEC-004.md](../../design/decisions/DEC-004.md)参照）により実態と乖離している。
    現在の実装ではMIDI機能はnode-midiのバンドルに依存せず、RendererのWeb MIDI APIで動作する。
    Web MIDI API経由の実MIDIデバイス動作は、実MIDIデバイスなし環境のため
    [phase-10/TASK-035.md](../phase-10/TASK-035.md)のテスト項目でも「未検証」とされている。
    Windows実機で確認する専用タスクはPhase 10に存在しない（将来タスク化が必要）。
- [ ] インストーラーサイズが200MB以下（目標: ~120MB）
  - 未検証（Windows NSISインストーラー自体が未生成）。参考値として、macOS向け成果物（dmg/zip、arch毎）は
    [phase-10/TASK-035.md](../phase-10/TASK-035.md)の完了サマリーで「各約140MB」と報告されているが、
    パッケージ形式・OSが異なるため直接の代替確認とはみなさない。

**依存関係**: Phase 6完了
