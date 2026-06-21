# TASK-018: DPソルバー実装（Parncutt-Terzuoloモデル）

**ステータス**: TODO
**推定工数**: 60分
**依存**: TASK-017

---

## 説明

Parncutt-Terzuoloモデルに基づく動的計画法で、最適運指列を計算するDPソルバーを実装する。
Web Worker内から呼び出されるメインのアルゴリズムモジュール。

## 対象ファイル

- `src/renderer/src/workers/fingering/dp-solver.ts` — DPアルゴリズム本体
- `src/renderer/src/workers/fingering/dp-solver.test.ts` — テスト
- `src/renderer/src/workers/fingering/fingering.worker.ts` — DPソルバーの組み込み（TASK-017の骨格を完成させる）

## 参照設計

- [design/components/fingering-engine.md「DPアルゴリズム」セクション](../../design/components/fingering-engine.md)

## 実装すべきインターフェース

```typescript
// dp-solver.ts
export function computeFingering(
  notes: Note[],
  hand: Hand,
  settings: HandSettings,
  onProgress?: (progress: number) => void
): FingeringResult;
```

## DPアルゴリズム（設計書のコードをそのまま実装）

```typescript
export function computeFingering(notes, hand, settings, onProgress): FingeringResult {
  const n = notes.length;
  if (n === 0) return { assignments: [], totalCost: 0 };

  const FINGERS: Finger[] = [1, 2, 3, 4, 5];
  // dp[i][f] = 音符iに指fを割り当てた時の { cost, prevFinger }
  const dp: DPState[][] = Array.from({ length: n }, () =>
    Array(6).fill(null).map(() => ({ cost: Infinity, prevFinger: null }))
  );

  // 初期化: 最初の音符（全指が等コスト）
  for (const f of FINGERS) {
    dp[0][f] = { cost: weakFingerCost(f), prevFinger: null };
  }

  // DP遷移
  for (let i = 1; i < n; i++) {
    for (const f2 of FINGERS) {
      for (const f1 of FINGERS) {
        if (dp[i-1][f1].cost === Infinity) continue;
        const tc = totalTransitionCost(f1, f2, notes[i-1], notes[i], hand, settings);
        const total = dp[i-1][f1].cost + tc;
        if (total < dp[i][f2].cost) {
          dp[i][f2] = { cost: total, prevFinger: f1 };
        }
      }
    }
    // プログレス通知（10音符ごと）
    if (i % 10 === 0) onProgress?.(i / n);
  }

  // バックトラック
  return backtrack(dp, notes);
}

function backtrack(dp: DPState[][], notes: Note[]): FingeringResult {
  const n = notes.length;
  // 最終音符で最小コストの指を選択
  let bestFinger: Finger = 1;
  let minCost = Infinity;
  for (const f of [1,2,3,4,5] as Finger[]) {
    if (dp[n-1][f].cost < minCost) { minCost = dp[n-1][f].cost; bestFinger = f; }
  }
  // 経路を逆向きに復元
  const assignments: FingerAssignment[] = [];
  let f: Finger | null = bestFinger;
  for (let i = n - 1; i >= 0; i--) {
    assignments.unshift({ noteId: notes[i].id, finger: f!, cost: dp[i][f!].cost });
    f = dp[i][f!].prevFinger;
  }
  return { assignments, totalCost: minCost };
}
```

## テストケース（期待値は音楽的に妥当なもの）

```typescript
it('Cメジャースケール上昇（右手）でおおよそ 1-2-3-1-2-3-4-5 の運指が得られる', () => {
  const cMajorNotes = [C4, D4, E4, F4, G4, A4, B4, C5]; // MIDIナンバーで定義
  const result = computeFingering(cMajorNotes, 'right', DEFAULT_SETTINGS);
  // 厳密なパターンではなく、thumb crossing (1→次の音への移行) が含まれることを確認
  const fingers = result.assignments.map(a => a.finger);
  expect(fingers).toHaveLength(8);
  expect(fingers[0]).toBe(1); // スケールは通常親指から始まる
});

it('単音列では合理的な指番号（1〜5の範囲内）が割り当てられる', () => { ... });
it('空配列を渡すと空のassignmentsが返る', () => { ... });
it('1音だけの場合も正常に動作する', () => { ... });
it('手の大きさを小さくするとスパンの大きい運指が回避される', () => { ... });
```

## 受入基準

- [ ] Cメジャースケール（右手）の運指計算が30秒以内に完了する
- [ ] バックトラックで正しい音符数の `assignments` が返る（音符数 = assignments.length）
- [ ] `totalCost` が0以上の値になる
- [ ] テストケース5件が全パス
- [ ] Web Worker内からDPソルバーが呼ばれ、RESULT メッセージが返る

**依存関係**: TASK-017
