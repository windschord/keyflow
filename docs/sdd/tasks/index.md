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
| Zustand バージョン | v5（2026-07-13にDependabotでv4から更新） | [x] 設計判断として決定 |
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
| Phase 12: 実機フィードバック対応（2026-07-05） | 7 | 0 | 0 | 0 | [詳細](phase-12/) @phase-12/ |
| Phase 13: UI改善要望（2026-07-06） | 6 | 0 | 0 | 0 | [詳細](phase-13/) @phase-13/ |
| Phase 14: メトロノーム修正・アクセント（2026-07-07） | 7 | 0 | 0 | 0 | [詳細](phase-14/) @phase-14/ |
| Phase 15: UI/UX改善（2026-07-07） | 11 | 4 | 0 | 0 | [詳細](phase-15/) @phase-15/ |
| Phase 16: リリース自動化（2026-07-09） | 1 | 0 | 0 | 0 | [詳細](phase-16/) @phase-16/ |
| Phase 17: セキュリティ強化（2026-07-11） | 5 | 0 | 0 | 0 | [詳細](phase-17/) @phase-17/ |
| Phase 18: サプライチェーン・入力堅牢性強化（2026-07-11） | 5 | 0 | 0 | 0 | [詳細](phase-18/) @phase-18/ |
| Phase 19: UI多言語対応（2026-07-12） | 5 | 0 | 0 | 0 | [詳細](phase-19/) @phase-19/ |
| Phase 20: 楽譜ライブラリ（2026-07-12） | 6 | 0 | 0 | 0 | [詳細](phase-20/) @phase-20/ |

**合計**: 104タスク / 推定合計: 約4930分（AIエージェント作業時間）

> 進行中カウントの基準: `REVIEW`はユーザー実機確認待ちであり完了扱いにしないため、
> 本表の「進行中」列に計上する（TASK-078/080/081/082が該当、2026-07-08是正）。

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

### グループI: Phase 15 第1陣（着手時に並列実行可能）
| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-068 | resources/**, build/**, scripts/generate-icons.mjs, src/renderer/index.html, src/main/index.ts | - |
| TASK-069 | src/renderer/src/types/score.ts, lib/musicxml-parser/** | - |
| TASK-071 | lib/audio-engine/voices.ts, lib/audio-engine/index.ts, assets/samples/** | - |
| TASK-074 | components/Header/Popover.tsx, components/Header/QuickPanel.tsx | - |

### グループJ: Phase 15 第2陣（第1陣完了後に並列実行可能）
| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-070 | lib/audio-engine/pedal-extension.ts, lib/audio-engine/index.ts | TASK-069, TASK-071 |
| TASK-075 | components/Header/index.tsx, App.tsx, Toolbar/** | TASK-074 |

> `lib/audio-engine/index.ts` を共有する TASK-070→072、`SettingsModal` を共有する
> TASK-073→076 はそれぞれ順次実行とする。最後に TASK-077（統合検証）を単独実行する。

### グループK: Phase 17（着手時に並列実行可能）

| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-086 | src/main/path-allowlist.ts, src/main/index.ts, renderer結線 | - |
| TASK-089 | package.json, package-lock.json | - |

> TASK-086→087→088 は `src/main/index.ts` を共有するため順次実行とする。
> 最後に TASK-090（統合検証・ドキュメント同期）を単独実行する。

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
| TASK-048 | [BugFix] 2段譜対応: Note.staff/hand導入と手判定のNote単位化 | DONE | - | 90min | [詳細](phase-12/TASK-048.md) @phase-12/TASK-048.md |
| TASK-049 | [BugFix] noteIdマッピングの照合ベース化とリサイズ/ズーム座標ずれ修正 | DONE | TASK-048 | 90min | [詳細](phase-12/TASK-049.md) @phase-12/TASK-049.md |
| TASK-050 | [BugFix] 運指提案の和音対応（コードユニットDP＋符頭単位描画） | DONE | TASK-048, TASK-049 | 120min | [詳細](phase-12/TASK-050.md) @phase-12/TASK-050.md |
| TASK-051 | 再生の練習対象フィルタ・カーソル位置からの再生・音単位カーソル移動 | DONE | TASK-048 | 90min | [詳細](phase-12/TASK-051.md) @phase-12/TASK-051.md |
| TASK-052 | 音量調整（マスターボリューム） | DONE | - | 40min | [詳細](phase-12/TASK-052.md) @phase-12/TASK-052.md |
| TASK-053 | ドラッグ＆ドロップでのファイルオープン | DONE | - | 50min | [詳細](phase-12/TASK-053.md) @phase-12/TASK-053.md |
| TASK-054 | [BugFix] チェックボックスラベルの視認性修正とテンプレートCSS残骸整理 | DONE | - | 30min | [詳細](phase-12/TASK-054.md) @phase-12/TASK-054.md |

### Phase 13: UI改善要望（2026-07-06）
*推定期間: 160min（3タスクとも独立・並列可）*

> 2026-07-06 のユーザー要望3件に基づくタスク群。

| タスクID | タイトル | ステータス | 依存 | 見積 | 詳細リンク |
|----------|---------|-----------|------|------|-----------|
| TASK-055 | 運指の一括表示/非表示トグル | DONE | - | 40min | [詳細](phase-13/TASK-055.md) @phase-13/TASK-055.md |
| TASK-056 | 画面下キーボードの鍵盤数指定 | DONE | - | 60min | [詳細](phase-13/TASK-056.md) @phase-13/TASK-056.md |
| TASK-057 | [BugFix] 再生中の鍵盤表示を音価（長音/短音）に追随させる | DONE | - | 60min | [詳細](phase-13/TASK-057.md) @phase-13/TASK-057.md |
| TASK-058 | 画面下キーボードのセンタリングと余白色の調整 | DONE | TASK-056 | 30min | [詳細](phase-13/TASK-058.md) @phase-13/TASK-058.md |
| TASK-059 | 運指トグルのスイッチ型UI化 | DONE | TASK-055 | 30min | [詳細](phase-13/TASK-059.md) @phase-13/TASK-059.md |
| TASK-060 | [BugFix] グレーアウト表示を白ベールから音符のグレー描画へ変更 | DONE | - | 60min | [詳細](phase-13/TASK-060.md) @phase-13/TASK-060.md |

### Phase 14: メトロノーム修正・一拍目アクセント（2026-07-07）
*推定期間: 260min（順次実行: 061→062→063、064はTASK-062後に並行可。065→066は順次、067は独立）*

> 2026-07-07 のメトロノーム無音報告と一拍目アクセント要望の分析レポート
> （[docs/sdd/troubleshooting/2026-07-07-metronome-no-sound/analysis.md](../troubleshooting/2026-07-07-metronome-no-sound/analysis.md)）
> の承認済み修正方針に基づくタスク群（REQ-006-005是正、REQ-006-008追加）。
> TASK-065〜067 は実機フィードバック3件の分析レポート
> （[docs/sdd/troubleshooting/2026-07-07-metronome-feedback/analysis.md](../troubleshooting/2026-07-07-metronome-feedback/analysis.md)）
> に基づく追加タスク群（REQ-006-009/010追加）。

| タスクID | タイトル | ステータス | 依存 | 見積 | 詳細リンク |
|----------|---------|-----------|------|------|-----------|
| TASK-061 | [BugFix] メトロノーム無音の修正（Sequence nullイベント） | DONE | - | 30min | [詳細](phase-14/TASK-061.md) @phase-14/TASK-061.md |
| TASK-062 | メトロノーム一拍目アクセント（エンジン実装） | DONE | TASK-061 | 40min | [詳細](phase-14/TASK-062.md) @phase-14/TASK-062.md |
| TASK-063 | 一拍目アクセントのUIオプションと永続化 | DONE | TASK-062 | 40min | [詳細](phase-14/TASK-063.md) @phase-14/TASK-063.md |
| TASK-064 | [BugFix] クリック間隔のPPQ追随（Sequence再生成） | DONE | TASK-062 | 30min | [詳細](phase-14/TASK-064.md) @phase-14/TASK-064.md |
| TASK-065 | [BugFix] メトロノーム再有効化で無音（Sequence毎回再生成） | DONE | - | 30min | [詳細](phase-14/TASK-065.md) @phase-14/TASK-065.md |
| TASK-066 | メトロノーム単独再生（Tone.Clock） | DONE | TASK-065 | 60min | [詳細](phase-14/TASK-066.md) @phase-14/TASK-066.md |
| TASK-067 | 再生中のテンポ設定UIロック | DONE | - | 30min | [詳細](phase-14/TASK-067.md) @phase-14/TASK-067.md |

### Phase 15: UI/UX改善（2026-07-07）
*推定期間: 520min（下記の並列実行グループ参照）*

> 2026-07-07 のUI/UX改善要望（アイコン・タイトル・ヘッダー1行化・音色選択・ペダル再生・Aboutページ）
> に基づくタスク群。要件: US-011〜015、設計: components/{app-branding,header,instrument-voices,pedal-playback,about-page}.md、
> DEC-006〜008。作業ブランチ: `feature/phase-15-uiux-improvements`

| タスクID | タイトル | ステータス | 依存 | 見積 | 詳細リンク |
|----------|---------|-----------|------|------|-----------|
| TASK-068 | アプリのブランディング（アイコン生成・ウィンドウタイトル） | DONE | - | 60min | [詳細](phase-15/TASK-068.md) @phase-15/TASK-068.md |
| TASK-069 | ペダル記号のパースとScore型拡張 | DONE | - | 40min | [詳細](phase-15/TASK-069.md) @phase-15/TASK-069.md |
| TASK-070 | ペダル区間の再生反映（リリース延長） | DONE | TASK-069, TASK-071 | 40min | [詳細](phase-15/TASK-070.md) @phase-15/TASK-070.md |
| TASK-071 | 再生音色ファクトリとSalamanderサンプル同梱 | DONE | - | 60min | [詳細](phase-15/TASK-071.md) @phase-15/TASK-071.md |
| TASK-072 | メトロノーム音色の選択（エンジン実装） | DONE | TASK-070 | 40min | [詳細](phase-15/TASK-072.md) @phase-15/TASK-072.md |
| TASK-073 | 音色設定の永続化と設定UI・再生時ロード待ち | DONE | TASK-071, TASK-072 | 50min | [詳細](phase-15/TASK-073.md) @phase-15/TASK-073.md |
| TASK-074 | 汎用Popover・QuickPanelコンポーネント | DONE | - | 40min | [詳細](phase-15/TASK-074.md) @phase-15/TASK-074.md |
| TASK-075 | 1行ヘッダー統合（Toolbar・上段バー置換） | DONE | TASK-074 | 90min | [詳細](phase-15/TASK-075.md) @phase-15/TASK-075.md |
| TASK-076 | Aboutページ（ライセンス自動生成・バージョン・LICENSE） | DONE | TASK-073, TASK-071 | 60min | [詳細](phase-15/TASK-076.md) @phase-15/TASK-076.md |
| TASK-077 | Phase 15統合検証・トレーサビリティ更新 | DONE | TASK-068〜076 | 40min | [詳細](phase-15/TASK-077.md) @phase-15/TASK-077.md |
| TASK-078 | [BugFix] QuickPanelがoverflow:hiddenでクリップされ表示されない | REVIEW | TASK-075 | 40min | [詳細](phase-15/TASK-078.md) @phase-15/TASK-078.md |
| TASK-079 | ヘッダー再編成（メトロノーム常駐・表示補助パネル整理） | DONE | TASK-078 | 50min | [詳細](phase-15/TASK-079.md) @phase-15/TASK-079.md |
| TASK-080 | 開発モードのDockアイコン適用とブランディング制約の明文化 | REVIEW | TASK-068 | 20min | [詳細](phase-15/TASK-080.md) @phase-15/TASK-080.md |
| TASK-081 | [BugFix] 和音を含む譜面でグレーアウトが残留・累積する問題の修正 | REVIEW | - | 40min | [詳細](phase-15/TASK-081.md) @phase-15/TASK-081.md |
| TASK-082 | Aboutを設定画面から分離しメニューバーから開く独立モーダルへ | REVIEW | TASK-076 | 50min | [詳細](phase-15/TASK-082.md) @phase-15/TASK-082.md |
| TASK-083 | アプリ名をリポジトリ名「keyflow」へ統一 | REVIEW | TASK-082 | 40min | [詳細](phase-15/TASK-083.md) @phase-15/TASK-083.md |
| TASK-084 | [BugFix] パッケージ版でメインウィンドウが表示されない問題の修正 | REVIEW | TASK-080, TASK-083 | 50min | [詳細](phase-15/TASK-084.md) @phase-15/TASK-084.md |

### Phase 16: リリース自動化（2026-07-09）
*推定期間: 40min*

> リリースワークフロー（`.github/workflows/release.yml`）のmacOS対応。TASK-035で整備した
> `build:mac` をCIへ組み込み、タグpush時にWindows/macOS両方の成果物を単一のGitHub Releaseへ
> 添付する。作業ブランチ: `feature/task-085-mac-release-ci`

| タスクID | タイトル | ステータス | 依存 | 見積 | 詳細リンク |
|----------|---------|-----------|------|------|-----------|
| TASK-085 | リリースワークフローへのmacOSビルドジョブ追加 | DONE | TASK-035 | 40min | [詳細](phase-16/TASK-085.md) @phase-16/TASK-085.md |

### Phase 17: セキュリティ強化（2026-07-11）
*推定期間: 180min（086/089は並列可。086→087→088は順次、090は最後に単独実行）*

> 2026-07-11 のセキュリティ調査（重大な脆弱性なし・多層防御の改善推奨5件）に基づくタスク群。
> 作業ブランチ: `fix/security-hardening`

| タスクID | タイトル | ステータス | 依存 | 見積 | 詳細リンク |
|----------|---------|-----------|------|------|-----------|
| TASK-086 | file:read系IPCの読み取りallowlist化 | DONE | - | 40min | [詳細](phase-17/TASK-086.md) @phase-17/TASK-086.md |
| TASK-087 | ウィンドウナビゲーション強化（openExternal検証・will-navigate・sandbox試行） | DONE | TASK-086 | 30min | [詳細](phase-17/TASK-087.md) @phase-17/TASK-087.md |
| TASK-088 | E2E計装の本番ビルド無効化（KEYFLOW_E2Eフラグ経路） | DONE | TASK-087 | 50min | [詳細](phase-17/TASK-088.md) @phase-17/TASK-088.md |
| TASK-089 | 開発依存の既知脆弱性解消（textlint 15系ほか） | DONE | - | 30min | [詳細](phase-17/TASK-089.md) @phase-17/TASK-089.md |
| TASK-090 | Phase 17統合検証・ドキュメント同期 | DONE | TASK-086〜089 | 30min | [詳細](phase-17/TASK-090.md) @phase-17/TASK-090.md |

### Phase 18: サプライチェーン・入力堅牢性強化（2026-07-11）
*推定期間: 210min（091/092/093/094は並列可。095は最後に単独実行）*

> 2026-07-11 のサプライチェーン・脆弱性調査（重大な脆弱性なし・改善推奨6件）に基づくタスク群。
> コード署名はスコープ外（ユーザー承認済み、attestation + SHA256で代替）。作業ブランチ: `feature/phase-18-supply-chain-hardening`

| タスクID | タイトル | ステータス | 依存 | 見積 | 詳細リンク |
|----------|---------|-----------|------|------|-----------|
| TASK-091 | MusicXML/MXLパースの入力堅牢化（zip爆弾・XMLサイズ/DOCTYPE） | DONE | - | 60min | [詳細](phase-18/TASK-091.md) @phase-18/TASK-091.md |
| TASK-092 | アノテーションJSONのスキーマ・値域検証 | DONE | - | 40min | [詳細](phase-18/TASK-092.md) @phase-18/TASK-092.md |
| TASK-093 | リリース成果物の完全性（SHA256 + attestation） | DONE | - | 50min | [詳細](phase-18/TASK-093.md) @phase-18/TASK-093.md |
| TASK-094 | 依存自動更新体制（Dependabot）とElectronパッチ更新 | DONE | - | 30min | [詳細](phase-18/TASK-094.md) @phase-18/TASK-094.md |
| TASK-095 | Phase 18統合検証・ドキュメント同期 | DONE | TASK-091〜094 | 30min | [詳細](phase-18/TASK-095.md) @phase-18/TASK-095.md |

#### 並列実行グループL: Phase 18（着手時に並列実行可能）

| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-091 | src/renderer/src/lib/musicxml-parser/** | - |
| TASK-092 | src/renderer/src/lib/annotation-store/** | - |
| TASK-093 | .github/workflows/release.yml, README | - |
| TASK-094 | .github/dependabot.yml, package.json | - |

> TASK-093とTASK-094はいずれもリポジトリ設定系だが対象ファイルが重ならないため並列可。
> 最後に TASK-095（統合検証・ドキュメント同期）を単独実行する。

### Phase 19: UI多言語対応（2026-07-12）

> US-016（UIの日英切り替え、REQ-016-001〜007）の実装フェーズ。
> 設計は [design/components/i18n.md](../design/components/i18n.md) と
> [DEC-009](../design/decisions/DEC-009.md) を正とする。作業ブランチ: `feat/ui-i18n`

| タスクID | タスク名 | ステータス | 依存 | 見積 | 詳細 |
|---------|---------|-----------|------|------|------|
| TASK-096 | i18n基盤（リソース・型・言語解決・useTranslation・ui-slice） | DONE | - | 60min | [詳細](phase-19/TASK-096.md) @phase-19/TASK-096.md |
| TASK-097 | 操作系UIの文言外部化（Header・Toolbar・Stats・Fingering・NoteContextMenu） | DONE | TASK-096 | 90min | [詳細](phase-19/TASK-097.md) @phase-19/TASK-097.md |
| TASK-098 | 設定・About・エラー表示の文言外部化と言語セレクタUI | DONE | TASK-096 | 90min | [詳細](phase-19/TASK-098.md) @phase-19/TASK-098.md |
| TASK-099 | メニューバーの多言語化と言語変更時の再構築（Main側） | DONE | TASK-096 | 60min | [詳細](phase-19/TASK-099.md) @phase-19/TASK-099.md |
| TASK-100 | Phase 19統合検証・E2E言語切り替え・ドキュメント同期 | DONE | TASK-096〜099 | 60min | [詳細](phase-19/TASK-100.md) @phase-19/TASK-100.md |

#### 並列実行グループM: Phase 19（TASK-096完了後に並列実行可能）

| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-097 | src/renderer/src/components/{Header,Toolbar,StatsDisplay,FingeringPanel,NoteContextMenu}/**, lib/i18n/ja.ts, lib/i18n/en.ts | TASK-096 |
| TASK-098 | src/renderer/src/components/{SettingsModal,AboutPanel}/**, App.tsx, lib/i18n/ja.ts, lib/i18n/en.ts | TASK-096 |
| TASK-099 | src/main/** | TASK-096 |

> TASK-097とTASK-098はいずれも `lib/i18n/ja.ts`・`en.ts` へ文言を追加するため
> コンフリクトしやすい。単一ワーキングツリーでは順次実行を推奨する。
> TASK-099はMain側のみで独立。最後に TASK-100（統合検証）を単独実行する。

### Phase 20: 楽譜ライブラリ（2026-07-12）

> US-017（楽譜ライブラリ、REQ-017-001〜011）の実装フェーズ。
> 設計は [design/components/score-library.md](../design/components/score-library.md) と
> [DEC-010](../design/decisions/DEC-010.md) を正とする。作業ブランチ: `feat/score-library`
> （feat/ui-i18n基点。ライブラリ画面の文言がi18n機構に依存するため）

| タスクID | タスク名 | ステータス | 依存 | 見積 | 詳細 |
|---------|---------|-----------|------|------|------|
| TASK-101 | LibraryServiceとlibrary:* IPC（Main側・preload公開） | DONE | - | 90min | [詳細](phase-20/TASK-101.md) @phase-20/TASK-101.md |
| TASK-102 | LibraryView（一覧・検索・並べ替え・削除・空状態・i18n） | DONE | TASK-101 | 90min | [詳細](phase-20/TASK-102.md) @phase-20/TASK-102.md |
| TASK-103 | ライブラリ統合（自動登録・開くフロー・画面切り替え・欠損処理） | DONE | TASK-101, TASK-102 | 90min | [詳細](phase-20/TASK-103.md) @phase-20/TASK-103.md |
| TASK-104 | Phase 20統合検証・ライブラリE2E・ドキュメント同期 | DONE | TASK-101〜103 | 60min | [詳細](phase-20/TASK-104.md) @phase-20/TASK-104.md |
| TASK-105 | ライブラリ画面から元の楽譜表示へ戻る導線（REQ-017-012） | DONE | TASK-103 | 45min | [詳細](phase-20/TASK-105.md) @phase-20/TASK-105.md |
| TASK-106 | [BugFix] ライブラリ往復時のOSMD再レンダリング抑止（即時復帰） | DONE | TASK-105 | 45min | [詳細](phase-20/TASK-106.md) @phase-20/TASK-106.md |

> TASK-101→102→103→104の順次実行とする（102はUI、103が結線のため実質直列）。
> TASK-105・TASK-106は2026-07-13の実機フィードバック起点の追加タスク
> （106の分析: [troubleshooting/2026-07-13-library-return-blank/](../troubleshooting/2026-07-13-library-return-blank/analysis.md)）。

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
├── phase-12/         # TASK-048〜054: 実機フィードバック対応（2026-07-05）
├── phase-13/         # TASK-055〜060: UI改善要望（2026-07-06）
├── phase-14/         # TASK-061〜067: メトロノーム修正・一拍目アクセント（2026-07-07）
├── phase-15/         # TASK-068〜084: UI/UX改善（2026-07-07）
├── phase-16/         # TASK-085: リリース自動化（2026-07-09）
├── phase-17/         # TASK-086〜090: セキュリティ強化（2026-07-11）
├── phase-18/         # TASK-091〜095: サプライチェーン・入力堅牢性強化（2026-07-11）
├── phase-19/         # TASK-096〜100: UI多言語対応（2026-07-12）
└── phase-20/         # TASK-101〜104: 楽譜ライブラリ（2026-07-12）
```
