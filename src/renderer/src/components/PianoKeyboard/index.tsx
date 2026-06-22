import React, { useEffect, useRef } from 'react';
import { PracticeMode, Note, Annotation } from '../../types';
import { renderKeyboard } from './keyboard-renderer';
import { WHITE_KEY_WIDTH } from './key-layout';

export interface PianoKeyboardProps {
  expectedNotes: Note[];
  pressedKeys: Set<number>;
  incorrectKeys: Set<number>;
  annotations: Annotation[];
  practiceMode: PracticeMode;
  onKeyClick: (midiNumber: number) => void;
  height: number;
}

export const PianoKeyboard: React.FC<PianoKeyboardProps> = ({
  expectedNotes,
  pressedKeys,
  incorrectKeys,
  annotations,
  practiceMode,
  onKeyClick,
  height,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const totalWidth = 52 * WHITE_KEY_WIDTH; // 52 white keys for 88 key piano

  useEffect(() => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        renderKeyboard({
          ctx,
          expectedNotes,
          pressedKeys,
          incorrectKeys,
          annotations,
          practiceMode,
        });
      }
    }
  }, [expectedNotes, pressedKeys, incorrectKeys, annotations, practiceMode, height]);

  return (
    <div
      style={{ overflowX: 'auto', width: '100%', height: `${height}px` }}
      data-testid="keyboard-container"
    >
      <canvas
        ref={canvasRef}
        width={totalWidth}
        height={height}
        data-testid="piano-canvas"
        style={{ display: 'block' }}
      />
    </div>
  );
};
