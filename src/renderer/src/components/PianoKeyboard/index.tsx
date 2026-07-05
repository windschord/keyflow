import React, { useEffect, useRef, MouseEvent } from 'react';
import { PracticeMode, Note, Annotation } from '../../types';
import { renderKeyboard } from './keyboard-renderer';
import { WHITE_KEY_WIDTH, getNotePosition, MIDI_MIN, MIDI_MAX } from './key-layout';

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

  const handleCanvasClick = (e: MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let clickedMidi = -1;
    // Check black keys first (they are drawn on top)
    for (let midi = MIDI_MIN; midi <= MIDI_MAX; midi++) {
      const pos = getNotePosition(midi);
      if (
        pos.isBlack &&
        x >= pos.x &&
        x <= pos.x + pos.width &&
        y >= pos.y &&
        y <= pos.y + pos.height
      ) {
        clickedMidi = midi;
        break;
      }
    }

    if (clickedMidi === -1) {
      // Check white keys
      for (let midi = MIDI_MIN; midi <= MIDI_MAX; midi++) {
        const pos = getNotePosition(midi);
        if (
          !pos.isBlack &&
          x >= pos.x &&
          x <= pos.x + pos.width &&
          y >= pos.y &&
          y <= pos.y + pos.height
        ) {
          clickedMidi = midi;
          break;
        }
      }
    }

    if (clickedMidi !== -1) {
      onKeyClick(clickedMidi);
    }
  };

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
        onClick={handleCanvasClick}
      />
    </div>
  );
};
