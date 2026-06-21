# TASK-022: 統合テスト・E2Eシナリオ整備

**ステータス**: TODO
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

- [ ] シナリオ1〜3の統合テストが全パス
- [ ] 運指計算パフォーマンステストが30秒以内でパス
- [ ] `npm run test:coverage` でカバレッジレポートが生成される
- [ ] カバレッジが主要モジュール（parser, practice-engine, fingering dp-solver）で80%以上

**依存関係**: TASK-021
