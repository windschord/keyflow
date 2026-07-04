# TASK-019: スケール定型パターン実装（全24調）

**ステータス**: DONE
**推定工数**: 30分
**依存**: TASK-017

---

## 説明

スケール・アルペジオの標準運指パターンを定義し、
DPより優先して適用するパターンマッチングモジュールを実装する。

## 対象ファイル

- `src/renderer/src/workers/fingering/scale-patterns.ts` — パターン定義と検出
- `src/renderer/src/workers/fingering/scale-patterns.test.ts` — テスト

## 参照設計

- [design/components/fingering-engine.md「スケール定型パターン」セクション](../../design/components/fingering-engine.md)

## 実装すべきインターフェース

```typescript
export interface ScalePattern {
  key: string;          // 'C_MAJOR', 'G_MAJOR', 'A_MINOR', etc.
  startMidi: number;    // パターン開始音のMIDIナンバー（オクターブ非依存で0-11）
  right: Finger[];      // 右手運指（1オクターブ分、8音）
  left: Finger[];       // 左手運指（1オクターブ分、8音）
  isAscending: boolean;
}

// パターンが音符列にマッチするか検出
export function detectScalePattern(notes: Note[]): ScalePattern | null;

// マッチしたパターンの運指を返す（マッチしない場合はnull）
export function applyScalePattern(notes: Note[], hand: Hand): FingerAssignment[] | null;
```

## 実装すべき24調パターン（一部）

```typescript
export const SCALE_PATTERNS: ScalePattern[] = [
  {
    key: 'C_MAJOR',
    startMidi: 0, // C (mod 12)
    right: [1, 2, 3, 1, 2, 3, 4, 5],
    left:  [5, 4, 3, 2, 1, 3, 2, 1],
    isAscending: true,
  },
  {
    key: 'C_MAJOR_DESCENDING',
    startMidi: 0,
    right: [5, 4, 3, 2, 1, 3, 2, 1],
    left:  [1, 2, 3, 1, 2, 3, 4, 5],
    isAscending: false,
  },
  // G Major, D Major, A Major, E Major, B Major,
  // F# Major, Db Major, Ab Major, Eb Major, Bb Major, F Major
  // A minor, E minor, D minor, ... （全24調）
];
```

## テストケース

```typescript
it('Cメジャースケール上昇の音符列にパターンが検出される', () => {
  const cMajor = [C4, D4, E4, F4, G4, A4, B4, C5];
  expect(detectScalePattern(cMajor)?.key).toBe('C_MAJOR');
});
it('パターン検出後の右手運指が [1,2,3,1,2,3,4,5]', () => { ... });
it('オクターブが違っても同じパターンが検出される（C3→C4）', () => { ... });
it('非スケール音符列にはnullを返す', () => { ... });
```

## 受入基準

- [ ] 全24調（長調12 + 短調12）の上昇・下降パターンが定義されている
- [ ] `detectScalePattern` がCメジャースケールを正しく検出する
- [ ] オクターブが異なっても検出される
- [ ] テストケース4件が全パス

**依存関係**: TASK-017
