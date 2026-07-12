# TASK-101: LibraryServiceとlibrary:* IPC（Main側・preload公開）

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-101 |
| タイプ | feat（US-017） |
| ステータス | DONE |
| 優先度 | High |
| 見積もり | 90分 |
| 依存タスク | なし |

## 背景

US-017（楽譜ライブラリ）のMain側基盤。設計は
[design/components/score-library.md](../../design/components/score-library.md) と
[DEC-010](../../design/decisions/DEC-010.md) を正とする。

## 実装内容

### 新規ファイル

- `src/main/library.ts`: `LibraryService`
  - electron-store（ストア名 `library`、`name`オプション指定）で `{ entries: LibraryEntry[] }` を永続化
  - `LibraryEntry = { path, title, composer, addedAt, lastOpenedAt }`（pathが一意キー）
  - `getAll()`: 読み込み時にフェイルソフト検証（path非空文字列必須で不正要素は除外、
    title/composer非文字列は空文字へ正規化、日時非文字列は現在時刻へ正規化、
    entries非配列は空扱い。TASK-092と同方針）
  - `upsert({path, title, composer})`: 既存pathはtitle/composer/lastOpenedAtを更新、
    新規はaddedAtも記録
  - `remove(path)`: エントリ削除（ファイル本体・アノテーションは触らない）
  - テスト用に `cwd` オプションを受ける（SettingsServiceと同パターン）
- `src/main/library-handlers.ts`: IPCハンドラのファクトリ（file-handlers.tsと同パターン）
  - `library:get-all` / `library:upsert` / `library:remove` / `library:open`
  - `library:open(path)`: 拡張子検証（.xml/.musicxml/.mxl）→ファイル存在確認→
    `PathAllowlist.allowMusicXml`登録→recentFiles追加→`{ok: true}`。
    存在しない場合は`{ok: false, reason: 'not-found'}`、拡張子不正は
    `{ok: false, reason: 'invalid-extension'}` を返す（例外で落とさない）

### 既存ファイルの変更

- `src/main/index.ts`: ハンドラ登録の結線（既存のfile-handlers登録箇所と同様）
- `src/preload/index.ts`: `electronAPI.library.{getAll, upsert, remove, open}` を公開
  （contextIsolated/非isolatedの両分岐に追加。既存のfile/settingsと同じ形）
- Renderer型定義（`window.electronAPI`の型がある場所）へlibrary APIの型を追加

## 実装手順（TDD）

1. テスト作成: `library.test.ts`（upsert新規/更新・remove・フェイルソフト検証）、
   `library-handlers.test.ts`（openの検証・allowlist/recent結線・not-found/invalid-extension）
2. `npm run test` で失敗を確認しテストをコミット
3. 実装してテストを通す
4. 全チェック（test/typecheck/lint/lint:jp/format:check）通過を確認しコミット

## 受入基準

- [x] LibraryServiceがupsert/remove/getAllを提供し再起動相当（再インスタンス化）で復元する（REQ-017-009）
- [x] upsertが重複pathで登録せず更新する（REQ-017-002）
- [x] getAllのフェイルソフト検証（不正要素除外・正規化）が機能する
- [x] library:openが拡張子検証・存在確認・allowlist登録・recent追加を実施し、失敗理由を構造化して返す（REQ-017-007/008の前段）
- [x] preloadからlibrary APIが公開されている
- [x] 全チェック通過

## テスト項目

- [x] upsert: 新規追加でaddedAt/lastOpenedAtが記録される
- [x] upsert: 既存pathでtitle/composer/lastOpenedAt更新・addedAt維持・件数不変
- [x] remove: 対象のみ削除される
- [x] getAll: 不正要素（path欠落等）の除外、entries非配列で空
- [x] library:open: 正常系でallowlist登録+recent追加が呼ばれる（結線）
- [x] library:open: 存在しないファイルでnot-found、不正拡張子でinvalid-extension

## 完了サマリー

- 新規: `src/main/library.ts`（LibraryService）、`src/main/library-handlers.ts`
  （library:* IPCハンドラのファクトリ）、`src/renderer/src/types/library.ts`
  （renderer側独立型）、対応するテスト2ファイル
- 変更: `src/main/index.ts`（ハンドラ登録）、`src/preload/index.ts`
  （contextIsolated/非isolated両分岐にelectronAPI.library追加）、
  `src/renderer/src/types/{index,electron-api.d}.ts`（型公開）
- IPCチャンネル: `library:get-all`（成功: LibraryEntry[]）、`library:upsert`
  （成功: void。既存pathはtitle/composer/lastOpenedAt更新・新規はaddedAt記録）、
  `library:remove`（成功: void）、`library:open`（成功: `{ok:true}`。失敗:
  `{ok:false,reason:'not-found'|'invalid-extension'}`、例外は投げない）
- テスト: library.test.ts 8件、library-handlers.test.ts 8件（新規16件）、
  全体854件（62ファイル）すべて成功
- チェック結果: test/typecheck/lint/lint:jp/format:check すべて成功
- コミット: テスト先行 `13fcfbc`、実装 `acebba1`
- 未解決事項: なし（TASK-102のLibraryView実装はスコープ外のため本タスクでは着手していない）
