# TASK-082: Aboutを設定画面から分離しメニューバーから開く独立モーダルへ

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-082 |
| タイプ | feature |
| ステータス | REVIEW |
| 優先度 | Medium |
| 見積もり | 50分 |
| 依存タスク | TASK-076 |

## 背景

2026-07-08のユーザーフィードバック「Aboutは設定画面とは別にして欲しい」。導線はメニューバー方式で承認済み（macOS: アプリメニュー「MusicXML Piano Practiceについて」、Windows/Linux: ヘルプメニュー「バージョン情報」）。

## 実装内容

### 修正対象

| ファイル | 変更内容 |
|---------|---------|
| `src/main/menu.ts`（新規） | アプリケーションメニューのテンプレート生成を純関数で実装（window-options.tsのパターンに倣いテスト可能に）。標準ロール（編集メニューのコピー/ペースト等、既定メニュー相当）を維持しつつ、macOSはアプリメニュー先頭に「MusicXML Piano Practiceについて」、Windows/Linuxはヘルプメニューに「バージョン情報」を追加。クリックで対象ウィンドウへ `menu:open-about` を送信 |
| `src/main/index.ts` | `app.whenReady()` で `Menu.setApplicationMenu(...)` を設定 |
| `src/preload/index.ts` | `onOpenAbout(callback)`（`menu:open-about` の購読・解除）をcontextBridgeへ追加 |
| `src/renderer/src/components/AboutPanel/AboutModal.tsx`（新規） | 既存AboutPanelを内包する独立モーダル（SettingsModalと同様のオーバーレイ・閉じるボタン・Escape対応） |
| `src/renderer/src/App.tsx` | `isAboutOpen` state + `onOpenAbout` 購読（useEffect内登録・cleanup解除、StrictMode耐性）+ `<AboutModal>` 表示 |
| `src/renderer/src/components/SettingsModal/index.tsx` | 「このアプリについて」セクションを削除 |
| `CLAUDE.md` | IPCチャンネル一覧に `menu:open-about`（Main→Renderer）を追記 |
| 各テスト | menu.tsテンプレートのユニットテスト（プラットフォーム分岐・クリックでsend）、AboutModalコンポーネントテスト、SettingsModalテスト更新（About非表示）、App結線テスト（onOpenAbout→モーダル表示） |
| `tests/e2e/app.spec.ts` | Aboutの検証を「設定モーダル内」から「メニュー経由」へ変更。`electronApp.evaluate` でMain側の `Menu.getApplicationMenu()` から該当項目（idを付与しておく）の `click()` を呼び、実際のメニュー結線でAboutModalが表示されバージョンが見えることを検証 |

### 実装手順（TDD）

1. menu.ts / AboutModal / App結線 / SettingsModal更新のテストを先に作成（Red確認→テストコミット）
2. 実装 → ユニットGreen
3. E2E追随 → `npm run test:e2e` 通過
4. 全ゲート → 実装コミット → CLAUDE.md・タスクステータス更新

## 受入基準

- [x] macOS: アプリメニュー「MusicXML Piano Practiceについて」でAboutモーダルが開く（E2Eのメニュークリック経由で検証）
- [x] 設定モーダルにAboutセクションが存在しない
- [x] Aboutモーダルの内容（バージョン・Apache 2.0・ライブラリ一覧・Salamanderクレジット）が従来どおり表示される（REQ-015全要件の維持）
- [x] 編集メニュー（コピー/ペースト等）の標準操作が失われていない（メニューテンプレートのユニットテストで検証）
- [x] 全ゲート通過（test / typecheck / lint / format:check / lint:jp / test:e2e）
- [ ] ユーザー実機確認（メニューからAboutが開く）

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | Aboutを設定と分離（ユーザー要望）、メニューバー導線（承認済み、2026-07-08） |
| 設計判断として決定 | IPCチャンネル名 `menu:open-about`、AboutModalのモーダル様式、メニュー項目へのid付与（E2E用） |

## 対応要件

REQ-015-001〜005（表示内容の維持）/ US-015（導線変更）
