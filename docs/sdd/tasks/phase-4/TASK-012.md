# TASK-012: Piano Keyboard実装（Canvas 2D / 88鍵）

**ステータス**: TODO
**推定工数**: 50分
**依存**: TASK-010

---

## 説明

88鍵ピアノをCanvas 2D APIで描画するReactコンポーネントを実装する。
次に押すべき音符のガイド表示・MIDI入力のリアルタイム反映・運指番号表示を行う。

## 対象ファイル

- `src/renderer/src/components/PianoKeyboard/index.tsx` — Reactコンポーネント
- `src/renderer/src/components/PianoKeyboard/keyboard-renderer.ts` — Canvas描画ロジック
- `src/renderer/src/components/PianoKeyboard/key-layout.ts` — 鍵盤座標計算
- `src/renderer/src/components/PianoKeyboard/PianoKeyboard.test.ts` — テスト

## 参照設計

- [design/components/piano-keyboard.md](../../design/components/piano-keyboard.md)

## 鍵盤座標計算（key-layout.ts）

```typescript
export const WHITE_KEY_WIDTH = 24;   // px
export const WHITE_KEY_HEIGHT = 120; // px
export const BLACK_KEY_WIDTH = 14;
export const BLACK_KEY_HEIGHT = 75;
export const MIDI_MIN = 21;  // A0
export const MIDI_MAX = 108; // C8

// MIDIナンバーから鍵盤位置を計算
export function getNotePosition(midiNumber: number): {
  x: number;
  y: number;
  width: number;
  height: number;
  isBlack: boolean;
};
```

## 色定義（keyboard-renderer.ts）

```typescript
export const KEY_COLORS = {
  white: { normal: '#FFFFFF', guidRight: '#5B9BD5', guidLeft: '#70AD47', correct: '#FFD966', incorrect: '#FF6B6B' },
  black: { normal: '#1A1A1A', guidRight: '#3A6A9E', guidLeft: '#4A7A30', correct: '#CCA028', incorrect: '#CC3333' },
};
```

## Reactコンポーネントの設計

```typescript
interface PianoKeyboardProps {
  expectedNotes: Note[];
  pressedKeys: Set<number>;
  incorrectKeys: Set<number>;
  annotations: Annotation[];
  practiceMode: PracticeMode;
  onKeyClick: (midiNumber: number) => void;
  height: number;
}
```

- `useRef<HTMLCanvasElement>()` でCanvasを参照
- `useEffect` で描画（expectedNotes/pressedKeys/incorrectKeys が変わるたびに再描画）
- スクロール: `expectedNotes` のMIDIナンバーに合わせてCanvas横スクロール

## 受入基準

- [ ] 88鍵盤がCanvasに描画される（白鍵52本・黒鍵36本）
- [ ] MIDIナンバー60（C4）の鍵盤が正しい位置に描画される
- [ ] `expectedNotes` に含まれる鍵盤がガイド色でハイライトされる
- [ ] `pressedKeys` に含まれる鍵盤が正解色（黄色）になる
- [ ] `incorrectKeys` に含まれる鍵盤が不正解色（赤）になる
- [ ] 運指番号が対応する鍵盤上に表示される
- [ ] テストが4件以上ありすべてパス（getNotePosititionのユニットテスト含む）

**依存関係**: TASK-010
