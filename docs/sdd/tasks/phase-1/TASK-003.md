# TASK-003: electron-builder + node-midi ビルド設定

**ステータス**: DONE
**推定工数**: 40分
**依存**: TASK-002

---

## 説明

`node-midi`（ネイティブアドオン）をElectronで使用するためのビルド設定と、
`electron-builder`によるWindowsインストーラー生成の基本設定をする。

## 技術的文脈

- **参照設計**: [design/decisions/DEC-004.md](../../design/decisions/DEC-004.md)
- `node-midi` はネイティブC++アドオンのため、Electronのバイナリに合わせて再コンパイルが必要

## 実装手順

1. 依存をインストール:
   ```bash
   npm install midi
   npm install -D @electron/rebuild electron-builder
   ```

2. `package.json` の `scripts` に追加:
   ```json
   {
     "postinstall": "electron-rebuild -f -w midi",
     "build:win": "electron-builder --win"
   }
   ```

3. `electron-builder.yml`（または `package.json` の `build` セクション）を作成:
   ```yaml
   appId: com.musicxml.piano-practice
   productName: MusicXML Piano Practice
   directories:
     output: dist-electron
   win:
     target: nsis
   nsis:
     oneClick: false
     allowToChangeInstallationDirectory: true
   files:
     - dist/**/*
     - node_modules/midi/**/*
   ```

4. `npm run postinstall` を実行してnode-midiが再コンパイルされることを確認
5. `npm run build:win` を実行してビルドが通ることを確認（実際のインストーラー生成は Phase 7 で行う）

## 受入基準

- [ ] `node_modules/midi/build/Release/midi.node` が存在する
- [ ] `npm run postinstall` がエラーなく完了する
- [ ] `electron-builder.yml` に Windows NSIS ターゲット設定が含まれる
- [ ] メインプロセスで `import midi from 'midi'` が型エラーなくインポートできる

## トラブルシューティング

- `node-gyp` エラーが出る場合: `npm install -g windows-build-tools` でMSBuild/Python（ビルド用のみ）をインストール
  - ※ これはビルド環境側（開発者PC）へのインストールであり、エンドユーザーには不要

**依存関係**: TASK-002

---

## 実行情報

- **実行方式**: Jules API
- **Jules Session ID**: 17031731207446201803
- **Jules ブランチ名**: feat/TASK-003-electron-builder-node-midi-17031731207446201803
- **PR作成先**: main
- **開始日時**: 2026-07-02 08:17
- **PR番号**: #20
- **PR URL**: https://github.com/windschord/keyflow/pull/20
- **PR作成日時**: 2026-07-02 08:40

## レビュー対応履歴

### [2026-07-02 09:00] CodeRabbit 1回目指摘対応（sendMessage）
- `electron-builder.yml` に `asarUnpack` 追加（ネイティブアドオンのasar外配置）
- `src/main/index.ts` から不要な `import midi` と `console.log(!!midi)` を削除
- `src/main/midi-controller.ts` でmidiモジュールをラップ
- `package.json` に `engines.node: ">=18.0.0"` を追加

### [2026-07-02 09:35] CodeRabbit 2回目指摘対応（sendMessage）
- `midi-controller.ts` のインポート方法修正（デフォルトエクスポートなし問題）
- `new midi.Input()` / `new midi.Output()` を try/catch でラップしてエラーハンドリング追加
