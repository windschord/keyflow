# タスク計画 — MusicXMLピアノ練習アプリ

> AIエージェント（Claude Code等）が実行することを前提としています。
> 各タスクファイルに詳細な実装指示・受入基準・TDD手順が記載されています。

## 情報の明確性チェック（全体）

### ユーザーから明示された情報
- [x] 技術スタック: Electron v29+ / React 18 / TypeScript 5 / Vite
- [x] テストフレームワーク: Vitest
- [x] リンター/フォーマッター: ESLint + Prettier
- [x] パッケージマネージャー: npm
- [x] 外部ランタイム依存なし（Python・Node.js別途インストール不要）
- [x] 対象OS: Windows 10/11（Phase 1）

### 不明/要確認の情報（全体）

| 項目 | 現状の理解 | 確認状況 |
|------|-----------|----------|
| Electronバージョン | v29を想定 | [x] 設計判断として決定 |
| OSMDバージョン | 最新安定版（0.9.x系） | [x] 設計判断として決定 |
| Zustand バージョン | v4 | [x] 設計判断として決定 |
| node-midi | v2.x | [x] 設計判断として決定 |

---

## 進捗サマリ

| フェーズ | 完了 | 進行中 | 未着手 | ブロック | 詳細 |
|---------|------|--------|--------|----------|------|
| Phase 1: 開発環境構築 | 3 | 0 | 0 | 0 | [詳細](phase-1/) @phase-1/ |
| Phase 2: データ層・型定義 | 4 | 0 | 0 | 0 | [詳細](phase-2/) @phase-2/ |
| Phase 3: MIDI & IPC | 2 | 0 | 0 | 0 | [詳細](phase-3/) @phase-3/ |
| Phase 4: UIコアコンポーネント | 4 | 0 | 0 | 0 | [詳細](phase-4/) @phase-4/ |
| Phase 5: 練習エンジン統合 | 4 | 0 | 0 | 0 | [詳細](phase-5/) @phase-5/ |
| Phase 6: 運指エンジン（DP） | 4 | 0 | 0 | 0 | [詳細](phase-6/) @phase-6/ |
| Phase 7: パッケージング・QA | 2 | 0 | 0 | 0 | [詳細](phase-7/) @phase-7/ |
| Phase 8: 結線修正・UX改善（フェーズA） | 5 | 0 | 0 | 0 | [詳細](phase-8/) @phase-8/ |
| Phase 9: 仕様再定義・データモデル刷新（フェーズB） | 7 | 0 | 0 | 0 | [詳細](phase-9/) @phase-9/ |
| Phase 10: QA・プロセス改善（フェーズC） | 3 | 0 | 0 | 0 | [詳細](phase-10/) @phase-10/ |
| Phase 11: 品質是正・機能補完（2026-07-05横断チェック起点） | 9 | 0 | 0 | 0 | [詳細](phase-11/) @phase-11/ |
| Phase 12: 実機フィードバック対応（2026-07-05） | 0 | 1 | 6 | 0 | [詳細](phase-12/) @phase-12/ |

**合計**: 54タスク / 推定合計: 約2450分（AIエージェント作業時間）

> Phase 8〜10 は 2026-07-04 のトラブルシューティング分析
> （[docs/sdd/troubleshooting/2026-07-04-app-unusable/analysis.md](../troubleshooting/2026-07-04-app-unusable/analysis.md)）
> に基づく修正フェーズ。承認済み方針: フェーズA→B→Cを順に完遂。
>
> Phase 11 は 2026-07-05 のテストすり抜け分析
> （[docs/sdd/troubleshooting/2026-07-05-test-escape/analysis.md](../troubleshooting/2026-07-05-test-escape/analysis.md)）
> の横断チェックで検出された事象（H1〜H5、M1〜M8、Low）の是正フェーズ。
>
> Phase 12 は 2026-07-05 の実機動作確認フィードバック9件の分析
> （[docs/sdd/troubleshooting/2026-07-05-user-feedback/analysis.md](../troubleshooting/2026-07-05-user-feedback/analysis.md)）
> に基づく修正・機能追加フェーズ（原因群A〜D）。

---

## 並列実行グループ

### グループA: Phase 2（TASK-004完了後に並列実行可能）
| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-005 | src/lib/musicxml-parser/** | TASK-004 |
| TASK-006 | src/lib/annotation-store/** | TASK-004 |
| TASK-007 | src/lib/app-settings/** | TASK-004 |

### グループB: Phase 4（TASK-010完了後に並列実行可能）
| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-011 | src/components/ScoreRenderer/** | TASK-010 |
| TASK-012 | src/components/PianoKeyboard/** | TASK-010 |
| TASK-013 | src/components/Toolbar/** | TASK-010 |

### グループC: Phase 5（TASK-010〜013完了後に並列実行可能）
| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-014 | src/lib/practice-engine/** | Phase 4 |
| TASK-015 | src/lib/audio-engine/** | Phase 4 |

### グループC-2: Phase 5（TASK-016完了後に実行）
| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-023 | src/components/ScoreRenderer/** | TASK-011, TASK-016 |

### グループD: Phase 6（TASK-017完了後に並列実行可能）
| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-018 | src/workers/fingering/dp-solver.ts | TASK-017 |
| TASK-019 | src/workers/fingering/scale-patterns.ts | TASK-017 |

### グループE: Phase 8（着手時に並列実行可能）
| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-024 | src/renderer/src/App.tsx, store/** | - |
| TASK-025 | src/renderer/src/App.tsx(CSS), ScoreRenderer/**, assets/main.css | - |

### グループF: Phase 8（TASK-026完了後に並列実行可能）
| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-027 | src/renderer/src/hooks/usePractice.ts, Toolbar/** | TASK-026 |
| TASK-028 | src/renderer/src/components/Toolbar/**, App.tsx | TASK-026 |

### グループG: Phase 11（TASK-039/042/043は並列可）
| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-039 | src/main/index.ts, src/main/settings.ts, SettingsModal/** | - |
| TASK-042 | src/renderer/src/lib/audio-engine/** | - |
| TASK-043 | src/renderer/src/workers/fingering/** | - |

> TASK-040/041 も依存なしだが、TASK-040 は SettingsModal を TASK-039 と、
> TASK-041 は App.tsx を他タスクと共有するため、衝突回避のうえ順次着手を推奨。

### グループH: Phase 12（TASK-048/052/053/054は並列可）
| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-048 | musicxml-parser/**, practice-engine/note-grouping.ts, PianoKeyboard/**, FingeringPanel/**, ScoreRenderer/** | - |
| TASK-052 | src/renderer/src/lib/audio-engine/**, Toolbar/**, store/**, src/main/settings.ts | - |
| TASK-053 | src/renderer/src/App.tsx, src/preload/**, src/main/** | - |
| TASK-054 | Toolbar/TempoControl.tsx, Toolbar/LoopControl.tsx, assets/base.css | - |

> TASK-049/050/051 は TASK-048 完了後に着手する（049→050 は順次）。

---

## タスク一覧

### Phase 1: 開発環境構築（順次実行）
*推定期間: 90分*

| タスクID | タイトル | ステータス | 依存 | 見積 | 詳細リンク |
|----------|---------|-----------|------|------|-----------|
| TASK-001 | Electronプロジェクト初期化（Vite+React+TS） | DONE | - | 30min | [詳細](phase-1/TASK-001.md) @phase-1/TASK-001.md |
| TASK-002 | 開発ツール設定（ESLint/Prettier/Vitest/strict） | DONE | TASK-001 | 20min | [詳細](phase-1/TASK-002.md) @phase-1/TASK-002.md |
| TASK-003 | electron-builder + node-midi ビルド設定 | DONE | TASK-002 | 40min | [詳細](phase-1/TASK-003.md) @phase-1/TASK-003.md |

### Phase 2: データ層・型定義
*推定期間: 130分（TASK-004後、005〜007は並列可）*

| タスクID | タイトル | ステータス | 依存 | 見積 | 詳細リンク |
|----------|---------|-----------|------|------|-----------|
| TASK-004 | 内部データモデル型定義（Score/Note/Annotation等） | DONE | Phase 1 | 30min | [詳細](phase-2/TASK-004.md) @phase-2/TASK-004.md |
| TASK-005 | MusicXML Parser実装（.xml/.mxl対応） | DONE | TASK-004 | 60min | [詳細](phase-2/TASK-005.md) @phase-2/TASK-005.md |
| TASK-006 | Annotation Store実装（CRUD+JSON永続化） | DONE | TASK-004 | 40min | [詳細](phase-2/TASK-006.md) @phase-2/TASK-006.md |
| TASK-007 | App Settings実装（electron-store+ファイル履歴） | DONE | TASK-004 | 20min | [詳細](phase-2/TASK-007.md) @phase-2/TASK-007.md |

### Phase 3: MIDI & IPC（順次実行）
*推定期間: 60min*

| タスクID | タイトル | ステータス | 依存 | 見積 | 詳細リンク |
|----------|---------|-----------|------|------|-----------|
| TASK-008 | MIDI Controller実装（Web MIDI API・設計変更済） | DONE | Phase 2 | 40min | [詳細](phase-3/TASK-008.md) @phase-3/TASK-008.md |
| TASK-009 | IPC Bridge実装（Preload Script + 型付きAPI） | DONE | TASK-008 | 20min | [詳細](phase-3/TASK-009.md) @phase-3/TASK-009.md |

### Phase 4: UIコアコンポーネント
*推定期間: 150min（TASK-010後、011〜013は並列可）*

| タスクID | タイトル | ステータス | 依存 | 見積 | 詳細リンク |
|----------|---------|-----------|------|------|-----------|
| TASK-010 | Zustand Store定義（PracticeSessionState） | DONE | Phase 3 | 30min | [詳細](phase-4/TASK-010.md) @phase-4/TASK-010.md |
| TASK-011 | Score Renderer実装（OSMD統合・カーソル制御） | DONE | TASK-010 | 60min | [詳細](phase-4/TASK-011.md) @phase-4/TASK-011.md |
| TASK-012 | Piano Keyboard実装（Canvas 2D / 88鍵） | DONE | TASK-010 | 50min | [詳細](phase-4/TASK-012.md) @phase-4/TASK-012.md |
| TASK-013 | Toolbar / Controls UI実装 | DONE | TASK-010 | 40min | [詳細](phase-4/TASK-013.md) @phase-4/TASK-013.md |

### Phase 5: 練習エンジン統合
*推定期間: 120min（014〜015は並列可）*

| タスクID | タイトル | ステータス | 依存 | 見積 | 詳細リンク |
|----------|---------|-----------|------|------|-----------|
| TASK-014 | Practice Engine実装（正誤判定・ループ管理） | DONE | Phase 4 | 60min | [詳細](phase-5/TASK-014.md) @phase-5/TASK-014.md |
| TASK-015 | Audio Engine実装（Tone.js伴奏・メトロノーム） | DONE | Phase 4 | 40min | [詳細](phase-5/TASK-015.md) @phase-5/TASK-015.md |
| TASK-016 | MIDI→PracticeEngine統合（IPC接続・フルフロー） | DONE | TASK-014, TASK-015 | 40min | [詳細](phase-5/TASK-016.md) @phase-5/TASK-016.md |
| TASK-023 | 楽譜の自動スクロール・カーソル追従実装（OSMD連携） | DONE | TASK-011, TASK-016 | 50min | [詳細](phase-5/TASK-023.md) @phase-5/TASK-023.md |

### Phase 6: 運指エンジン（Parncutt-Terzuolo DP）
*推定期間: 160min（TASK-017後、018〜019は並列可）*

| タスクID | タイトル | ステータス | 依存 | 見積 | 詳細リンク |
|----------|---------|-----------|------|------|-----------|
| TASK-017 | フィンガリングWeb Worker基盤・型定義・コスト関数 | DONE | Phase 5 | 40min | [詳細](phase-6/TASK-017.md) @phase-6/TASK-017.md |
| TASK-018 | DPソルバー実装（Parncutt-Terzuoloモデル） | DONE | TASK-017 | 60min | [詳細](phase-6/TASK-018.md) @phase-6/TASK-018.md |
| TASK-019 | スケール定型パターン実装（全24調） | DONE | TASK-017 | 30min | [詳細](phase-6/TASK-019.md) @phase-6/TASK-019.md |
| TASK-020 | FingeringEngineService + 運指UI統合 | DONE | TASK-018, TASK-019 | 40min | [詳細](phase-6/TASK-020.md) @phase-6/TASK-020.md |

### Phase 7: パッケージング・QA
*推定期間: 80min*

| タスクID | タイトル | ステータス | 依存 | 見積 | 詳細リンク |
|----------|---------|-----------|------|------|-----------|
| TASK-021 | electron-builder設定（Windows NSISインストーラー） | DONE | Phase 6 | 30min | [詳細](phase-7/TASK-021.md) @phase-7/TASK-021.md |
| TASK-022 | 統合テスト・E2Eシナリオ整備 | DONE | TASK-021 | 50min | [詳細](phase-7/TASK-022.md) @phase-7/TASK-022.md |

### Phase 8: 結線修正・UX改善（フェーズA / 2026-07-04 トラブルシューティング起点）
*推定期間: 170min（024〜025は並列可、026後に027〜028が並列可）*

| タスクID | タイトル | ステータス | 依存 | 見積 | 詳細リンク |
|----------|---------|-----------|------|------|-----------|
| TASK-024 | [BugFix] スコア読み込み後の練習セッション初期化 | DONE | - | 30min | [詳細](phase-8/TASK-024.md) @phase-8/TASK-024.md |
| TASK-025 | [BugFix] 楽譜スクロールのCSSレイアウト修正 | DONE | - | 30min | [詳細](phase-8/TASK-025.md) @phase-8/TASK-025.md |
| TASK-026 | [BugFix] 曲の再生/停止機能の暫定実装 | DONE | TASK-024 | 40min | [詳細](phase-8/TASK-026.md) @phase-8/TASK-026.md |
| TASK-027 | [BugFix] テンポ・メトロノーム・効果音の結線 | DONE | TASK-026 | 30min | [詳細](phase-8/TASK-027.md) @phase-8/TASK-027.md |
| TASK-028 | [BugFix] Toolbar UXの全面改善（日本語ラベル・機能整理） | DONE | TASK-026 | 40min | [詳細](phase-8/TASK-028.md) @phase-8/TASK-028.md |

### Phase 9: 仕様再定義・データモデル刷新（フェーズB / 順次実行）
*推定期間: 260min*

| タスクID | タイトル | ステータス | 依存 | 見積 | 詳細リンク |
|----------|---------|-----------|------|------|-----------|
| TASK-029 | 要件定義追加: US-010 曲の再生（お手本演奏） | DONE | TASK-026 | 30min | [詳細](phase-9/TASK-029.md) @phase-9/TASK-029.md |
| TASK-030 | 設計: 時刻ベースデータモデルへの再設計 | DONE | TASK-029 | 60min | [詳細](phase-9/TASK-030.md) @phase-9/TASK-030.md |
| TASK-031 | パーサーの時刻付与・noteId統一実装 | DONE | TASK-030 | 60min | [詳細](phase-9/TASK-031.md) @phase-9/TASK-031.md |
| TASK-032 | practice-engineの両手・和音同時判定対応 | DONE | TASK-031 | 60min | [詳細](phase-9/TASK-032.md) @phase-9/TASK-032.md |
| TASK-033 | 楽譜上の視覚フィードバック実装（osmd-controller空実装の解消） | DONE | TASK-032 | 50min | [詳細](phase-9/TASK-033.md) @phase-9/TASK-033.md |
| TASK-037 | 鍵盤上の指番号描画（PianoKeyboard、TASK-033残件） | DONE | TASK-033 | 30min | [詳細](phase-9/TASK-037.md) @phase-9/TASK-037.md |
| TASK-038 | [BugFix] 曲の再生の本実装（StrictMode耐性・時刻ベース・カーソル連動） | DONE | TASK-032 | 60min | [詳細](phase-9/TASK-038.md) @phase-9/TASK-038.md |

### Phase 10: QA・プロセス改善（フェーズC）
*推定期間: 120min（TASK-036は他と独立して着手可）*

| タスクID | タイトル | ステータス | 依存 | 見積 | 詳細リンク |
|----------|---------|-----------|------|------|-----------|
| TASK-034 | 実起動E2Eテストの導入（Playwright for Electron） | DONE | TASK-028 | 60min | [詳細](phase-10/TASK-034.md) @phase-10/TASK-034.md |
| TASK-035 | macOSパッケージングの追加 | DONE | TASK-028 | 30min | [詳細](phase-10/TASK-035.md) @phase-10/TASK-035.md |
| TASK-036 | ドキュメントの実態同期とQA運用是正 | DONE | - | 30min | [詳細](phase-10/TASK-036.md) @phase-10/TASK-036.md |

### Phase 11: 品質是正・機能補完（2026-07-05横断チェック起点）
*推定期間: 430min（039/042/043は並列可。044はTASK-041後、045はTASK-040後、046はTASK-043後、047はTASK-044後）*

| タスクID | タイトル | ステータス | 依存 | 見積 | 詳細リンク |
|----------|---------|-----------|------|------|-----------|
| TASK-039 | [BugFix] ファイル履歴の結線 | DONE | - | 30min | [詳細](phase-11/TASK-039.md) @phase-11/TASK-039.md |
| TASK-040 | [BugFix] エラーモード設定の結線 | DONE | - | 30min | [詳細](phase-11/TASK-040.md) @phase-11/TASK-040.md |
| TASK-041 | [BugFix] 鍵盤ガイドの左右色分け修正 | DONE | - | 30min | [詳細](phase-11/TASK-041.md) @phase-11/TASK-041.md |
| TASK-042 | [BugFix] メトロノームのTransport起動/停止の非対称修正 | DONE | - | 30min | [詳細](phase-11/TASK-042.md) @phase-11/TASK-042.md |
| TASK-043 | 運指エンジンへのscale-patterns統合 | DONE | - | 50min | [詳細](phase-11/TASK-043.md) @phase-11/TASK-043.md |
| TASK-044 | US-008 運指メモ手動編集UIの実装 | DONE | TASK-041 | 90min | [詳細](phase-11/TASK-044.md) @phase-11/TASK-044.md |
| TASK-045 | MIDIデバイス選択とズーム/鍵盤高さ設定UI | DONE | TASK-040 | 60min | [詳細](phase-11/TASK-045.md) @phase-11/TASK-045.md |
| TASK-046 | テストスイート是正（再発防止策の適用） | DONE | TASK-043 | 60min | [詳細](phase-11/TASK-046.md) @phase-11/TASK-046.md |
| TASK-047 | 残課題の要件整理と死にコード掃除 | DONE | TASK-044 | 50min | [詳細](phase-11/TASK-047.md) @phase-11/TASK-047.md |

### Phase 12: 実機フィードバック対応（2026-07-05）
*推定期間: 510min（048/052/053/054は並列可。049はTASK-048後、050はTASK-048・049後、051はTASK-048後）*

> 2026-07-05 の実機動作確認フィードバック9件の分析レポート
> （[docs/sdd/troubleshooting/2026-07-05-user-feedback/analysis.md](../troubleshooting/2026-07-05-user-feedback/analysis.md)）
> の承認済み修正方針（原因群A〜D）に基づくタスク群。

| タスクID | タイトル | ステータス | 依存 | 見積 | 詳細リンク |
|----------|---------|-----------|------|------|-----------|
| TASK-048 | [BugFix] 2段譜対応: Note.staff/hand導入と手判定のNote単位化 | TODO | - | 90min | [詳細](phase-12/TASK-048.md) @phase-12/TASK-048.md |
| TASK-049 | [BugFix] noteIdマッピングの照合ベース化とリサイズ/ズーム座標ずれ修正 | TODO | TASK-048 | 90min | [詳細](phase-12/TASK-049.md) @phase-12/TASK-049.md |
| TASK-050 | [BugFix] 運指提案の和音対応（コードユニットDP＋符頭単位描画） | TODO | TASK-048, TASK-049 | 120min | [詳細](phase-12/TASK-050.md) @phase-12/TASK-050.md |
| TASK-051 | 再生の練習対象フィルタ・カーソル位置からの再生・音単位カーソル移動 | TODO | TASK-048 | 90min | [詳細](phase-12/TASK-051.md) @phase-12/TASK-051.md |
| TASK-052 | 音量調整（マスターボリューム） | IN_PROGRESS | - | 40min | [詳細](phase-12/TASK-052.md) @phase-12/TASK-052.md |
| TASK-053 | ドラッグ＆ドロップでのファイルオープン | TODO | - | 50min | [詳細](phase-12/TASK-053.md) @phase-12/TASK-053.md |
| TASK-054 | [BugFix] チェックボックスラベルの視認性修正とテンプレートCSS残骸整理 | TODO | - | 30min | [詳細](phase-12/TASK-054.md) @phase-12/TASK-054.md |

---

## リスクと軽減策

| リスク | 影響度 | 発生確率 | 軽減策 |
|--------|--------|----------|--------|
| node-midiのelectron-rebuild失敗 | 高 | 中 | `electron-rebuild`をpostinstallスクリプトに組み込み、CIで早期検証 |
| OSMD内部APIの変更 | 中 | 低 | OSMDバージョンを固定（package.json exact version）、ラッパー層で吸収 |
| フィンガリングDPの計算精度不足 | 中 | 中 | Cメジャースケールを基準テストケースとして実装前に期待値を確定 |
| MIDIレイテンシが10msを超える | 高 | 低 | Phase 3完了時点でベンチマーク計測、超過時はIPCバッファリングを調整 |

## タスクステータスの凡例
- `TODO` — 未着手
- `IN_PROGRESS` — 作業中
- `BLOCKED` — ブロック中
- `REVIEW` — レビュー待ち
- `DONE` — 完了

### 運用ルール（TASK-036で追加）

受入基準のチェックボックスが全て`[x]`になるまで、ステータスを`DONE`にしてはならない。
未達の受入基準がある場合は`REVIEW`または`BLOCKED`とし、対応する後続タスクへの参照を明記すること。

過去に受入基準未チェックのままDONE化されていた事例（[phase-7/TASK-021.md](phase-7/TASK-021.md)、
[phase-7/TASK-022.md](phase-7/TASK-022.md)）が判明したため、
[docs/sdd/troubleshooting/2026-07-04-app-unusable/analysis.md](../troubleshooting/2026-07-04-app-unusable/analysis.md)
の是正方針に基づき本ルールを明文化した（[phase-10/TASK-036.md](phase-10/TASK-036.md)）。

---

## ドキュメント構成

```
docs/sdd/tasks/
├── index.md          # このファイル
├── phase-1/          # TASK-001〜003: 開発環境
├── phase-2/          # TASK-004〜007: データ層
├── phase-3/          # TASK-008〜009: MIDI & IPC
├── phase-4/          # TASK-010〜013: UIコア
├── phase-5/          # TASK-014〜016: 練習エンジン
├── phase-6/          # TASK-017〜020: 運指エンジン
├── phase-7/          # TASK-021〜022: パッケージング
├── phase-8/          # TASK-024〜028: 結線修正・UX改善（フェーズA）
├── phase-9/          # TASK-029〜033: 仕様再定義・データモデル刷新（フェーズB）
├── phase-10/         # TASK-034〜036: QA・プロセス改善（フェーズC）
├── phase-11/         # TASK-039〜047: 品質是正・機能補完（2026-07-05横断チェック起点）
└── phase-12/         # TASK-048〜054: 実機フィードバック対応（2026-07-05）
```
