# TASK-102: LibraryView（一覧・検索・並べ替え・削除・空状態・i18n）

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-102 |
| タイプ | feat（US-017） |
| ステータス | TODO |
| 優先度 | High |
| 見積もり | 90分 |
| 依存タスク | TASK-101 |

## 背景

US-017のライブラリ画面UI。設計は
[design/components/score-library.md](../../design/components/score-library.md) の
「UI仕様」を正とする。文言はi18n対応（REQ-017-011、`library`名前空間）。

## 実装内容

### 新規ファイル

- `src/renderer/src/components/LibraryView/index.tsx`
  - マウント時に `electronAPI.library.getAll()` で一覧を取得
  - 一覧: タイトル・作曲者・最終利用日時（ロケール表示）。行クリックで開く
    （開く処理自体はpropsコールバック `onOpenEntry(path)` に委ねる。結線はTASK-103）
  - 検索欄: タイトル・作曲者の部分一致（小文字化して比較、REQ-017-004）
  - 並べ替え: タイトル/登録日時/最終利用日時 × 昇降順。既定は最終利用日時の降順（REQ-017-005）
  - 削除: 行の削除ボタン→アプリ内確認UI→`electronAPI.library.remove`→一覧更新（REQ-017-006）
  - 空状態: 案内文と「ファイルを開く」ボタン（propsコールバック `onOpenFileDialog`）
  - 欠損表示: props経由で渡される欠損path集合（またはローカルstate）の行へ
    欠損マークを表示（REQ-017-008の表示部分。検出はTASK-103）
- `src/renderer/src/components/LibraryView/LibraryView.test.tsx`

### 既存ファイルの変更

- `src/renderer/src/store/slices/ui-slice.ts`: `activeView: 'score' | 'library'`
  （初期値 `'library'`）と `setActiveView` を追加
- `src/renderer/src/lib/i18n/ja.ts` / `en.ts`: `library`名前空間の文言を追加
  （見出し・検索プレースホルダ・並べ替えラベル・削除確認・空状態・欠損ラベル等）

### 注意事項

- 検索・並べ替え・日時フォーマットはコンポーネント外の純関数へ切り出してユニットテスト可能にする
- ソートは安定・localeCompare使用（日本語タイトルの順序）
- getByRoleで検証しやすいセマンティクス（table/listとbutton・searchbox等のrole）を持たせる
- App.tsxへの組み込み（表示切り替え・開くフローの結線）はTASK-103のスコープ

## 実装手順（TDD）

1. 純関数（filter/sort）とコンポーネントのテストを先に作成し失敗を確認、テストをコミット
2. 実装してテストを通す（IPCはvi.mockでモック）
3. 全チェック（test/typecheck/lint/lint:jp/format:check）通過を確認しコミット

## 受入基準

- [ ] 一覧がタイトル・作曲者・最終利用日時を表示する（REQ-017-003）
- [ ] 検索で部分一致絞り込み（大文字小文字区別なし）ができる（REQ-017-004）
- [ ] 3条件×昇降順の並べ替えができ、既定が最終利用日時の降順（REQ-017-005）
- [ ] 削除が確認UIを経由し、ライブラリからのみ削除される（REQ-017-006）
- [ ] 空状態の案内とファイルを開く導線が表示される
- [ ] 文言がja/en両対応（言語enでの表示テストあり、REQ-017-011）
- [ ] 全チェック通過

## テスト項目

- [ ] filter純関数: タイトル/作曲者の部分一致・大文字と小文字の非区別・空クエリで全件
- [ ] sort純関数: 各キー×昇降順・安定性
- [ ] 一覧表示・行クリックでonOpenEntryが呼ばれる
- [ ] 削除ボタン→確認→remove呼び出し→一覧から消える
- [ ] 空状態表示とonOpenFileDialog呼び出し
- [ ] 言語enで見出し・ボタンが英語になる
