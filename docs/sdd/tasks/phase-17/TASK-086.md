# TASK-086: file:read系IPCの読み取りallowlist化

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-086 |
| タイプ | fix（セキュリティ強化） |
| ステータス | TODO |
| 優先度 | High |
| 見積もり | 40分 |
| 依存タスク | なし |

## 背景

### 問題の概要

2026-07-11のセキュリティ調査で、`src/main/index.ts` の `file:read` / `file:read-if-exists` / `file:read-binary` IPCハンドラがレンダラーから渡された任意パスを検証なしで読み取れることが判明した。書き込み側（`file:write`）は `PathAllowlist.assertAllowedAnnotationPath` で厳格に制限されており（シンボリックリンク検証・TOCTOU対策込み）、読み取り側だけが無制限という非対称がある。レンダラーが侵害された場合（前提としてXSS等が必要だが）、任意ファイルの読み取り（情報漏洩）に繋がり得る。

### 関連する仕様

- `src/main/path-allowlist.ts` — 既存の書き込みallowlist。ユーザーがダイアログ/ドロップで開いたMusicXMLパスを `allowMusicXml()` で登録し、対応する `.annotation.json` のみ書き込み許可する
- `src/main/file-handlers.ts` — `file:show-open-dialog` / `file:register-dropped-file` が allowlist へ登録する既存経路
- CLAUDE.md「Electronセキュリティ設定」節

## 実装内容

### 修正対象

- ファイル: `src/main/path-allowlist.ts`
  - `assertAllowedReadPath(requestedPath: string): string` を追加する。許可条件は次のいずれか:
    1. `resolve(requestedPath)` が `allowMusicXml()` で登録済みのMusicXMLパスと一致する
    2. 登録済みMusicXMLパス + `.annotation.json`（アノテーションサイドカー）と一致する
  - 不許可時は `file:write` 側と同様に `Refused to read from disallowed path: ...` 形式のエラーをthrowする
- ファイル: `src/main/path-allowlist.test.ts`
  - 上記の許可/拒否ケースのユニットテストを追加する
- ファイル: `src/main/index.ts`
  - `file:read` / `file:read-if-exists` / `file:read-binary` の各ハンドラ冒頭で `assertAllowedReadPath` を適用する

### 事前調査（実装前に必ず確認すること）

- レンダラーが `file:read` 系を呼び出す全経路を洗い出すこと（`grep -rn "file.read\|readBinary\|readIfExists" src/renderer/`）。特に「最近使ったファイル」から開く経路が、ダイアログ/ドロップ登録を経由せずに直接 `file:read` を呼んでいる場合、allowlist化により読み取りが拒否されリグレッションとなる。
- その場合は、最近使ったファイルを開く前に既存の `file:register-dropped-file`（拡張子検証つき登録IPC）を呼び出すようレンダラー側を結線するか、同等の登録経路を用意すること。登録IPCの名称が実態と合わなくなる場合はリネーム（例: `file:register-openable-file`）も許容するが、preload・レンダラー・テストの参照を一括更新すること。

### 注意事項

- E2Eテスト（`tests/e2e/app.spec.ts`）は `file:show-open-dialog` を固定パスへ差し替えて楽譜を開くため、ダイアログハンドラ内の `allowMusicXml()` 登録は実処理が通る。allowlist化後もE2Eが通ることを確認する。
- 拒否時のレンダラー側エラー表示（ダイアログ/トースト）が既存のエラーハンドリングで機能することを確認する。

## 実装手順（TDD）

1. テスト作成: `src/main/path-allowlist.test.ts` に `assertAllowedReadPath` のテストを追加（登録済みMusicXML→許可、対応する.annotation.json→許可、未登録パス→拒否、`../`相対パス→resolve後に判定、登録前は全拒否）
2. テスト実行: `npm run test` で失敗を確認
3. テストコミット
4. 実装: `path-allowlist.ts` → `index.ts` の順に実装しテストを通過させる
5. 事前調査で判明したレンダラー側経路の結線修正と結線テストを追加
6. `npm run test` / `npm run typecheck` / `npm run lint` 通過を確認しコミット

## 受入基準

- [ ] `assertAllowedReadPath` が実装され、ユニットテストが5ケース以上ある
- [ ] `file:read` / `file:read-if-exists` / `file:read-binary` の3ハンドラすべてに検証が適用されている
- [ ] 未登録パスの読み取りが拒否される（テストで検証）
- [ ] ダイアログ経由・ドロップ経由・最近使ったファイル経由のすべてで楽譜が開ける（リグレッションなし）
- [ ] `npm run test` / `npm run typecheck` / `npm run lint` がすべて通過する

## テスト項目

- [ ] 登録済みMusicXMLパス本体の読み取りが許可される
- [ ] 登録済みMusicXMLの `.annotation.json` の読み取りが許可される
- [ ] 未登録の任意パス（例: `/etc/hosts`、`C:\Windows\system.ini` 相当）が拒否される
- [ ] `../` を含むパスが `resolve` 後の実パスで判定される
- [ ] 最近使ったファイルから開くフローの結線テスト（モック境界の結線テスト原則）

## 情報の明確性

### 明示された情報

- 読み取り3ハンドラに検証がないこと（実ファイル確認済み、`src/main/index.ts:76-97`）
- 書き込み側の既存allowlist実装（`path-allowlist.ts`）
- 許可対象は「開いたMusicXML本体とその.annotation.json」（ユーザー承認済みの修正方針）

### 不明/要確認の情報

- 「最近使ったファイル」から開く経路がallowlist登録を経由しているか（事前調査で確認すること）
