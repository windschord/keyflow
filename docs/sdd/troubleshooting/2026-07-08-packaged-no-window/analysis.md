# パッケージ版でメインウィンドウが表示されない問題の分析（2026-07-08）

## 問題事象

| 項目 | 内容 |
|------|------|
| 現象 | dmg版（keyflow-0.1.0-arm64.dmg）インストール後、メニューバーのアプリ名「keyflow」は表示されるがメインウィンドウが表示されない |
| 期待動作 | 起動時にメインウィンドウが表示される |
| 再現手順 | dmgからインストール → 起動（ローカルの `dist-electron/mac-arm64/keyflow.app` 直接起動でも再現） |
| 発生環境 | パッケージ版のみ。開発モード・E2E（out/main/index.js直接起動）は正常 |
| 報告 | 2026-07-08 ユーザー実機確認 |

## 根本原因

TASK-080で追加した `applyDockIcon`（`src/main/index.ts:58`）が、パッケージ版でapp.asar内のパス（`app.asar/resources/icon.png`）に対して `dock.setIcon()` を呼び、画像読み込み例外を送出する。この呼び出しは `createWindow()`（`index.ts:190`）より前にある。そのため`app.whenReady().then(...)` 内の例外がUnhandledPromiseRejectionとなる。結果として後続処理（メニュー設定・IPCハンドラ登録・ウィンドウ生成）がすべて中断される。

### 実バイナリでの裏付け

`./dist-electron/mac-arm64/keyflow.app/Contents/MacOS/keyflow` をターミナルから起動:

```
UnhandledPromiseRejectionWarning: Error: Failed to load image from path
'/…/keyflow.app/Contents/Resources/app.asar/resources/icon.png'
    at applyDockIcon (app.asar/out/main/index.js:233:8)
```

### 開発モード・E2Eで発現しない理由

`?asset` importの解決先が生ファイルシステム上の実在パスとなり、画像読み込みが成功するため。パッケージ版のみasar内パスとなり、macOSのネイティブ画像ローダーがasarを読めず失敗する。

### テストギャップ（すり抜けた理由）

E2Eは `out/main/index.js` を直接起動しており、**パッケージ版（asar構成）の起動スモークテストが存在しなかった**。TASK-080の「常時呼んでも害はない」という設計判断が誤りで、パッケージ環境での検証がなかった。

## 仕様との照合

- REQ-011-002（Dockアイコン）: 開発モード向けの補完機能が、本来icnsで充足済みのパッケージ版を壊した。**実装バグ**
- 起動堅牢性: 装飾的な処理（アイコン設定）の失敗がウィンドウ生成を道連れにする構造自体も問題

## 修正方針の選択肢

| 案 | 内容 | 評価 |
|----|------|------|
| A) dev限定化+例外防御+起動順序の是正（推奨） | (1) `applyDockIcon` を開発モード時のみ呼ぶ（パッケージ版はicns自動適用のため不要） (2) `applyDockIcon` 内部をtry/catchし、失敗時はwarnログのみで継続（装飾処理でウィンドウ生成を止めない） (3) `createWindow()` を装飾的な処理より前に移動し、起動の主目的を最優先にする | 再発防止の三重防御。変更はmain配下に閉じる |
| B) asarUnpackでicon.pngを展開 | electron-builder設定で解決 | パッケージ版では不要な処理のために設定が増える。例外時の脆弱性は残る |
| C) dev限定化のみ | 最小変更 | 将来createWindowより前に別の例外源が入ると同型の事故が再発する |

いずれの案でも、パッケージ版の起動スモークテスト（アプリ起動→ウィンドウ出現の確認）を追加してテストギャップを塞ぐ。

## 修正タスク

- [TASK-084](../../tasks/phase-15/TASK-084.md): 方針A（ユーザー承認済み、2026-07-08）で修正
