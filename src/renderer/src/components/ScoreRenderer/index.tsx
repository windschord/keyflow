import React, { useEffect, useRef, useState } from 'react';
import { Score, PracticeMode, Note, FingerAssignment } from '../../types';
import { OSMDController } from './osmd-controller';

export interface ScoreRendererProps {
  score: Score | null;
  musicXmlContent: string | null;
  currentNoteId: string | null;
  practiceMode: PracticeMode;
  loopRange: { start: number; end: number } | null;
  zoom: number;
  onNoteClick: (note: Note) => void;
  annotations?: FingerAssignment[];
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
    if (isLoaded && annotations && annotations.length > 0) {
      osmdControllerRef.current.showFingerings(
        annotations.map((a) => ({ noteId: a.noteId, finger: a.finger, isApproved: false }))
      );
    } else {
      osmdControllerRef.current.clearFingerings();
    }
  }, [annotations, isLoaded]);

  useEffect(() => {
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
  }, [practiceMode, score]);

  return (
    // スクロールコンテナはこの外側divのみに一本化する（overflow: 'auto'）。
    // 内側の osmd-container div は overflow・height: '100%' を持たず、
    // OSMDが描画した実際のコンテンツ高さのままこの外側divの中で
    // 縦方向にはみ出す（その結果、外側divのスクロールバーが機能する）。
    <div
      style={{ flexGrow: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto' }}
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
