# TASK-099: メニューバーの多言語化と言語変更時の再構築（Main側）

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-099 |
| タイプ | feat（US-016） |
| ステータス | TODO |
| 優先度 | High |
| 見積もり | 60分 |
| 依存タスク | TASK-096 |

## 背景

US-016のREQ-016-004（メニューバー文言の切り替え）とREQ-016-005（起動時適用のMain側）。
Mainプロセスは既存の「main/rendererで定義を独立して持つ」パターンに従い、
メニュー用の小さなja/en辞書を`src/main`側に持つ（DEC-009）。

## 実装内容

### 新規・変更ファイル

- `src/main/locale.ts`（新規）: `resolveLanguage(stored: unknown, osLocale: string): 'ja' | 'en'`。
  Renderer側（TASK-096の`resolve-language.ts`）と同一規則の純関数
- `src/main/menu.ts`:
  - `CreateApplicationMenuTemplateParams` に `language: 'ja' | 'en'` を追加
  - 「{appTitle}について / About {appTitle}」「編集 / Edit」「表示 / View」
    「ウィンドウ / Window」「ヘルプ / Help」のja/en辞書を内部に定義しラベルへ適用
  - 純関数のまま維持する（Electron本体をimportしない既存設計を守る）
- `src/main/index.ts`:
  - 起動時: `settingsService.get('ui').language` と `app.getLocale()` を
    `resolveLanguage` へ通し、解決した言語でメニューを構築
  - `settings:set` ハンドラ: `ui.language` の変更を検知したら
    `Menu.setApplicationMenu(Menu.buildFromTemplate(createApplicationMenuTemplate({...})))`
    で再構築する（REQ-016-004）

### 注意事項

- `role`指定の標準メニュー項目（copy/paste等）はOSが自動でローカライズするため
  ラベル指定不要。カスタムラベルを持つ項目のみ辞書化する
- メニュー再構築時も`onOpenAbout`コールバック等の既存結線を維持する

## 実装手順（TDD）

1. テスト作成: `menu.test.ts` に `language: 'en'` でトップレベルラベルとAbout項目が
   英語になるケースを追加。`locale.test.ts` で解決規則を検証
2. 結線テスト: `settings:set` ハンドラが `ui.language` 変更時にメニュー再構築
   コールバックを呼ぶことを検証する（モック境界の結線テスト原則。ハンドラを
   ファクトリ関数として切り出しテスト可能にする、file-handlers.tsと同じパターン）
3. 失敗確認→実装→通過
4. 全チェック通過を確認しコミット

## 受入基準

- [ ] `language: 'en'` でメニューのカスタムラベルが英語になる
- [ ] 起動時に保存済み言語（またはOSロケール解決）がメニューへ適用される（REQ-016-005）
- [ ] 言語切り替え時にメニューが再構築される（REQ-016-004、結線テストあり）
- [ ] menu.tsが純関数のまま維持されている
- [ ] 全チェック通過

## テスト項目

- [ ] createApplicationMenuTemplate: ja/en両方のラベル生成
- [ ] resolveLanguage（Main側）: Renderer側と同一規則
- [ ] settings:setハンドラの言語変更検知→再構築コールバック呼び出し（結線）
- [ ] 言語変更以外のsettings:setでは再構築されない
