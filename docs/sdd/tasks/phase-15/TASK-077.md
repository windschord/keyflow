# TASK-077: Phase 15統合検証・トレーサビリティ更新

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-077 |
| タイプ | qa |
| ステータス | TODO |
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

- [ ] 全自動テストスイート通過
- [ ] 実起動シナリオ（上記2）を全て実施し、問題があればトラブルシューティングフローで分析してから修正
- [ ] traceability.mdにPhase 15の全REQ（25件）が記載され、×（検証なし）の要件が残る場合は理由を明記
- [ ] CLAUDE.mdが実装と一致

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | テスト方針の追加原則（E2Eはユーザー観測可能な結果、traceability更新） |
| 設計判断として決定 | Windows向け `build:win` の実行はWindows環境がないため対象外（icon.icoの存在確認まで） |

## 対応要件

US-011〜015の全REQ（横断検証）
