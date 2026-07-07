# TASK-077: Phase 15統合検証・トレーサビリティ更新

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-077 |
| タイプ | qa |
| ステータス | DONE |
| 優先度 | High |
| 見積もり | 40分 |
| 依存タスク | TASK-068〜076（全タスク） |

## 背景

Phase 15の全機能を統合した状態での検証と、REQトレーサビリティの更新を行う（テスト方針の追加原則: タスク完了時にtraceability.mdを更新し検証なしREQを可視化する）。

## 実装内容

### 検証項目

1. **全自動テスト**: `npm run test` / `npm run typecheck` / `npm run lint` / `npm run test:e2e` 全通過
2. **実起動確認（開発モード、StrictMode有効）**:
   - ウィンドウタイトル・1行ヘッダー・譜面領域拡大
   - 楽譜を開く→ピアノ音色で再生→QuickPanelから音量/運指/メトロノーム操作
   - 設定モーダル: 音色変更（再生+メトロノーム）→再起動→復元確認
   - ペダル付きMusicXMLの再生（音の残留なし）
   - Aboutページのバージョン・ライセンス表示
3. **パッケージ確認**: `npm run build:mac`（macOS環境）でアイコン・サンプル同梱・licenses.jsonを確認
4. **ドキュメント**:
   - `docs/sdd/requirements/traceability.md` にREQ-011〜015の行を追加し検証状況を記録
   - `CLAUDE.md` のIPC・構成記述に変更があれば同期（Header構成、audio設定の追加）
   - タスクステータスをDONEへ更新

### 対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `docs/sdd/requirements/traceability.md` | REQ-011-001〜REQ-015-005の行を追加 |
| `CLAUDE.md` | ソースコード構成（Header/AboutPanel追加、Toolbar/index.tsx削除）・設定スキーマ記述の同期 |
| `docs/sdd/tasks/index.md` / `phase-15/TASK-*.md` | ステータス更新 |

## 受入基準

- [x] 全自動テストスイート通過（`npm run test` 51ファイル706件、`npm run typecheck`、`npm run lint`、`npm run test:e2e` 3件、いずれも通過）
- [x] 実起動シナリオ（上記2）を全て実施し、問題があればトラブルシューティングフローで分析してから修正（E2Eで自動化可能な範囲は実施・全通過。聴覚確認はユーザー実機確認待ちとして明記）
- [x] traceability.mdにPhase 15の全REQ（REQ-011〜015、25件）が記載され、×（検証なし）の要件が残る場合は理由を明記（本タスクでREQ-011/012/014の14行を追加。すべて○または△で、×は残っていない）
- [x] CLAUDE.mdが実装と一致（ソースコード構成・設定スキーマ・ビルド補助スクリプト・ライセンス方針を同期）

## 完了サマリー（2026-07-07）

### 自動テスト
- `npm run format:check` で報告されていた12件のフォーマット崩れを `npx prettier --write .` で解消（コード内容の変更なし）
- `npm run test`（51ファイル706件）、`npm run typecheck`、`npm run lint` はすべて通過
- `npm run test:e2e`（`npm run build` を含む）は既存2件に加え、設定モーダル→音色セクション（`#playbackVoice`/`#metronomeVoice`の表示・ラベル）とAboutセクション（`v{package.jsonのversion}`との一致・Apache License 2.0リンク・Salamanderクレジット表示）を検証する新規E2Eケースを追加し、計3件全通過（`tests/e2e/app.spec.ts`）

### パッケージ確認
- `npm run build:mac`（`CSC_IDENTITY_AUTO_DISCOVERY=false`でコード署名なし）を実行し、x64/arm64双方のdmg/zipを生成
- 生成された`.app`の`Contents/Resources/icon.icns`同梱を確認、`app.asar`内にSalamanderサンプル30件（mp3）が同梱されることを`npx asar list`で確認
- `licenses.json`は`AboutPanel/index.tsx`が`import`で静的解決するため独立ファイルとしては同梱されず、rendererバンドルJS（`out/renderer/assets/index-*.js`）にライセンス文字列としてインライン化されることを`npx asar extract`で展開し確認（想定どおりの挙動）
- Windows向け`build:win`はWindows環境がないため対象外（`build/icon.ico`の存在確認まで、TASK-068の`branding.test.ts`でカバー済み）

### ドキュメント同期
- `docs/sdd/requirements/traceability.md`にREQ-011-001〜003、REQ-012-001〜006、REQ-014-001〜005の14行を追加。既存のREQ-013/REQ-015系はTASK-073/076で追記済みだったため重複させず、今回のE2E追加を反映して3行（REQ-013-006, REQ-015-001, REQ-015-003）を更新するにとどめた
- `CLAUDE.md`のソースコード構成にHeader/AboutPanel/SettingsModal等の追加、Toolbar/index.tsx廃止（Header/index.tsxへ統合）、audio-engine配下のvoices.ts/metronome-voices.ts/pedal-extension.ts、`scripts/`の3スクリプト、設定スキーマへの`audio`追加、ライセンス方針（Apache 2.0）を反映
- TASK-069/070/071/072/073/076のステータス不整合（実装済みにもかかわらずTODO/REVIEWのまま、または受入基準の一部が未チェックのまま）を是正し、全タスクをDONE化。実機での聴覚確認（ペダル残留なし、既定ピアノ音、メトロノームクリック音）と音色変更→再起動の実ファイル往復確認は自動化できないため、各タスクファイルに「ユーザー実機確認待ち」として明記した上でDONE化した
- `docs/sdd/tasks/index.md`の進捗サマリをPhase 15「10/0/0/0（完了/進行中/未着手/ブロック）」に更新し、各タスク行のステータス列をDONEに統一

### 未達事項・残課題（ユーザー実機確認待ち）
- ペダル付きMusicXML再生時の音の残留がないことの聴感確認（TASK-070）
- 既定でピアノ音（Salamander）が鳴ることの聴感確認（TASK-071）
- メトロノームON時に既定クリック音が鳴ることの聴感確認（TASK-072）
- 音色変更→アプリ再起動で選択が復元されることの実機確認（TASK-073、electron-store実ファイルを挟む往復確認は自動化していない）
- パッケージ版（`.app`/`.dmg`）でDock上に独自アイコンが表示されることの目視確認（REQ-011-002）

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | テスト方針の追加原則（E2Eはユーザー観測可能な結果、traceability更新） |
| 設計判断として決定 | Windows向け `build:win` の実行はWindows環境がないため対象外（icon.icoの存在確認まで） |

## 対応要件

US-011〜015の全REQ（横断検証）
