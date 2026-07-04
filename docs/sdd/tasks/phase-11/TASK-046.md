# TASK-046: テストスイート是正（再発防止策の適用）

## 基本情報

| 項目 | 内容 |
| ----- | ------ |
| ID | TASK-046 |
| タイプ | test |
| ステータス | TODO |
| 優先度 | Medium |
| 見積もり | 60分 |
| 依存タスク | TASK-043 |

## 背景

### 問題の概要

2026-07-05のテストすり抜け分析で確立した再発防止策（E2Eの空虚合格禁止・結線テストの対書き・StrictMode環境の再現）を既存テストスイートへ適用する。あわせて、検証欠落（M8）と要件不一致（M6）を是正する。

（分析レポート: `docs/sdd/troubleshooting/2026-07-05-test-escape/analysis.md` 再発防止策1〜3、M6、M8）

### 根本原因

- `tests/e2e/app.spec.ts:244-248` のカーソル座標検証が `if (cursorBoundsBefore && cursorBoundsAfter)` ガード内にあり、カーソル要素が取得できないと**アサーションを一切実行せずに合格**する（空虚合格。再発防止策1で禁止したパターン）。
- `ScoreRenderer.test` は `practiceMode` 変更→`setPartOpacity` 呼び出し（`ScoreRenderer/index.tsx:89-104`）の結線をアサートしていない（traceability REQ-002-007「結線は未アサート」）。
- `thumbPassingCost` / `fiveOnBlackCost`（`src/renderer/src/workers/fingering/cost-functions.ts`）は実装済みだがテストゼロ（REQ-009-A03/A04）。
- BPMクランプが要件（元テンポ比20〜200%: REQ-006-003）でなく絶対値20〜400で実装され（`ui-slice.ts:26` の `setBpm`、`TempoControl.tsx:24,36,67`）、テストが実装値を仕様化している。`TempoControl.tsx:56` のtitle文言は「20%〜200%」であり実装と自己矛盾。
- jsdomテストが `render()` をStrictModeでラップしないため、エフェクトの二重実行で壊れる実装（dispose問題等）がテストで再現しない（要因3）。

### 関連する仕様

- REQ-006-003: システムは元のテンポの20%〜200%の範囲でテンポ変更をサポートしなければならない
- REQ-009-A03（thumb passingコスト）、REQ-009-A04（黒鍵5指コスト）、REQ-002-007（非練習パートのグレーアウト）
- CLAUDE.mdテスト方針（分析時に追記済み: 空虚合格の禁止・結線テストの対書き・StrictMode）

## 実装内容

### 修正対象

- ファイル: `tests/e2e/app.spec.ts`
  - 変更内容: :244-248 の `if` ガードを廃止し、カーソル要素（`#cursorImg-0`）の存在と `cursorBoundsBefore` / `cursorBoundsAfter` が非nullであることを**先にassert**してから座標変化を検証する。他に同型の `if` ガード内アサーションがあれば同様に是正する。
- ファイル: `src/renderer/src/components/ScoreRenderer/ScoreRenderer.test.tsx`
  - 変更内容: `practiceMode` を right/left/both に変えたとき、`setPartOpacity` が各パートへ期待どおりの不透明度（非練習パート0.5、それ以外1.0）で呼ばれることをアサートする結線テストを追加する。
- ファイル: `src/renderer/src/workers/fingering/cost-functions.test.ts`
  - 変更内容: `thumbPassingCost`（REQ-009-A03）と `fiveOnBlackCost`（REQ-009-A04）のテストを、設計書 `docs/sdd/design/components/fingering-engine.md` のコスト表由来の期待値で追加する。
- ファイル: `src/renderer/src/store/slices/ui-slice.ts`、`src/renderer/src/components/Toolbar/TempoControl.tsx` と各テスト
  - 変更内容: BPMクランプを要件（`originalBpm` の20%〜200%）に整合させる。`setBpm` の絶対値20〜400クランプ（`ui-slice.ts:26`）と `TempoControl.tsx:24,36,66-67` の絶対値min/maxを、元テンポ比ベースへ修正し、テストを要件由来の期待値に書き換える。
- ファイル: `src/renderer/src/tests/` 配下（新規ヘルパー。例: `test-utils.tsx`）
  - 変更内容: `render` 時に `<React.StrictMode>` で包むヘルパー（例: `renderStrict`）を導入し、コンポーネント/フックテストへ段階適用する。

### 実装手順

TDDの精神（要件から期待値を書く）で進める。実装変更を伴うのは(4)のみ。

1. E2E是正: `app.spec.ts:244-248` の前提要素（カーソル要素・座標）を先にassertする形へ書き換え、E2Eを実行して合格を確認する（カーソルが実在するため通るはず。通らなければ実バグとして別途起票）。
2. `ScoreRenderer.test` に `practiceMode`→`setPartOpacity` の結線アサーションを追加する（`OSMDController` をモックし呼び出しを検証）。
3. `cost-functions.test.ts` に `thumbPassingCost` / `fiveOnBlackCost` のテストを追加する（redになった場合は実装バグなので、設計書のコスト表に合わせて実装を修正する）。
4. BPMクランプ: 先に要件由来のテスト（例: `originalBpm=100` なら20〜200、`originalBpm=60` なら12〜120にクランプ）を書いてredを確認し、`setBpm` / `TempoControl` を修正してgreenにする。既存テストの絶対値期待（20〜400）は要件由来の期待値へ書き換える。
5. StrictModeヘルパーを導入し、まず主要コンポーネント（App / ScoreRenderer / PianoKeyboard / Toolbar / SettingsModal）とフック（usePractice / useMidi）のテストへ適用する。二重マウントで落ちるテストが出た場合は実装のリソース管理バグとして扱い、軽微なら本タスクで修正、大きければ別タスクへ切り出す。
6. `docs/sdd/requirements/traceability.md` の REQ-002-007・REQ-006-003・REQ-009-A03/A04 行を更新する。

### 注意事項

- 本タスクの主旨は「テストを実装に合わせる」のではなく「要件からテストを書き直す」こと（分析レポート要因5）。期待値の出典（REQ ID・設計書のコスト表）をテスト内コメントに明記する。
- BPMクランプ修正では `setOriginalBpm`（`ui-slice.ts:29-32`）のクランプとの整合も確認する（元テンポ自体はクランプ対象の基準値であり、比率クランプの対象は `bpm` のみ）。`originalBpm` 未設定（初期値120）時の挙動もテストで固定する。
- 依存タスクTASK-043が `dp-solver.test.ts` を是正するため、本タスクのコスト関数テスト追加と衝突しないよう完了後に着手する。
- StrictMode適用は「段階導入」でよい（全テスト一括置換は不要）。ヘルパーを標準として `src/renderer/src/tests/` に置き、以後の新規テストで使う旨をコメントに残す。
- E2Eの是正で `expect(cursor).not.toBeNull()` 等の前提assertを追加する際、待機（poll/waitFor）が必要な箇所ではPlaywrightの自動リトライを使い、固定sleepを追加しない。

## 受入基準

- [ ] `tests/e2e/app.spec.ts` のカーソル座標検証が、カーソル要素の存在を先にassertし、`if` ガードによる無言スキップが存在しない
- [ ] `ScoreRenderer.test` が practiceMode→setPartOpacity の結線（非練習パート0.5／その他1.0）をアサートしている
- [ ] `thumbPassingCost` / `fiveOnBlackCost` のテストが設計書のコスト表由来の期待値で存在する
- [ ] BPMが元テンポ比20〜200%でクランプされ、実装とテストとUI文言（title）が一致している
- [ ] StrictModeレンダリングヘルパーが導入され、主要コンポーネント/フックのテストに適用されている
- [ ] `docs/sdd/requirements/traceability.md` の該当行が更新されている
- [ ] 既存のテストが通る
- [ ] 新規テストが追加されている（必要な場合）

## テスト項目

- [ ] （是正・E2E）カーソル要素の存在assert＋座標変化assert（無言スキップなし）
- [ ] （新規・結線）practiceMode right/left/both それぞれでの `setPartOpacity` 呼び出し内容
- [ ] （新規・ユニット）`thumbPassingCost`: 代表ケース（親指くぐり発生/非発生、方向・距離）のコスト
- [ ] （新規・ユニット）`fiveOnBlackCost`: 5指が黒鍵に乗るケース/乗らないケースのコスト
- [ ] （是正・ユニット）`setBpm`: `originalBpm` 比20%未満・200%超のクランプ、境界値
- [ ] （是正・コンポーネント）TempoControl: スライダー/入力の範囲が元テンポ比に連動する
- [ ] （新規・環境）StrictModeヘルパー適用下で主要コンポーネント/フックのテストが通る
- [ ] （回帰）`npm run test` 全件グリーン、`npm run test:e2e`（実行環境がある場合）、`npm run typecheck` / `npm run lint` パス

## 情報の明確性

### 明示された情報

- 是正対象のfile:line（M6・M8、実コードで検証済み: `app.spec.ts:244-248` の `if` ガード、`ui-slice.ts:26` / `TempoControl.tsx:24,36,56,66-67` のクランプ不一致、cost-functionsテストゼロ、`ScoreRenderer/index.tsx:89-104` の未アサート結線）
- 適用する再発防止策1〜3（分析レポートで承認待ちの方針TASK-046として明記済み）

### 不明/要確認の情報

- なし（すべて確認済み。StrictMode適用で新たな実装バグが露見した場合の扱い（本タスク内修正か切り出しか）は規模により実装時判断とする）
