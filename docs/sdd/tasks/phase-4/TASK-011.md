# TASK-011: Score Renderer実装（OSMD統合・カーソル制御）

**ステータス**: DONE
**推定工数**: 60分
**依存**: TASK-010

---

## 説明

OpenSheetMusicDisplay（OSMD）をReactコンポーネントとしてラップし、
楽譜の描画・カーソル移動・パートハイライト・ループブラケット描画を実装する。

## 対象ファイル

- `src/renderer/src/components/ScoreRenderer/index.tsx` — Reactコンポーネント
- `src/renderer/src/components/ScoreRenderer/osmd-controller.ts` — OSMDラッパークラス
- `src/renderer/src/components/ScoreRenderer/ScoreRenderer.test.tsx` — テスト

## 依存ライブラリ

```bash
npm install opensheetmusicdisplay
```

## 参照設計

- [design/components/score-renderer.md](../../design/components/score-renderer.md)

## 実装すべきインターフェース

```typescript
// components/ScoreRenderer/index.tsx
interface ScoreRendererProps {
  score: Score | null;
  currentNoteId: string | null;
  practiceMode: PracticeMode;
  loopRange: { start: number; end: number } | null;
  zoom: number;
  onNoteClick: (note: Note) => void;
}

export const ScoreRenderer: React.FC<ScoreRendererProps>;
```

```typescript
// components/ScoreRenderer/osmd-controller.ts
export class OSMDController {
  private osmd: OpenSheetMusicDisplay;

  constructor(container: HTMLDivElement);
  async load(xmlContent: string): Promise<void>;
  moveCursor(noteId: string): void;
  setPartOpacity(partId: string, opacity: number): void;
  drawLoopBracket(startMeasure: number, endMeasure: number): void;
  setZoom(factor: number): void;
  highlightNote(noteId: string, color: 'correct' | 'incorrect' | 'expected'): void;
  buildNoteIdMap(): Map<string, object>;  // noteId → OSMDのNote参照
}
```

## 実装のポイント

- `useRef<HTMLDivElement>()` でコンテナDOMを参照し、`useEffect` でOSMDを初期化
- `currentNoteId` が変化したら `moveCursor()` を呼び出す
- `practiceMode` が変化したら非練習パートの `opacity` を 0.3 に下げる
- OSMDは `score.xml` 文字列を直接渡す（OSMD内部でMusicXMLをパース）

## 受入基準

- [ ] MusicXMLを渡すと楽譜がHTMLに描画される
- [ ] `currentNoteId` 変更でカーソルが対応音符に移動する
- [ ] `practiceMode='right'` で左手パートがグレーアウトする
- [ ] `loopRange` 設定でオレンジのブラケットが描画される
- [ ] `zoom` 変更で楽譜サイズが変わる

**依存関係**: TASK-010
