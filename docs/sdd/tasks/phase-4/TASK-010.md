# TASK-010: Zustand Store定義（PracticeSessionState）

**ステータス**: TODO
**推定工数**: 30分
**依存**: Phase 3

---

## 説明

アプリ全体の状態管理に Zustand を使用する。
`PracticeSessionState` と各スライスを定義し、
TASK-011〜013（UIコンポーネント）が参照する共通基盤を確立する。

## 対象ファイル

- `src/renderer/src/store/index.ts` — usePracticeStore（全スライス統合）
- `src/renderer/src/store/slices/score-slice.ts` — 楽譜関連状態
- `src/renderer/src/store/slices/practice-slice.ts` — 練習セッション状態
- `src/renderer/src/store/slices/ui-slice.ts` — UI設定状態

## 依存ライブラリ

```bash
npm install zustand
```

## 参照設計

- [design/components/practice-engine.md「状態定義」セクション](../../design/components/practice-engine.md)

## 実装すべき状態

```typescript
// store/index.ts
interface PracticeStore {
  // Score
  score: Score | null;
  musicXmlPath: string | null;
  setScore: (score: Score, path: string) => void;

  // Practice
  practiceMode: PracticeMode;
  errorMode: ErrorMode;
  currentMeasure: number;
  currentNoteIndex: number;
  expectedNotes: Note[];
  pressedKeys: Set<number>;      // 現在押されているMIDIキー
  incorrectKeys: Set<number>;    // 誤って押されたキー
  loopEnabled: boolean;
  loopStart: number;
  loopEnd: number;
  stats: PracticeStats;
  setPracticeMode: (mode: PracticeMode) => void;
  setLoopRange: (start: number, end: number) => void;
  toggleLoop: () => void;

  // UI
  bpm: number;
  originalBpm: number;
  metronomeEnabled: boolean;
  zoom: number;
  pianoHeight: number;
  setBpm: (bpm: number) => void;
  setMetronomeEnabled: (enabled: boolean) => void;
}

export const usePracticeStore = create<PracticeStore>()(/* ... */);
```

## 受入基準

- [ ] `usePracticeStore` がアプリ全体でインポートできる
- [ ] `setPracticeMode('right')` 実行後、`practiceMode === 'right'` になる
- [ ] `setLoopRange(5, 10)` 実行後、`loopStart === 5`, `loopEnd === 10` になる
- [ ] テストが4件以上ありすべてパス

**依存関係**: Phase 3完了
