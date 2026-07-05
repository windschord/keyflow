import React, { useEffect, useRef, useState } from 'react';
import { Score, PracticeMode, Note, Annotation } from '../../types';
import { OSMDController } from './osmd-controller';

export interface ScoreRendererProps {
  score: Score | null;
  musicXmlContent: string | null;
  currentNoteId: string | null;
  practiceMode: PracticeMode;
  loopRange: { start: number; end: number } | null;
  zoom: number;
  onNoteClick: (note: Note) => void;
  /**
   * annotation-storeの実データ（手動入力・AI提案の両方を含む）。
   * fingerNumberが設定されている項目のみ楽譜上に指番号として描画し、
   * isApprovedの値に応じて色分けする（承認済み: 濃い青、未承認: 淡い青。
   * osmd-controller.ts の renderFingeringLayer 参照）。
   */
  annotations?: Annotation[];
  /**
   * noteIdごとの正誤ハイライト状態（REQ-004-003/004）。
   * practice-engineの判定結果（usePractice経由）をApp.tsxから受け取り、OSMDController.highlightNoteに反映する。
   */
  noteHighlights?: Record<string, 'correct' | 'incorrect'>;
  /**
   * 音符の右クリック（contextmenu）を検知した際に呼び出されるコールバック
   * （REQ-008-001/003/006、REQ-009-005）。座標解決済みのnoteIdと、メニュー表示位置
   * となる画面座標（clientX/clientY）を受け取る。App.tsx側で運指メモの
   * コンテキストメニュー表示に結線する。
   */
  onNoteContextMenu?: (noteId: string, screenX: number, screenY: number) => void;
}

export const ScoreRenderer: React.FC<ScoreRendererProps> = ({
  score,
  musicXmlContent,
  currentNoteId,
  practiceMode,
  loopRange,
  zoom,
  onNoteClick,
  annotations,
  noteHighlights,
  onNoteContextMenu,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const osmdControllerRef = useRef<OSMDController | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (containerRef.current && !osmdControllerRef.current) {
      osmdControllerRef.current = new OSMDController(containerRef.current);
    }
  }, []);

  useEffect(() => {
    if (score && musicXmlContent && osmdControllerRef.current) {
      setIsLoaded(false);
      osmdControllerRef.current
        .load(musicXmlContent)
        .then(() => {
          setIsLoaded(true);
          osmdControllerRef.current?.buildNoteIdMap();
        })
        .catch((err) => console.error('[ScoreRenderer] OSMD load failed:', err));
    } else if (!score) {
      setIsLoaded(false);
    }
  }, [score, musicXmlContent]);

  useEffect(() => {
    if (isLoaded && osmdControllerRef.current && currentNoteId) {
      osmdControllerRef.current.moveCursor(currentNoteId);
    }
  }, [currentNoteId, isLoaded]);

  useEffect(() => {
    if (osmdControllerRef.current) {
      osmdControllerRef.current.setZoom(zoom);
    }
  }, [zoom]);

  useEffect(() => {
    if (!osmdControllerRef.current) return;
    const withFinger = (annotations ?? []).filter(
      (a): a is Annotation & { fingerNumber: NonNullable<Annotation['fingerNumber']> } =>
        a.fingerNumber !== undefined
    );
    if (isLoaded && withFinger.length > 0) {
      osmdControllerRef.current.showFingerings(
        withFinger.map((a) => ({
          noteId: a.noteId,
          finger: a.fingerNumber,
          isApproved: a.isApproved,
        }))
      );
    } else {
      osmdControllerRef.current.clearFingerings();
    }
  }, [annotations, isLoaded]);

  useEffect(() => {
    if (!osmdControllerRef.current || !isLoaded) return;
    if (loopRange) {
      osmdControllerRef.current.drawLoopBracket(loopRange.start, loopRange.end);
    } else {
      osmdControllerRef.current.clearLoopBracket();
    }
  }, [loopRange, isLoaded]);

  useEffect(() => {
    // isLoaded を依存に含めることで、新しい楽譜のロード直後（noteIdToSvgCoord構築完了後）に
    // もグレーアウトが再適用される（REQ-002-007: buildNoteIdMap完了前は座標が
    // 空のためオーバーレイが描画されないことがあるための再適用）。
    if (osmdControllerRef.current && score) {
      score.parts.forEach((part) => {
        if (practiceMode === 'right' && part.hand === 'left') {
          osmdControllerRef.current!.setPartOpacity(part.id, 0.5);
        } else if (practiceMode === 'left' && part.hand === 'right') {
          osmdControllerRef.current!.setPartOpacity(part.id, 0.5);
        } else {
          osmdControllerRef.current!.setPartOpacity(part.id, 1.0);
        }
      });
    }
  }, [practiceMode, score, isLoaded]);

  // 小節クリックによるカーソル移動（REQ-002-004）。
  // OSMDController側でクリック位置に最も近いnoteIdを解決し、対応する小節番号から
  // scoreの代表音符（該当小節の先頭ノート）を引き当てて onNoteClick に渡す。
  useEffect(() => {
    if (!osmdControllerRef.current) return;
    osmdControllerRef.current.setOnMeasureClick((measureNumber) => {
      if (!score) return;
      const measure = score.measures.find((m) => m.number === measureNumber);
      const note = measure?.notes[0];
      if (note) onNoteClick(note);
    });
    return () => {
      osmdControllerRef.current?.setOnMeasureClick(null);
    };
  }, [score, onNoteClick]);

  // 音符の右クリック（contextmenu）によるコンテキストメニュー表示
  // （REQ-008-001/003/006、REQ-009-005）。OSMDController側でクリック位置に最も
  // 近いnoteIdを解決し、画面座標とともに onNoteContextMenu prop 経由で
  // App.tsxへ通知する。
  useEffect(() => {
    if (!osmdControllerRef.current) return;
    osmdControllerRef.current.setOnNoteContextMenu(onNoteContextMenu ?? null);
    return () => {
      osmdControllerRef.current?.setOnNoteContextMenu(null);
    };
  }, [onNoteContextMenu]);

  // 正誤判定結果に応じた楽譜上のハイライト（REQ-004-003/004）。
  // usePractice/App.tsx から渡される noteHighlights の差分のみ OSMDController に反映し、
  // マップから消えたnoteIdは 'expected'（ハイライト解除）に戻す。
  const prevHighlightsRef = useRef<Record<string, 'correct' | 'incorrect'>>({});
  useEffect(() => {
    if (!osmdControllerRef.current || !isLoaded) return;
    const controller = osmdControllerRef.current;
    const next = noteHighlights ?? {};
    const prev = prevHighlightsRef.current;

    for (const noteId of Object.keys(prev)) {
      if (!(noteId in next)) {
        controller.highlightNote(noteId, 'expected');
      }
    }
    for (const [noteId, color] of Object.entries(next)) {
      if (prev[noteId] !== color) {
        controller.highlightNote(noteId, color);
      }
    }
    prevHighlightsRef.current = next;
  }, [noteHighlights, isLoaded]);

  return (
    // スクロールコンテナはこの外側divのみに一本化する（overflow: 'auto'）。
    // 内側の osmd-container div は overflow・height: '100%' を持たず、
    // OSMDが描画した実際のコンテンツ高さのままこの外側divの中で
    // 縦方向にはみ出す（その結果、外側divのスクロールバーが機能する）。
    <div
      data-testid="score-scroll-container"
      style={{
        flexGrow: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
      }}
    >
      {!score && (
        <div style={{ margin: 'auto', color: '#666' }} data-testid="placeholder">
          楽譜ファイルを開いてください
        </div>
      )}
      <div
        ref={containerRef}
        style={{
          display: score ? 'block' : 'none',
          width: '100%',
          backgroundColor: '#ffffff',
        }}
        data-testid="osmd-container"
      />
    </div>
  );
};
