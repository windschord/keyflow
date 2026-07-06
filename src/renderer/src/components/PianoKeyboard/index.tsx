import React, { useEffect, useRef, MouseEvent } from 'react';
import { PracticeMode, Note, Annotation, KeyboardSize } from '../../types';
import { renderKeyboard } from './keyboard-renderer';
import { WHITE_KEY_WIDTH, getNotePosition, countWhiteKeys, KEYBOARD_PRESETS } from './key-layout';

export interface PianoKeyboardProps {
  expectedNotes: Note[];
  pressedKeys: Set<number>;
  incorrectKeys: Set<number>;
  annotations: Annotation[];
  practiceMode: PracticeMode;
  onKeyClick: (midiNumber: number) => void;
  height: number;
  /**
   * 鍵盤数プリセット（TASK-056）。未指定時は88鍵（既存動作の後方互換）。
   * canvas幅・クリック座標→MIDI変換・範囲外ノーツのインジケータの表示範囲を決める。
   * practice-engineの判定ロジック（expectedNotes・正誤判定）には影響しない
   * （あくまで表示だけの制約）。
   */
  keyboardSize?: KeyboardSize;
}

export const PianoKeyboard: React.FC<PianoKeyboardProps> = ({
  expectedNotes,
  pressedKeys,
  incorrectKeys,
  annotations,
  practiceMode,
  onKeyClick,
  height,
  keyboardSize = 88,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { midiMin, midiMax } = KEYBOARD_PRESETS[keyboardSize];
  const totalWidth = countWhiteKeys(midiMin, midiMax) * WHITE_KEY_WIDTH;

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
          midiMin,
          midiMax,
        });
      }
    }
  }, [
    expectedNotes,
    pressedKeys,
    incorrectKeys,
    annotations,
    practiceMode,
    height,
    midiMin,
    midiMax,
  ]);

  const handleCanvasClick = (e: MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let clickedMidi = -1;
    // Check black keys first (they are drawn on top)
    for (let midi = midiMin; midi <= midiMax; midi++) {
      const pos = getNotePosition(midi, midiMin, midiMax);
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
      for (let midi = midiMin; midi <= midiMax; midi++) {
        const pos = getNotePosition(midi, midiMin, midiMax);
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
