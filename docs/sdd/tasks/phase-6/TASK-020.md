# TASK-020: FingeringEngineService + 運指UI統合

**ステータス**: TODO
**推定工数**: 40分
**依存**: TASK-018, TASK-019

---

## 説明

Web WorkerをRendererから扱うサービスクラスと、
運指提案ボタン・承認フローのUIを実装する。

## 対象ファイル

- `src/renderer/src/lib/fingering-engine/index.ts` — FingeringEngineService
- `src/renderer/src/components/FingeringPanel/index.tsx` — 運指提案UIパネル
- `src/renderer/src/lib/fingering-engine/fingering-engine.test.ts` — テスト（Workerモック）

## 参照設計

- [design/components/fingering-engine.md「Renderer からの呼び出し」セクション](../../design/components/fingering-engine.md)
- [requirements/stories/US-009.md](../../requirements/stories/US-009.md)

## 実装すべきインターフェース

```typescript
// lib/fingering-engine/index.ts
export class FingeringEngineService {
  private worker: Worker;

  async computeFingering(
    notes: Note[],
    hand: 'right' | 'left',
    settings: HandSettings,
    onProgress?: (progress: number) => void
  ): Promise<FingeringResult>;

  cancel(requestId: string): void;
  dispose(): void;
}
```

## UIコンポーネント

```tsx
// components/FingeringPanel/index.tsx
interface FingeringPanelProps {
  score: Score | null;
  onSuggested: (assignments: FingerAssignment[]) => void;
}

// 「運指提案」ボタン
// → 計算中はプログレスバー表示
// → 完了後、楽譜上に薄色で表示（未承認）
// → 「すべて承認」ボタンで確定色に変化
// → 各音符右クリックで個別修正（US-008のAnnotationStore経由）
```

## 受入基準

- [ ] 「運指提案」ボタンクリックでWorkerが起動し、プログレスバーが表示される
- [ ] 計算完了後、楽譜上に未承認運指（薄い色）が表示される
- [ ] 「承認」で確定色（濃い色）へ変わり、AnnotationStoreに保存される
- [ ] Workerが60秒でタイムアウトした場合にエラーメッセージが表示される
- [ ] `FingeringEngineService` のテストが3件以上パス（Workerをモック）

**依存関係**: TASK-018, TASK-019
