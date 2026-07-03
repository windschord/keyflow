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

- [ ] `npm run build:win` が成功してNSISインストーラー(.exe)が生成される
- [ ] インストーラー実行後にアプリが起動できる（手動確認）
- [ ] アプリ起動後にNode.js不要でMIDI機能が動作する（node-midiがバンドルされている）
- [ ] インストーラーサイズが200MB以下（目標: ~120MB）

**依存関係**: Phase 6完了
