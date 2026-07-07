import { describe, it, expect } from 'vitest';
import { resolveEffectiveEndTick, resolveEffectiveDurations } from './pedal-extension';
import type { Note, PedalSpan } from '../../types';

/**
 * pedal-extension.ts の純関数テスト（TASK-070、US-014）。
 * 設計: docs/sdd/design/components/pedal-playback.md（再生反映の節）
 */

function makeNote(overrides: Partial<Note> & { startTick: number; durationTicks: number }): Note {
  return {
    id: overrides.id ?? 'P1-M1-N0',
    partId: overrides.partId ?? 'P1',
    measureNumber: overrides.measureNumber ?? 1,
    noteIndex: overrides.noteIndex ?? 0,
    pitch: overrides.pitch ?? { step: 'C', octave: 4 },
    midiNumber: overrides.midiNumber ?? 60,
    duration: overrides.duration ?? 1,
    startSeconds: overrides.startSeconds ?? 0,
    durationSeconds: overrides.durationSeconds ?? 0.5,
    voice: overrides.voice ?? 1,
    isChord: overrides.isChord ?? false,
    isRest: overrides.isRest ?? false,
    ...overrides,
  };
}

describe('resolveEffectiveEndTick (REQ-014-002)', () => {
  it('extends the release tick to the pedal span end when the notated release falls inside the span', () => {
    const note = { startTick: 0, durationTicks: 480 }; // release = 480
    const spans: PedalSpan[] = [{ startTick: 0, endTick: 960 }];

    expect(resolveEffectiveEndTick(note, spans)).toBe(960);
  });

  it('does not extend when the notated release falls outside any pedal span', () => {
    const note = { startTick: 0, durationTicks: 480 }; // release = 480
    const spans: PedalSpan[] = [{ startTick: 960, endTick: 1440 }];

    expect(resolveEffectiveEndTick(note, spans)).toBe(480);
  });

  it('does not extend when the notated release exactly equals the span end tick (boundary, non-inclusive)', () => {
    const note = { startTick: 0, durationTicks: 480 }; // release = 480
    const spans: PedalSpan[] = [{ startTick: 0, endTick: 480 }];

    expect(resolveEffectiveEndTick(note, spans)).toBe(480);
  });

  it('extends when the notated release exactly equals the span start tick (boundary, inclusive)', () => {
    const note = { startTick: 0, durationTicks: 480 }; // release = 480
    const spans: PedalSpan[] = [{ startTick: 480, endTick: 960 }];

    expect(resolveEffectiveEndTick(note, spans)).toBe(960);
  });

  it('returns the notated release tick unchanged (identity) when there are no pedal spans', () => {
    const note = { startTick: 0, durationTicks: 480 };

    expect(resolveEffectiveEndTick(note, [])).toBe(480);
  });
});

describe('resolveEffectiveDurations (REQ-014-002/US-014 同音再打鍵の抑制)', () => {
  it('returns the notated duration for every note unchanged when there are no pedal spans (non-regression, REQ-014-004)', () => {
    const noteA = makeNote({ id: 'a', startTick: 0, durationTicks: 480, midiNumber: 60 });
    const noteB = makeNote({ id: 'b', startTick: 480, durationTicks: 480, midiNumber: 62 });

    const result = resolveEffectiveDurations([noteA, noteB], []);

    expect(result.get(noteA)).toBe(480);
    expect(result.get(noteB)).toBe(480);
  });

  it('extends a note duration so its effective release lands on the pedal span end', () => {
    const note = makeNote({ id: 'a', startTick: 0, durationTicks: 480, midiNumber: 60 });
    const spans: PedalSpan[] = [{ startTick: 0, endTick: 960 }];

    const result = resolveEffectiveDurations([note], spans);

    expect(result.get(note)).toBe(960); // duration extended from 480 to 960 (endTick 960 - startTick 0)
  });

  it('truncates an extended duration at the startTick of the next same-pitch note (repeated-note suppression)', () => {
    // C4 at tick 0 (dur 480, notated release 480), pedal span [0, 960) would extend
    // release to 960, but the next C4 starts at tick 720, so it must be truncated to 720.
    const first = makeNote({ id: 'a', startTick: 0, durationTicks: 480, midiNumber: 60 });
    const second = makeNote({ id: 'b', startTick: 720, durationTicks: 480, midiNumber: 60 });
    const spans: PedalSpan[] = [{ startTick: 0, endTick: 960 }];

    const result = resolveEffectiveDurations([first, second], spans);

    expect(result.get(first)).toBe(720); // truncated: 720 - 0
    expect(result.get(second)).toBe(480); // unaffected (no span covers its release=1200)
  });

  it('does not truncate different-pitch notes even if they overlap in time after extension', () => {
    // Both notes' notated releases fall inside the same pedal span, so both extend
    // independently to the span end (960); truncation only applies within the same
    // midiNumber, so overlap between different pitches is left untouched.
    const c4 = makeNote({ id: 'a', startTick: 0, durationTicks: 480, midiNumber: 60 });
    const d4 = makeNote({ id: 'b', startTick: 240, durationTicks: 480, midiNumber: 62 });
    const spans: PedalSpan[] = [{ startTick: 0, endTick: 960 }];

    const result = resolveEffectiveDurations([c4, d4], spans);

    expect(result.get(c4)).toBe(960); // 0 -> extended release 960, duration 960-0
    expect(result.get(d4)).toBe(720); // 240 -> extended release 960, duration 960-240
  });

  it('handles an empty notes array without throwing', () => {
    expect(() => resolveEffectiveDurations([], [{ startTick: 0, endTick: 960 }])).not.toThrow();
    expect(resolveEffectiveDurations([], []).size).toBe(0);
  });
});
