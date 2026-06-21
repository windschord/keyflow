# TASK-017: フィンガリングWeb Worker基盤・型定義・コスト関数

**ステータス**: TODO
**推定工数**: 40分
**依存**: Phase 5

---

## 説明

運指提案エンジン（Parncutt-Terzuoloモデル）のWeb Worker基盤を構築する。
型定義・コスト関数テーブル・スパン制約テーブルを実装し、
TASK-018（DPソルバー）とTASK-019（スケールパターン）の基盤とする。

## 対象ファイル（TASK-017の担当範囲）

- `src/renderer/src/workers/fingering/types.ts` — フィンガリングエンジン型定義
- `src/renderer/src/workers/fingering/span-table.ts` — 指ペアスパン制約テーブル
- `src/renderer/src/workers/fingering/cost-functions.ts` — 各コストルール実装
- `src/renderer/src/workers/fingering/fingering.worker.ts` — Worker エントリポイント（骨格のみ）
- `src/renderer/src/workers/fingering/cost-functions.test.ts` — テスト

## 参照設計

- [design/components/fingering-engine.md](../../design/components/fingering-engine.md)（必読 — スパンテーブルと全コストルール定義あり）

## 実装すべき型（types.ts）

```typescript
export type Finger = 1 | 2 | 3 | 4 | 5;
export type Hand = 'right' | 'left';

export interface HandSettings {
  maxSpanSemitones: number;   // デフォルト 14
  scaleFactorLeft: number;    // デフォルト 1.0
}

export interface FingeringRequest {
  type: 'COMPUTE';
  requestId: string;
  notes: Note[];
  hand: Hand;
  settings: HandSettings;
}

export interface FingeringResponse {
  type: 'RESULT' | 'PROGRESS' | 'ERROR';
  requestId: string;
  result?: FingeringResult;
  progress?: number;
  error?: string;
}

export interface FingeringResult {
  assignments: FingerAssignment[];
  totalCost: number;
}

export interface DPState {
  cost: number;
  prevFinger: Finger | null;
}
```

## 実装すべきスパンテーブル（span-table.ts）

```typescript
// [f1][f2] → { comfortable: semitones, max: semitones }
// design/components/fingering-engine.md の「スパン制約テーブル」セクション参照
export const SPAN_TABLE: Record<Finger, Record<Finger, { comfortable: number; max: number }>> = {
  1: { 2: { comfortable: 2, max: 9 }, 3: { comfortable: 4, max: 11 }, ... },
  // ...全ペアを定義
};

export function getSpan(f1: Finger, f2: Finger, hand: Hand, settings: HandSettings): { comfortable: number; max: number };
```

## 実装すべきコスト関数（cost-functions.ts）

```typescript
// design/components/fingering-engine.md の CostRule 参照
export function spanCost(f1: Finger, f2: Finger, n1: Note, n2: Note, hand: Hand, settings: HandSettings): number;
export function weakFingerCost(f: Finger): number;       // 4,5指: +2
export function thumbOnBlackCost(f: Finger, note: Note): number;  // f=1 & 黒鍵: +4
export function fiveOnBlackCost(f: Finger, note: Note): number;   // f=5 & 黒鍵: +3
export function thumbPassingCost(f1: Finger, f2: Finger, n1: Note, n2: Note): number;
export function largeJumpCost(n1: Note, n2: Note): number;

export function totalTransitionCost(
  f1: Finger, f2: Finger, n1: Note, n2: Note, hand: Hand, settings: HandSettings
): number;
```

## Web Worker 骨格（fingering.worker.ts）

```typescript
// TASK-018, 019 完成後に本実装するが、骨格だけ今作る
self.onmessage = (e: MessageEvent<FingeringRequest>) => {
  if (e.data.type === 'COMPUTE') {
    // TODO: DPソルバーを呼ぶ（TASK-018で実装）
    self.postMessage({ type: 'RESULT', requestId: e.data.requestId, result: { assignments: [], totalCost: 0 } });
  }
};
```

## テストケース

```typescript
it('C4(60)からD4(62)へ指1→2のspanCostが0（快適範囲内）', () => { ... });
it('C4(60)からA4(69)へ指1→5のspanCostが0（最大スパン内）', () => { ... });
it('C4(60)からB4(71)へ指1→5のspanCostが>0（最大スパン超過）', () => { ... });
it('薬指(4)使用でweakFingerCostが2になる', () => { ... });
it('黒鍵に親指(1)を使うとthumbOnBlackCostが4になる', () => { ... });
```

## 受入基準

- [ ] `span-table.ts` に全指ペア（1-2, 1-3, ..., 4-5）のスパン制約が定義されている
- [ ] テストケース5件が全パス
- [ ] Web Workerファイルがvite.config.tsで正しくバンドルされる
- [ ] `FingeringRequest` / `FingeringResponse` 型がimportできる

**依存関係**: Phase 5完了
