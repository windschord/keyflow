# Score Renderer（楽譜レンダラー）

## 概要

**目的**: OpenSheetMusicDisplay（OSMD）を使って五線譜を画面に描画し、練習状態と同期する

**責務**:
- MusicXMLをOSMDに渡して楽譜を描画する
- 現在の演奏位置カーソル（青い縦線）を移動させる
- 練習モードに応じたパートのハイライト/グレーアウトを制御する
- ループ範囲のオレンジブラケットを描画する
- 表示倍率の変更を反映する
- 音符クリックで再生位置を移動する

**実行場所**: Renderer Process（Reactコンポーネント + OSMD）

---

## インターフェース

```typescript
// React Componentとして提供
interface ScoreRendererProps {
  score: Score | null;
  currentNoteId: string | null;
  practiceMode: 'right' | 'left' | 'both';
  loopRange: { start: number; end: number } | null;
  zoom: number;                    // 0.5〜2.0
  onNoteClick: (note: Note) => void;
  // noteIdごとの正誤ハイライト状態（TASK-033）。usePractice の判定結果から生成し、
  // OSMDController.highlightNote に反映する。
  noteHighlights?: Record<string, 'correct' | 'incorrect'>;
}

// OSMD ラッパークラス
class OSMDController {
  load(xmlContent: string): Promise<void>;
  moveCursor(noteId: string): void;
  setPartOpacity(partId: string, opacity: number): void;
  drawLoopBracket(startMeasure: number, endMeasure: number): void;
  setZoom(factor: number): void;
  highlightNote(noteId: string, color: 'correct' | 'incorrect' | 'expected'): void;
  // 小節クリック（REQ-002-004）。クリック位置に最も近いnoteIdを解決し、
  // その小節番号をコールバックに通知する（TASK-033）。
  setOnMeasureClick(callback: ((measureNumber: number) => void) | null): void;
}
```

---

## 内部設計

### OSMD と内部Scoreモデルの紐付け

OSMDは独自の内部表現を持つため、音符IDのマッピングテーブルを構築する：

```typescript
// OSMDロード後に構築
const noteIdMap = new Map<string, OSMDNote>(); // Note.id → OSMDのNote参照
```

---

## 実装メモ（TASK-033）

OSMDが生成するSVGにはインストゥルメント単位・音符単位で安定して参照できるid/class属性が
存在しないため、`setPartOpacity`・`highlightNote`・`drawLoopBracket`はいずれも
`noteIdToSvgCoord`（カーソル座標サンプリングで構築した近似座標マップ）を用いた
SVGオーバーレイ（半透明の矩形・円）として実装している。`setZoom`によるOSMDの再描画
（`render()`はSVG子要素を再構築する）後は、保持しているオーバーレイ状態
（`lastLoopRange`/`partOpacities`/`noteHighlights`/運指割当）を`reapplyOverlays()`で
再適用する。

## テスト観点

- [ ] 正常系: MusicXMLロード後に楽譜が正しく描画される
- [ ] 正常系: カーソルが現在音符に追従する
- [ ] 正常系: 右手モードで左手パートがグレーアウトされる
- [ ] 正常系: ループブラケットが指定小節範囲に描画される
- [x] 正常系: 正誤判定結果に応じて音符が緑/赤にハイライトされる（TASK-033）
- [x] 正常系: 小節クリックで最も近いnoteIdの小節番号がコールバックへ通知される（TASK-033）

---

## 関連要件

- [US-002](../../requirements/stories/US-002.md) @../../requirements/stories/US-002.md: 楽譜表示
- [US-003](../../requirements/stories/US-003.md) @../../requirements/stories/US-003.md: 右手/左手モード表示
- [US-007](../../requirements/stories/US-007.md) @../../requirements/stories/US-007.md: ループ範囲表示
