# TASK-022: 統合テスト・E2Eシナリオ整備

**ステータス**: DONE
**推定工数**: 50分
**依存**: TASK-021

---

## 説明

主要ユーザーシナリオの統合テストと、パフォーマンスベンチマークを整備する。

## 対象ファイル

- `src/renderer/src/tests/integration/practice-flow.test.ts` — 練習フロー統合テスト
- `src/renderer/src/tests/integration/fingering-benchmark.test.ts` — 運指計算パフォーマンス
- `src/renderer/src/tests/integration/musicxml-parser-integration.test.ts` — パーサー統合テスト

## テストシナリオ

### シナリオ1: MusicXML読み込み〜練習開始

```typescript
it('MusicXMLを読み込んで右手モードで練習を開始できる', async () => {
  const score = parse(SAMPLE_MUSICXML);
  expect(score.parts).toHaveLength(2);
  expect(score.measures.length).toBeGreaterThan(0);

  const store = createTestStore();
  store.setScore(score, '/test/sample.xml');
  store.setPracticeMode('right');

  const engine = new PracticeEngineService(store);
  const judgement = engine.handleNoteOn({ noteNumber: 60, velocity: 64, channel: 1, timestamp: 0 });
  expect(['correct', 'incorrect']).toContain(judgement.result);
});
```

### シナリオ2: 運指計算パフォーマンス

```typescript
it('100小節（約800音符）の運指計算が30秒以内に完了する', async () => {
  const notes = generate800Notes(); // テスト用ダミー音符列
  const start = performance.now();
  const result = computeFingering(notes, 'right', DEFAULT_SETTINGS);
  const elapsed = performance.now() - start;

  expect(elapsed).toBeLessThan(30_000);
  expect(result.assignments).toHaveLength(800);
}, 35_000); // タイムアウト35秒
```

### シナリオ3: ループ練習フロー

```typescript
it('小節5〜10をループして3周できる', () => {
  // ...ループカウンターが3になることを確認
});
```

## MIDI遅延ベンチマーク

```typescript
// 実際のMIDIハードウェアなしでIPCレイテンシのみを計測
it('IPC転送レイテンシが5ms以内', async () => {
  // mockMidiController でNoteOnを発行し、Renderer側で受信するまでの時間を計測
  // node-midi自体のレイテンシは実機テストで確認（自動テスト外）
});
```

## 受入基準

> **是正（TASK-036、2026-07-04）**: 本タスクは元々ステータス`DONE`のまま以下4項目が全て未チェックで
> 放置されていた。本節はTASK-036の調査時点（`npm run test` / `npm run test:coverage` を実行して確認）で
> 実際に確認できた事実のみをチェックしたものである。ステータス欄自体の再判定はTASK-036のスコープ外とし、行わない。
> なお、ここでいう「統合テスト」は`src/renderer/src/tests/integration/`配下のVitest+jsdomレベルのテストであり、
> 実Electronプロセスを起動した実UIレベルのE2Eは[phase-10/TASK-034.md](../phase-10/TASK-034.md)で別途追加されている
> （`docs/sdd/troubleshooting/2026-07-04-app-unusable/analysis.md`が指摘した「統合テストが`resetToMeasure(1)`を
> 手動呼び出しして初期化欠落を隠蔽していた」問題は、TASK-024（本体側の初期化実装）とTASK-034（実UI E2E追加）で対応済み）。

- [x] シナリオ1〜3の統合テストが全パス
  - `npm run test`実行で`src/renderer/src/tests/integration/practice-flow.test.tsx`（6件）・
    `musicxml-parser-integration.test.ts`（8件）・`fingering-benchmark.test.ts`（3件）を含む
    全51ファイル・289テストが成功することを確認済み（2026-07-04時点）。
- [x] 運指計算パフォーマンステストが30秒以内でパス
  - `fingering-benchmark.test.ts`の「800音符の運指計算が2秒以内に完了する」テストが成功することを確認済み
    （タスク記述の30秒基準よりも厳しい2秒基準で実装されており、これを満たしている）。
- [x] `npm run test:coverage` でカバレッジレポートが生成される
  - 実行してV8カバレッジレポート（`% Coverage report from v8`形式のテキスト出力）が生成されることを確認済み。
- [ ] カバレッジが主要モジュール（parser, practice-engine, fingering dp-solver）で80%以上
  - `npm run test:coverage`実測値（2026-07-04時点）: `musicxml-parser/parser.ts` 95.88%、
    `practice-engine/index.ts` 88.17%（`practice-engine`ディレクトリ全体では90.18%）は80%以上を満たすが、
    `workers/fingering/dp-solver.ts`は**72.97%**（分岐73.91%、関数66.66%）であり基準未達。
    dp-solverのカバレッジ改善は本タスクのスコープ外のため、後続タスクとして別途起票が必要
    （Phase 10には該当タスクが存在しない）。

**依存関係**: TASK-021
