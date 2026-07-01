# TASK-014: Practice Engine実装（正誤判定・ループ管理）

**ステータス**: DONE
**推定工数**: 60分
**依存**: Phase 4

---

## 説明

MIDI入力と楽譜を照合して正誤を判定し、練習位置を管理するサービスを実装する。
Zustand Storeと統合してUIに状態を反映する。

## 対象ファイル

- `src/renderer/src/lib/practice-engine/index.ts` — PracticeEngineService
- `src/renderer/src/lib/practice-engine/judgement.ts` — 正誤判定ロジック
- `src/renderer/src/lib/practice-engine/loop-manager.ts` — ループ制御
- `src/renderer/src/lib/practice-engine/practice-engine.test.ts` — テスト

## 参照設計

- [design/components/practice-engine.md](../../design/components/practice-engine.md)

## 実装すべきインターフェース

```typescript
export class PracticeEngineService {
  constructor(store: PracticeStore);

  handleNoteOn(event: MidiNoteEvent): NoteJudgement;
  handleNoteOff(event: MidiNoteEvent): void;
  advancePosition(): void;
  resetToMeasure(measureNumber: number): void;
  setLoop(start: number, end: number): void;
  clearLoop(): void;

  // 内部メソッド
  private getExpectedNotes(): Note[];
  private checkCorrectness(noteNumber: number, expectedNotes: Note[], practiceMode: PracticeMode): boolean;
}
```

## 正誤判定ロジック（judgement.ts）

```typescript
// practiceMode に応じて対象パートをフィルタリング
function filterNotesByMode(notes: Note[], practiceMode: PracticeMode, parts: Part[]): Note[];

// コード判定: 和音は全音符が揃ったら正解
// isChord: true の音符は「コードグループ」としてまとめて判定
function judgeChord(pressedKeys: Set<number>, expectedNotes: Note[]): 'correct' | 'incorrect' | 'partial';
```

## ループ管理（loop-manager.ts）

```typescript
// 現在小節がloopEnd+1になった時にloopStartに戻す
function checkLoopBoundary(currentMeasure: number, loopStart: number, loopEnd: number, enabled: boolean): number;
```

## テストケース

```typescript
it('正しい音符を押すと次の音符に進む', () => { ... });
it('誤った音符を押すとwaitモードで位置が進まない', () => { ... });
it('コードは全音符が揃ったら正解になる', () => { ... });
it('右手モードで左手パートの音符は判定をスキップする', () => { ... });
it('ループ終端で先頭に戻る', () => { ... });
it('passモードでは誤りでも次に進む', () => { ... });
```

## 受入基準

- [ ] 上記テストケース6件が全パス
- [ ] `handleNoteOn` がNoteJudgementを返す
- [ ] ループ終端で `currentMeasure` がloopStartに戻る
- [ ] `stats.correctNotes` / `stats.incorrectAttempts` が正しくカウントされる

**依存関係**: Phase 4完了
