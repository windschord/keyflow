# TASK-079: ヘッダー再編成（メトロノーム常駐・表示補助パネル整理）

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-079 |
| タイプ | feature |
| ステータス | DONE |
| 優先度 | High |
| 見積もり | 50分 |
| 依存タスク | TASK-078 |

## 背景

2026-07-08のユーザー実機フィードバック「⋯と設定画面の分類がわからないので、用途にあわせて配置し直してほしい」を受けた再編成（案A、ユーザー承認済み）。分類の考え方はDEC-007の改訂節を正とする。

## 実装内容

### 修正対象

| ファイル | 変更内容 |
|---------|---------|
| `src/renderer/src/components/Header/index.tsx` | (1) PracticeModeSelectorの右にメトロノームON/OFFトグルボタンを常駐追加（メトロノームSVGアイコン、ON時は背景色でアクティブ表示、`aria-pressed`、ツールチップ「メトロノーム」）。(2) QuickPanel開閉ボタンのアイコンを⋯から目/スライダー系アイコンへ変更し、ツールチップを「表示・補助（音量・表示倍率・運指・成績）」に変更。`data-testid="quick-panel-toggle"` は維持 |
| `src/renderer/src/components/Header/MetronomeToggle.tsx` | ヘッダー常駐用のON/OFFアイコントグル（`metronomeEnabled`のみ操作）へ改修。1拍目強調チェックは新規 `MetronomeAccentToggle`（または同ファイル内の別export）としてQuickPanel側に残す。storeアクション経路は不変 |
| `src/renderer/src/components/Header/QuickPanel.tsx` | セクション見出しを「表示（音量・表示倍率）/ 運指 / 成績 / メトロノーム詳細（1拍目強調）」に再編成。メトロノームON/OFFはヘッダーへ移動したため削除 |
| 各テストファイル | Header.test.tsx（ヘッダーのメトロノームトグル: クリックで`metronomeEnabled`が反転・aria-pressed反映）、QuickPanel.test.tsx（新セクション構成・ON/OFF非表示・1拍目強調残存）を要件から更新 |
| `tests/e2e/app.spec.ts` | TASK-078で追加したメトロノーム実クリック検証を「ヘッダーのトグルボタン実クリック」に変更（検証の意味は維持: 座標ヒットテスト+状態変化） |

### 実装手順（TDD）

1. Header.test.tsx / QuickPanel.test.tsx を新配置の要件で更新・追加（Red確認→テストコミット）
2. 実装 → ユニットGreen
3. E2E追随修正 → `npm run test:e2e` 通過
4. 全ゲート（test / typecheck / lint / format:check / lint:jp）→ 実装コミット

## 受入基準

- [x] ヘッダーにメトロノームON/OFFトグルが常駐し、クリックで即時切替（再生中も操作可能、現行仕様維持）
- [x] QuickPanelがセクション見出し付き（表示/運指/成績/メトロノーム詳細）で、ON/OFF重複がない
- [x] 1拍目強調の操作が引き続き可能（機能の喪失禁止、REQ-012-004）
- [x] ヘッダー1行・高さ56px以下を維持（E2E通過）
- [x] 全ゲート通過（test / typecheck / lint / format:check / lint:jp / test:e2e）

## 完了サマリー（2026-07-08）

メトロノームON/OFFをヘッダー常駐のアイコントグル（`MetronomeToggle`、`data-testid="metronome-toggle"`）へ移動し、
QuickPanelは「表示・補助」用途を示すアイコン＋ツールチップへ変更、セクションを表示（音量+表示倍率）/運指/成績/
メトロノーム詳細（1拍目強調のみ）へ再編成した。1拍目強調は`MetronomeAccentToggle`としてQuickPanel側に残し
機能の喪失はない。E2Eはヘッダートグルの実クリック検証へ更新（TASK-078のクリップ再発防止意図を維持）。
全ゲート（test 713件 / typecheck / lint / format:check / lint:jp / test:e2e 3件）が通過した。
なお、レイアウトの実機ブラウザ目視確認はE2E（実Electronバイナリ起動+実クリック）で代替した。

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | 案Aのレイアウト（ユーザー承認済みプレビュー、2026-07-08）、分類基準（DEC-007改訂） |
| 設計判断として決定 | トグルのアイコンデザイン、アクティブ表示のスタイル、QuickPanelボタンの新アイコン |

## 対応要件

REQ-012-002 / REQ-012-004（再配置後も維持）
