# TASK-103: ライブラリ統合（自動登録・開くフロー・画面切り替え・欠損処理）

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-103 |
| タイプ | feat（US-017） |
| ステータス | DONE |
| 優先度 | High |
| 見積もり | 90分 |
| 依存タスク | TASK-101, TASK-102 |

## 背景

US-017の結線タスク。LibraryView（TASK-102）とlibrary IPC（TASK-101）を
App.tsx・Headerへ統合し、ユーザーが使える機能として完成させる。
設計は [design/components/score-library.md](../../design/components/score-library.md) の
「データフロー」を正とする。

## 実装内容

### 自動登録（REQ-017-001/002）

- `App.tsx` のopenFile成功点（パース完了しScoreを得た直後）で
  `electronAPI.library.upsert({ path, title, composer })` を呼ぶ
- titleは `score.title`、欠落時はファイル名（拡張子除く）。composerはScoreに
  フィールドがあれば使用、なければMusicXMLパース結果から取得できる範囲で。
  取得不能なら空文字（パーサへのcomposer抽出追加が必要ならスコープに含める）
- ダイアログ・D&D・ライブラリ経由のすべてが同じ成功点を通ることを確認する

### 画面切り替え（REQ-017-010）

- `App.tsx`: `activeView === 'library'` でLibraryViewを表示（初期値'library'のため
  起動時はライブラリ画面。楽譜を開くと`setActiveView('score')`）
- `Header`: ライブラリボタンを追加（i18n対応）。楽譜表示⇔ライブラリを往復できる。
  楽譜未読み込みで楽譜画面へ切り替えられない場合の挙動も破綻させない
  （楽譜がない間はライブラリ固定でもよい）

### ライブラリから開く（REQ-017-007/008）

- LibraryViewの `onOpenEntry(path)`: `electronAPI.library.open(path)` →
  - `ok: true`: 既存のファイル読み込み処理（file:read/read-binary→パース→表示）を再利用して開く
  - `ok: false (not-found)`: エラートースト（i18n文言）+該当行へ欠損マーク+
    「ライブラリから削除するか」の確認UI→削除または維持
- `onOpenFileDialog`: 既存のファイルダイアログ導線を再利用

### 注意事項

- 既存のopenFileロジックを重複実装しない（関数抽出などで共通化する）
- モック境界（library IPC）の結線テストを対で用意する（本体で実際に接続されていることの検証）
- E2EはTASK-104のスコープ

## 実装手順（TDD）

1. App統合のテストを先に作成（openFile成功でupsertが呼ばれる・起動時にLibraryViewが
   表示される・ライブラリから開く成功/not-found分岐）、失敗確認、テストコミット
2. 実装してテストを通す
3. 全チェック（test/typecheck/lint/lint:jp/format:check）通過を確認しコミット

## 受入基準

- [x] どの経路（ダイアログ・D&D・ライブラリ）で開いてもライブラリへ自動登録される（REQ-017-001）
- [x] 同一ファイルの再オープンで重複登録されない（REQ-017-002、結線として確認。
      重複排除自体はTASK-101のLibraryService.upsertが担う）
- [x] 起動時（楽譜未読み込み）にライブラリ画面が表示される（REQ-017-010）
- [x] ライブラリの行クリックで楽譜が開き、楽譜画面へ遷移する（REQ-017-007）
- [x] 欠損ファイルはエラー通知+欠損表示+削除の選択肢が出る（REQ-017-008）
- [x] Headerからライブラリ画面へいつでも戻れる
- [x] 全チェック通過

## テスト項目

- [x] openFile成功→library.upsert呼び出し（title/composer/path、結線テスト）
- [x] 起動時にLibraryViewが表示される（score未読み込み）
- [x] onOpenEntry成功→読み込みフロー実行→activeView='score'
- [x] onOpenEntry not-found→トースト+削除確認の分岐
- [x] Headerのライブラリボタンで画面が切り替わる

## 完了サマリー（2026-07-12）

TASK-101・TASK-102の成果物をApp.tsx・Headerへ結線し、US-017を実際に使える
機能にした。要点は以下のとおり。

- `App.tsx`の`openMusicXmlFile`（ダイアログ・D&D・ライブラリの3経路が通る
  唯一の成功点）で`electronAPI.library.upsert`を呼ぶ一本化を行った。
  titleは`score.title`、パーサー既定値`'Untitled'`のときはファイル名
  （拡張子除く）へフォールバックする
- MusicXMLパーサーへ`<identification><creator type="composer">`の抽出を
  追加した（`Score.composer`、オプショナルフィールドとして追加し
  既存のScoreリテラルとの後方互換を保った）
- `ui-slice.activeView`に応じてScoreRenderer/PianoKeyboardの表示を
  `display:none`で切り替え、`'library'`の間はLibraryViewを表示する。
  両コンポーネントは常時マウントを維持し、既存の多数の結線テストの
  前提を壊さないようにした
- `library:open`が`not-found`を返した場合はエラー通知＋欠損マーク＋
  アプリ内確認ダイアログでの削除/維持を実装した（`window.confirm`は
  不使用）
- Headerにライブラリ画面へ戻るボタンを追加した（i18n対応）

### 変更ファイル

- `src/renderer/src/App.tsx`
- `src/renderer/src/components/Header/index.tsx`
- `src/renderer/src/lib/musicxml-parser/parser.ts`
- `src/renderer/src/types/score.ts`
- `src/renderer/src/lib/i18n/ja.ts` / `en.ts`
- テスト: `src/renderer/src/App.test.tsx`、
  `src/renderer/src/components/Header/Header.test.tsx`、
  `src/renderer/src/lib/musicxml-parser/parser.test.ts`、
  `src/renderer/src/tests/integration/practice-flow.test.tsx`

### テスト結果

- `npm run test`: 64ファイル897件すべて通過
- `npm run typecheck` / `npm run lint` / `npm run lint:jp` /
  `npm run format:check`: すべて通過

### E2Eへの影響（要対応、TASK-104スコープ）

`activeView`の初期値が`'library'`になったことで、既存の
`tests/e2e/app.spec.ts`が前提としていた「起動直後は楽譜プレースホルダーが
表示される」という状態が崩れる。具体的には次の2箇所が影響を受ける。

- `placeholder`（ScoreRendererの実コンポーネント）は起動直後、
  親コンテナが`display:none`になるため`toBeVisible()`が失敗する見込み
- `getByRole('button', { name: 'ファイルを開く' })`が、LibraryViewの
  空状態ボタンとHeaderのアイコンボタンの2つにマッチしうる

TASK-104でE2Eを更新する際、起動直後はライブラリ画面である前提に
シナリオを合わせる必要がある。実機でのE2E実行（`npm run test:e2e`）は
本タスクでは未実施（TASK-104のスコープのため）。
