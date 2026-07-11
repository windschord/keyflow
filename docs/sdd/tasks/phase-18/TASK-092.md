# TASK-092: アノテーションJSONのスキーマ・値域検証

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-092 |
| タイプ | fix（セキュリティ強化・入力堅牢性） |
| ステータス | DONE |
| 優先度 | Medium |
| 見積もり | 40分 |
| 依存タスク | なし |

## 背景

### 問題の概要

2026-07-11の調査で、`src/renderer/src/lib/annotation-store/index.ts` の `load()`（`:36` 付近）が `JSON.parse` の結果を型注釈のみで受け取り、実行時のスキーマ・値域検証をしていないことが判明した（A-4）。悪意ある（または破損した）`{musicxml}.annotation.json` を同ディレクトリに置かれた場合、検証されない値がそのまま採用され、`JSON.stringify` で書き戻される。

なお現状でも実害は限定的である。

- キーは `Map` で扱われるためプロトタイプ汚染（`__proto__`）は発生しない
- 値はReactが自動エスケープするためXSSにならない

ただし堅牢性のため、スキーマと値域の実行時検証を追加する。

### 関連する仕様

- `src/renderer/src/lib/annotation-store/types.ts` — `AnnotationFile` / `Annotation` 型
- `noteId` フォーマット: `{partId}-M{measureNumber}-N{noteIndex}`（CLAUDE.md）
- `fingerNumber` は運指番号（1〜5、0は指定なしの扱いがあるか実装時に確認）

## 実装内容

### 修正対象

- ファイル: `src/renderer/src/lib/annotation-store/index.ts`
  - `load()` で `JSON.parse` 後に各アノテーションを検証する純関数（例: `isValidAnnotation(value): value is Annotation`）を通し、不正な要素はスキップ（採用しない）する
  - 検証項目（`types.ts` の定義に厳密に合わせること。以下は想定であり実装時に型定義で確定する）:
    - `noteId`: 非空文字列
    - `fingerNumber`: 省略可、存在する場合は整数かつ許容値域（実装時に `types.ts` と既存UI（NoteContextMenu）の入力範囲から確定。例: 1〜5）
    - `comment`: 省略可、存在する場合は文字列
    - `isApproved` 等の真偽フラグ: 存在する場合は boolean
  - トップレベルが期待形（`annotations` が配列）でない場合は空状態で継続する既存のcatch挙動を維持する
  - 検証で弾いた要素があった場合はデバッグログ（既存のログ方針に合わせる）を残してもよいが、UIをブロックしない
- ファイル: `src/renderer/src/lib/annotation-store/annotation-store.test.ts`
  - 不正な要素の除外・正常な要素の採用・値域外 `fingerNumber` の除外などのテストを追加する

### 注意事項

- 検証は「不正な要素を落として残りは使う」方針（フェイルソフト）とする。
  壊れた要素が1件混ざっても、正当なアノテーションを全損させない
- 既存の正常なアノテーションファイルの読み込み挙動を変えない（リグレッションなし）
- `types.ts` の実際の型に存在しないフィールドを勝手に検証しない（型定義を唯一のソースオブトゥルースとする）

## 実装手順（TDD）

1. `types.ts` を読み、検証すべきフィールドと値域を確定する
2. テスト作成: `annotation-store.test.ts` に検証ケースを追加
3. テスト実行: `npm run test` で失敗を確認
4. テストコミット
5. 実装: `index.ts` に検証関数を追加し通過させる
6. `npm run test` / `npm run typecheck` / `npm run lint` 通過を確認しコミット

## 受入基準

- [x] `load()` がスキーマ・値域を検証し、不正要素を除外する
- [x] 検証項目が `types.ts` の型定義と一致している（存在しないフィールドを検証していない）
- [x] 不正な要素が混在しても正常な要素は採用される（フェイルソフト）
- [x] 既存の正常なアノテーションファイルの読み込みが変わらない
- [x] `npm run test` / `npm run typecheck` / `npm run lint` がすべて通過する

## テスト項目

- [x] `fingerNumber` が値域外・非整数のアノテーションが除外される
- [x] `noteId` が空/非文字列のアノテーションが除外される
- [x] 正常な要素と不正な要素が混在する場合、正常な要素のみ採用される
- [x] `annotations` が非配列のファイルで空状態継続（既存挙動維持）

## 情報の明確性

### 明示された情報

- 検証欠如の該当箇所（`annotation-store/index.ts:36`、調査で確認済み）
- プロトタイプ汚染・XSSには至らない（対策の主眼は入力堅牢性）
- フェイルソフト方針（正当な要素を全損させない）

## 完了サマリー（2026-07-11）

### 実装内容

- `src/renderer/src/lib/annotation-store/index.ts`:
  - `normalizeAnnotation(value): Annotation | null` を追加。`JSON.parse` 結果を型定義
    （`types/annotation.ts`）に照らして検証し、不正な要素は `null` を返す
  - `load()` で `annotations` が配列でない場合は空配列として扱い、各要素を
    `normalizeAnnotation` に通して不正要素を除外する（フェイルソフト）
- `src/renderer/src/lib/annotation-store/annotation-store.test.ts`: 検証ケース7件を追加

### 検証項目（型定義に厳密準拠）

- `noteId`: 非空文字列（それ以外は要素ごと除外）
- `fingerNumber`: 省略可。存在時は整数かつ 1〜5。値域外・非整数は要素ごと除外
- `comment`: 省略可。存在時は文字列
- `isAISuggested` / `isApproved`: boolean。欠落・非booleanは `false` へ正規化

### 確認事項

- プロトタイプ汚染: `noteId` を `Map` のキーに使うため `__proto__` を含んでも汚染しない
  （テストで `Object.prototype` 非汚染を確認）
- XSS: 値はReactが自動エスケープするため不成立。本タスクの主眼は入力堅牢性

### テスト結果

- `npm run test`（annotation-store.test.ts）: 17件全通過
- `npm run typecheck` / `npm run lint` / `npm run lint:jp:ts`: いずれも通過

### 不明/要確認の情報

- `fingerNumber` の正確な許容値域（実装時に `types.ts` とNoteContextMenuの入力仕様から確定する）
