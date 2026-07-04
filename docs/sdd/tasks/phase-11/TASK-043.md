# TASK-043: 運指エンジンへのscale-patterns統合

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-043 |
| タイプ | feature |
| ステータス | TODO |
| 優先度 | Medium |
| 見積もり | 50分 |
| 依存タスク | なし |

## 背景

### 問題の概要

TASK-019で実装したスケール定型パターン（全24調、`scale-patterns.ts`）が運指エンジンに統合されておらず、デッドコードのまま。運指提案はスケール箇所でも純粋DPの結果を返すため、Cメジャースケールで標準運指 1-2-3-1-2-3-4-5 が保証されない。要件REQ-009-A06（定型パターンの優先適用）が未達なのに、テストが実装に合わせて弱体化されているため全緑になっている。

（分析レポート: `docs/sdd/troubleshooting/2026-07-05-test-escape/analysis.md` H3）

### 根本原因

- `src/renderer/src/workers/fingering/scale-patterns.ts` は `SCALE_PATTERNS`（:214）、`detectScalePattern`（:216）、`applyScalePattern`（:251）をエクスポートしているが、`fingering.worker.ts` は `computeFingering` のみをimport（`fingering.worker.ts:2`）し、`dp-solver.ts` もscale-patternsをimportしていない。ユニットテスト（`scale-patterns.test.ts`）からのみ参照されるデッドコード。
- `dp-solver.test.ts:26-39` は「TASK-019 のスケール定型パターンを使わない純粋なDPでは 1-2-3-1-2-3-4-5 とは限らない」というコメント（:33-35）とともに、アサーションを「親指が含まれる」程度に弱体化しており、要件を実装に合わせて書き換えた形跡そのもの。

### 関連する仕様

- REQ-009-A06: エンジンはスケール・アルペジオの定型運指パターンを優先的に適用しなければならない
- `docs/sdd/design/components/fingering-engine.md`（コスト関数・DP設計）
- `docs/sdd/tasks/phase-6/TASK-019.md`（scale-patterns実装。統合は本タスクまで未着手）
- `docs/sdd/requirements/traceability.md` REQ-009-A06行: 「×※ scale-patterns.tsが本番未結線のデッドコード（TASK-043）」

## 実装内容

### 修正対象

- ファイル: `src/renderer/src/workers/fingering/dp-solver.ts`（または `fingering.worker.ts`）
  - 変更内容: `detectScalePattern` / `applyScalePattern` を統合する。運指計算時にまずスケール定型パターンの検出を行い、一致した区間には定型運指を優先適用し、非該当区間はDPで解く。統合位置は `computeFingering` 内（推奨: workerとサービス双方から同じ結果が得られ、既存の `dp-solver.test.ts` がそのまま統合経路のテストになる）か、worker側のディスパッチとするかを実装時に決定し、コメントで理由を明記する。
- ファイル: `src/renderer/src/workers/fingering/dp-solver.test.ts`
  - 変更内容: :26-39 の弱体化されたコメント・アサーションを、要件REQ-009-A06由来の期待値に是正する。Cメジャースケール8音（右手）で `1-2-3-1-2-3-4-5` が返ることを厳密にアサートする。
- ファイル: `src/renderer/src/workers/fingering/scale-patterns.test.ts`
  - 変更内容: 必要に応じて統合経由のテストケースを追加する（既存のパターン単体テストは維持）。

### 実装手順

TDDで進める。

1. 失敗するテストを先に書く: `dp-solver.test.ts:26-39` のテストを「Cメジャースケール8音（右手）で運指が正確に `[1,2,3,1,2,3,4,5]` になる」に書き換え、弱体化コメント（:33-35）を削除する。左手・下降形など `scale-patterns.ts` がサポートする代表ケースも統合経路で1〜2件追加する。
2. テストを実行し、失敗（red）を確認してコミットする。
3. 統合を実装する: パターン検出→一致時は `applyScalePattern` の結果を採用、不一致時は従来DP。部分一致（フレーズの一部だけがスケール）の扱いは `detectScalePattern` の既存仕様に従う。
4. テストが通る（green）ことを確認する。
5. スケールでない入力（跳躍を含む旋律など）で従来DPの結果が変わらないことを回帰テストで確認する。
6. `docs/sdd/requirements/traceability.md` の REQ-009-A06 行を更新する。

### 注意事項

- `scale-patterns.ts` 本体のロジックは原則変更しない（統合のみ）。統合にあたりシグネチャ変更が必要な場合は最小限にとどめ、既存の `scale-patterns.test.ts` を維持する。
- 進捗コールバック・60秒デッドライン（`fingering.worker.ts:8`、`computeFingering` の引数）の挙動を壊さないこと。パターン適用経路でも `RESULT` メッセージの型（`FingeringResponse`）は不変。
- テストの是正は「実装に合わせて期待値を書く」のではなく「要件から期待値を書く」こと（本タスクの主旨。分析レポート要因5参照）。
- FingeringEngineService・FingeringPanel側の変更は不要（worker境界のメッセージ型が不変のため）。

## 受入基準

- [ ] Cメジャースケール8音（右手）の運指提案が `1-2-3-1-2-3-4-5` になる（統合経路のテストで検証）
- [ ] `scale-patterns.ts` が本番経路（`computeFingering` またはworker）からimportされ、デッドコードでなくなっている
- [ ] `dp-solver.test.ts:26-39` の弱体化コメント・アサーションが要件由来の期待値に置き換えられている
- [ ] スケール非該当の入力ではDPの既存挙動が維持される（回帰テスト）
- [ ] `docs/sdd/requirements/traceability.md` の REQ-009-A06 行が更新されている
- [ ] 既存のテストが通る
- [ ] 新規テストが追加されている（必要な場合）

## テスト項目

- [ ] （是正・統合）Cメジャースケール右手上行→ `[1,2,3,1,2,3,4,5]`
- [ ] （新規・統合）scale-patternsがサポートする他調・左手の代表ケース1〜2件で定型運指が優先適用される
- [ ] （新規・回帰）スケールに該当しない旋律でパターン適用が発動せず、DP結果が従来どおり
- [ ] （回帰）空配列・単音・和音などdp-solverの既存エッジケースが全て通る
- [ ] （回帰）`npm run test` 全件グリーン、`npm run typecheck` / `npm run lint` パス

## 情報の明確性

### 明示された情報

- 未統合の根拠（H3、実コードで検証済み: `fingering.worker.ts:2` のimport、`scale-patterns.ts` のエクスポート:214/216/251、`dp-solver.test.ts:26-39` の弱体化コメント:33-35）
- 修正方針: パターン検出時は定型運指を優先適用、テストは要件由来の期待値へ是正（分析レポート承認待ち方針TASK-043）

### 不明/要確認の情報

- なし（すべて確認済み。統合位置（dp-solver内かworker内か）は実装時判断とし、判断理由をコードコメントに残す）
