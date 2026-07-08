# TASK-080: 開発モードのDockアイコン適用とブランディング制約の明文化

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-080 |
| タイプ | feature |
| ステータス | REVIEW |
| 優先度 | Medium |
| 見積もり | 20分 |
| 依存タスク | TASK-068 |

## 背景

2026-07-08のユーザー実機フィードバック「アイコンとアプリ名がデフォルトから変わっていない」。確認環境は `npm run dev`（ユーザー回答）。

- macOSの開発モードでは、Dockアイコンとメニューバーのアプリ名がElectronバイナリの`Info.plist`由来となる
- メニューバー名は開発モードでは変更不可（macOS/Electronの既知の制約。パッケージ版では`productName`が反映される）
- **Dockアイコンは `app.dock.setIcon()` で開発モードでも変更可能** → 本タスクで対応する

## 実装内容

### 修正対象

| ファイル | 変更内容 |
|---------|---------|
| `src/main/index.ts`（または`window-options.ts`の隣に新関数） | macOSかつ`app.dock`が存在する場合、起動時に `app.dock.setIcon(resources/icon.png)` を呼ぶ。パッケージ版ではicnsが適用されるため開発モードのみで十分だが、常時呼んでも害はない（実装しやすい方でよい。テスト可能な純関数に切り出すこと） |
| `README.md` | 開発モードでの表示制約（メニューバー名はElectronのまま、Dockアイコンは適用済み、正式な見た目はパッケージ版で確認）を開発者向けセクションに1段落追記 |
| `docs/sdd/requirements/stories/US-011.md` | 備考の「開発モードのDockアイコンはデフォルト許容」を「Dockアイコンは開発モードでも適用（TASK-080）。メニューバー名のみ制約として許容」に更新 |
| テスト | dock setIcon呼び出しの結線テスト（プラットフォーム分岐を含む純関数のユニットテスト。window-options.test.tsの既存パターンに倣う） |

### 実装手順（TDD）

1. dock icon適用関数のテスト作成（Red→コミット）: darwinかつdock存在時にsetIconがicon.pngパスで呼ばれる / 非darwinでは呼ばれない
2. 実装 → Green → ドキュメント更新 → 全ゲート → コミット

## 受入基準

- [ ] `npm run dev` でDockに独自アイコン（ピアノ+八分音符）が表示される（ユーザー実機確認、未確認のためREVIEW）
- [x] 非macOS環境でエラーにならない（ユニットテストで分岐検証）
- [x] README・US-011に制約が明文化されている
- [x] 全ゲート通過（test / typecheck / lint / format:check / lint:jp）

## 完了サマリー（2026-07-08）

`applyDockIcon`（`src/main/dock-icon.ts`）を新設し、darwinかつ`app.dock`が
存在する場合のみ`resources/icon.png`でDockアイコンを設定するようにした。
`src/main/index.ts`の`app.whenReady()`内、`setAppUserModelId`の直後で呼び出す。
README・US-011・app-branding.mdへ、開発モードの表示制約
（メニューバー名の変更不可・Dockアイコンの適用済み）を明文化した。
全ゲート（test 718件 / typecheck / lint / format:check / lint:jp / test:e2e 3件）が通過した。
macOS実機でのDockアイコン目視確認はユーザー環境（npm run dev）での確認が必要なため、
該当受入基準のみ未チェックのままREVIEWとする。

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | 確認環境はnpm run dev（ユーザー回答、2026-07-08） |
| 設計判断として決定 | app.dock.setIcon方式、メニューバー名は制約として許容（開発モードのみ） |

## 対応要件

REQ-011-002（開発モードでの充足範囲の拡大）
