import React, { useEffect, useRef, useState } from 'react';
import { Score, PracticeMode, Note } from '../../types';
import { OSMDController } from './osmd-controller';

export interface ScoreRendererProps {
  score: Score | null;
  currentNoteId: string | null;
  practiceMode: PracticeMode;
  loopRange: { start: number; end: number } | null;
  zoom: number;
  onNoteClick: (note: Note) => void;
}

export const ScoreRenderer: React.FC<ScoreRendererProps> = ({
  score,
  currentNoteId,
  practiceMode,
  loopRange,
  zoom,
  onNoteClick,
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
    if (score && osmdControllerRef.current) {
      // In a real scenario, score or a separate musicXML path/string would be passed.
      // Here we mock the loading since we just have the score model.
      // osmdControllerRef.current.load(scoreXml);
      setIsLoaded(true);
    } else {
      setIsLoaded(false);
    }
  }, [score]);

  useEffect(() => {
    if (osmdControllerRef.current && currentNoteId) {
      osmdControllerRef.current.moveCursor(currentNoteId);
    }
  }, [currentNoteId]);

  useEffect(() => {
    if (osmdControllerRef.current) {
      osmdControllerRef.current.setZoom(zoom);
    }
  }, [zoom]);

  useEffect(() => {
    if (osmdControllerRef.current) {
      if (practiceMode === 'right') {
        osmdControllerRef.current.setPartOpacity('left-part-id', 0.5);
      } else if (practiceMode === 'left') {
        osmdControllerRef.current.setPartOpacity('right-part-id', 0.5);
      } else {
        osmdControllerRef.current.setPartOpacity('right-part-id', 1.0);
        osmdControllerRef.current.setPartOpacity('left-part-id', 1.0);
      }
    }
  }, [practiceMode]);

  return (
    <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
      {!score && (
        <div style={{ margin: 'auto', color: '#666' }} data-testid="placeholder">
          楽譜ファイルを開いてください
        </div>
      )}
      <div
        ref={containerRef}
        style={{ display: score ? 'block' : 'none', width: '100%', height: '100%' }}
        data-testid="osmd-container"
      />
    </div>
  );
};
