import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { PianoKeyboard } from './index';
import { getNotePosition } from './key-layout';
import { renderKeyboard } from './keyboard-renderer';
import type { Annotation, Note } from '../../types';

function createNote(midiNumber: number, id: string): Note {
  return {
    id,
    partId: 'P1',
    measureNumber: 1,
    noteIndex: 0,
    pitch: { step: 'C', octave: 4 },
    midiNumber,
    duration: 1,
    startTick: 0,
    durationTicks: 480,
    startSeconds: 0,
    durationSeconds: 0.5,
    voice: 1,
    isChord: false,
    isRest: false,
  };
}

function createMockCtx() {
  return {
    canvas: { width: 1248, height: 150 },
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
  } as unknown as CanvasRenderingContext2D & { fillText: ReturnType<typeof vi.fn> };
}

describe('PianoKeyboard and KeyLayout', () => {
  beforeEach(() => {
    // Mock canvas context
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      canvas: { width: 1000, height: 150 },
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    })) as any;
  });

  it('renders canvas correctly', () => {
    render(
      <PianoKeyboard
        expectedNotes={[]}
        pressedKeys={new Set()}
        incorrectKeys={new Set()}
        annotations={[]}
        practiceMode="both"
        onKeyClick={() => {}}
        height={150}
      />
    );
    expect(screen.getByTestId('piano-canvas')).toBeInTheDocument();
  });

  it('calculates C4 (MIDI 60) position correctly', () => {
    const pos = getNotePosition(60);
    expect(pos.isBlack).toBe(false);
    expect(pos.width).toBe(24);
  });

  it('calculates C#4 (MIDI 61) position correctly', () => {
    const pos = getNotePosition(61);
    expect(pos.isBlack).toBe(true);
    expect(pos.width).toBe(14);
  });

  it('throws error for out of range MIDI numbers', () => {
    expect(() => getNotePosition(10)).toThrow();
    expect(() => getNotePosition(120)).toThrow();
  });
});

describe('鍵盤上の指番号描画（REQ-005-007 / TASK-037）', () => {
  it('現在の判定グループのノーツに指番号アノテーションがある場合、対応する鍵の上に指番号を描画する', () => {
    const ctx = createMockCtx();
    const note = createNote(60, 'P1-M1-N0');
    const annotations: Annotation[] = [
      { noteId: 'P1-M1-N0', fingerNumber: 3, isAISuggested: true, isApproved: true },
    ];

    renderKeyboard({
      ctx,
      expectedNotes: [note],
      pressedKeys: new Set(),
      incorrectKeys: new Set(),
      annotations,
      practiceMode: 'both',
    });

    const pos = getNotePosition(60);
    expect(ctx.fillText).toHaveBeenCalledTimes(1);
    const [text, x, y] = ctx.fillText.mock.calls[0];
    expect(text).toBe('3');
    // 白鍵の中央付近（鍵の幅の範囲内）に描画される
    expect(x).toBeGreaterThanOrEqual(pos.x);
    expect(x).toBeLessThanOrEqual(pos.x + pos.width);
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThanOrEqual(pos.height);
  });

  it('黒鍵のノーツにも指番号を描画する', () => {
    const ctx = createMockCtx();
    const note = createNote(61, 'P1-M1-N1');
    const annotations: Annotation[] = [
      { noteId: 'P1-M1-N1', fingerNumber: 2, isAISuggested: false, isApproved: true },
    ];

    renderKeyboard({
      ctx,
      expectedNotes: [note],
      pressedKeys: new Set(),
      incorrectKeys: new Set(),
      annotations,
      practiceMode: 'both',
    });

    const pos = getNotePosition(61);
    expect(ctx.fillText).toHaveBeenCalledTimes(1);
    const [text, x, y] = ctx.fillText.mock.calls[0];
    expect(text).toBe('2');
    expect(x).toBeGreaterThanOrEqual(pos.x);
    expect(x).toBeLessThanOrEqual(pos.x + pos.width);
    expect(y).toBeLessThanOrEqual(pos.height);
  });

  it('アノテーションのないノーツには指番号を描画しない', () => {
    const ctx = createMockCtx();
    const note = createNote(60, 'P1-M1-N0');

    renderKeyboard({
      ctx,
      expectedNotes: [note],
      pressedKeys: new Set(),
      incorrectKeys: new Set(),
      annotations: [],
      practiceMode: 'both',
    });

    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it('fingerNumberを持たないアノテーション（コメントのみ）は描画しない', () => {
    const ctx = createMockCtx();
    const note = createNote(60, 'P1-M1-N0');
    const annotations: Annotation[] = [
      { noteId: 'P1-M1-N0', comment: 'ゆっくり', isAISuggested: false, isApproved: true },
    ];

    renderKeyboard({
      ctx,
      expectedNotes: [note],
      pressedKeys: new Set(),
      incorrectKeys: new Set(),
      annotations,
      practiceMode: 'both',
    });

    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it('現在の判定グループに含まれない鍵には描画しない（annotationsにあってもexpectedNotesにないnoteId）', () => {
    const ctx = createMockCtx();
    const note = createNote(60, 'P1-M1-N0');
    const annotations: Annotation[] = [
      { noteId: 'P1-M2-N0', fingerNumber: 5, isAISuggested: true, isApproved: true },
    ];

    renderKeyboard({
      ctx,
      expectedNotes: [note],
      pressedKeys: new Set(),
      incorrectKeys: new Set(),
      annotations,
      practiceMode: 'both',
    });

    expect(ctx.fillText).not.toHaveBeenCalled();
  });
});
