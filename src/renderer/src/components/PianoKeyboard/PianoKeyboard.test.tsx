import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { PianoKeyboard } from './index';
import { getNotePosition } from './key-layout';

describe('PianoKeyboard and KeyLayout', () => {
  beforeEach(() => {
    // Mock canvas context
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      canvas: { width: 1000, height: 150 },
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
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
