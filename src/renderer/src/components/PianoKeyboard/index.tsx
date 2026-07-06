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
  /**
   * 再生中に実際に発音中のノーツ（MIDI番号、TASK-057）。音価（durationTicks）
   * が満了するまで点灯し続ける表示に使う。判定グループのガイド表示
   * （expectedNotes）とは独立した表示系であり、未指定時は既存動作のまま
   * （発音中表示なし、後方互換）。
   */
  soundingNotes?: Set<number>;
}

/**
 * 鍵盤コンテナのレイアウトスタイル（TASK-058）。
 * - justifyContent 'safe center': canvas幅がコンテナ幅より狭い場合は中央寄せ、
 *   広い場合（88鍵で横スクロールが必要な場合）は先頭（A0側）が切れないよう
 *   左詰めへフォールバックする。Electron v29のChromiumはsafe centerを
 *   サポートしている。
 * - backgroundColor '#e0e0e0': 余白色をヘッダーバー（App.tsxのヘッダー背景）
 *   と同値にする。値を変える場合は両方を揃えること。
 *
 * jsdom（cssstyle）は'safe center'を解析できない環境があるため、テストは
 * DOMのstyle文字列ではなくこの定数を検証する（CodeRabbit PR#26指摘）。
 */
export const KEYBOARD_CONTAINER_STYLE: React.CSSProperties = {
  overflowX: 'auto',
  width: '100%',
  display: 'flex',
  justifyContent: 'safe center',
  backgroundColor: '#e0e0e0',
};

export const PianoKeyboard: React.FC<PianoKeyboardProps> = ({
  expectedNotes,
  pressedKeys,
  incorrectKeys,
  annotations,
  practiceMode,
  onKeyClick,
  height,
  keyboardSize = 88,
  soundingNotes = new Set(),
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
          soundingNotes,
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
    soundingNotes,
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
      style={{ ...KEYBOARD_CONTAINER_STYLE, height: `${height}px` }}
      data-testid="keyboard-container"
    >
      <canvas
        ref={canvasRef}
        width={totalWidth}
        height={height}
        data-testid="piano-canvas"
        style={{ display: 'block', flexShrink: 0 }}
        onClick={handleCanvasClick}
      />
    </div>
  );
};
