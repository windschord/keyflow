# Piano Keyboard（画面鍵盤コンポーネント）

## 概要

**目的**: 88鍵盤の視覚的ガイドを表示し、MIDI入力状態と次に押すべき音符をリアルタイムに反映する

**責務**:
- 88鍵盤（A0=21〜C8=108）をSVGまたはCanvas2Dで描画する
- 次に押すべき音符をハイライト（右手=青、左手=緑）する
- MIDIキーボードの入力状態をリアルタイムに表示（正解=明るい色、不正解=赤）する
- 運指番号が設定された鍵盤に数字を表示する
- 鍵盤クリックでの音符入力をサポートする
- 演奏位置に応じて自動スクロールする

**実行場所**: Renderer Process（Reactコンポーネント）

---

## インターフェース

```typescript
interface PianoKeyboardProps {
  expectedNotes: Note[];           // 次に押すべき音符
  pressedKeys: Set<number>;        // 現在押されているMIDIナンバー
  incorrectKeys: Set<number>;      // 誤って押された音符
  annotations: Annotation[];       // 運指番号
  practiceMode: 'right' | 'left' | 'both';
  onKeyClick: (midiNumber: number) => void;
  height: number;                  // ピアノの縦幅（px）
}
```

## 内部設計

### 描画方式

パフォーマンスのため**Canvas 2D API**を採用する（SVGはDOM要素数が多くなるため）。

```typescript
// 88鍵の座標計算
const WHITE_KEY_WIDTH = 24; // px
const BLACK_KEY_WIDTH = 14;
const WHITE_KEYS = [0, 2, 4, 5, 7, 9, 11]; // Cオクターブ内の白鍵semitone位置

function getNotePosition(midiNumber: number): { x: number; isBlack: boolean }
```

### 色定義

| 状態 | 白鍵 | 黒鍵 |
|------|------|------|
| 通常 | #FFFFFF | #1A1A1A |
| 右手ガイド | #5B9BD5 | #3A6A9E |
| 左手ガイド | #70AD47 | #4A7A30 |
| 正解（押下） | #FFD966 | #CCA028 |
| 不正解（押下） | #FF6B6B | #CC3333 |

---

## 関連要件

- [US-005](../../requirements/stories/US-005.md) @../../requirements/stories/US-005.md: 画面鍵盤ガイド
