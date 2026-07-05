import React, { useEffect, useRef, useState } from 'react';
import { Score, PracticeMode, Note, Annotation, Hand } from '../../types';
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
    if (!containerRef.current) return undefined;

    const controller = new OSMDController(containerRef.current);
    osmdControllerRef.current = controller;

    // TASK-049: アンマウント時にOSMDController.dispose()を呼び、ResizeObserverの
    // disconnectとclick/contextmenuリスナーの解除を行う（リソース解放漏れの防止）。
    // このeffectで生成したcontrollerをクロージャで捕捉してdisposeすることで、
    // StrictModeのマウント→クリーンアップ→再マウントの間もosmdControllerRef.current
    // をnullに戻さない（他のeffectのクリーンアップがcontrollerを参照できるよう保つ）。
    // 再マウント時は本effectが無条件に新しいcontrollerを生成し直す。
    return () => {
      controller.dispose();
    };
  }, []);

  useEffect(() => {
    // M4対策: ファイル連続オープン等でこのeffectが再実行されると、古いload()の
    // 完了(.then)が新しいload()より後に解決し、noteIdマップ・isLoadedを
    // 「後勝ち」で上書きしてしまう恐れがある。cancelledフラグでこのeffect実行
    // （＝この世代のload）が既に無効化されたかどうかを判定し、無効化済みなら
    // .thenの副作用（setIsLoaded/buildNoteIdMap）を実行しない。
    let cancelled = false;

    if (score && musicXmlContent && osmdControllerRef.current) {
      setIsLoaded(false);
      osmdControllerRef.current
        .load(musicXmlContent)
        .then(() => {
          if (cancelled) return;
          setIsLoaded(true);
          // TASK-049: 独立採番をやめ、パース済みscoreとの照合でnoteIdマップを構築する。
          osmdControllerRef.current?.buildNoteIdMap(score);
        })
        .catch((err) => {
          if (cancelled) return;
          console.error('[ScoreRenderer] OSMD load failed:', err);
        });
    } else if (!score) {
      setIsLoaded(false);
    }

    return () => {
      cancelled = true;
    };
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
    // TASK-048: パート単位（Part.hand）ではなくnote単位（Note.hand）でグレーアウト対象を
    // 収集する。1パート2段譜ではパートと手（段）が一致しないため、この方式が必要。
    if (osmdControllerRef.current && score) {
      const grayedOutHand: Hand | null =
        practiceMode === 'right' ? 'left' : practiceMode === 'left' ? 'right' : null;

      const grayedOutNoteIds = grayedOutHand
        ? new Set(
            score.measures
              .flatMap((m) => m.notes)
              .filter((n) => n.hand === grayedOutHand)
              .map((n) => n.id)
          )
        : new Set<string>();

      osmdControllerRef.current.setGrayedOutNotes(grayedOutNoteIds);
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
