import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { FingeringPanel } from './index';
import type { Note, Score } from '../../types';

/**
 * FingeringPanel → lib/fingering-engine の結線smokeテスト
 * （CodeRabbit PR#25指摘#4、CLAUDE.md「モック境界には結線テストを対で書く」）。
 *
 * FingeringPanel.test.tsx は '../../lib/fingering-engine' モジュール全体を
 * `vi.mock` しているため、FingeringPanel が実際に FingeringEngineService を
 * 正しく呼び出しているかどうかは検証されていなかった。
 *
 * 本ファイルではモック境界を「Web Worker」自体（jsdomに存在しない、真に外部の
 * 依存）まで狭め、FingeringEngineService の実装はそのまま使用する
 * （fingering-engine.test.ts と同じ Worker スタブ方式）。これにより
 * FingeringPanel が実サービス経由でWorkerへリクエストを送り、Workerからの
 * レスポンスを onSuggested に反映する一連の結線を検証する。
 *
 * 同一テストファイル内で '../../lib/fingering-engine' の一部のテストだけ
 * モックを外そうとすると、`vi.resetModules()` によりReactモジュールが
 * 二重ロードされ Invalid hook call を招く。そのため、モックを一切使わない
 * 本テストは独立したファイルに分離している。
 */

const mockWorker = {
  postMessage: vi.fn(),
  terminate: vi.fn(),
  onmessage: null as ((e: MessageEvent) => void) | null,
};

vi.stubGlobal(
  'Worker',
  vi.fn().mockImplementation(function () {
    return new Proxy(mockWorker, {
      set(target, prop, value) {
        (target as Record<string, unknown>)[prop] = value;
        return true;
      },
    });
  })
);

function makeNote(overrides: Partial<Note> & Pick<Note, 'id' | 'partId' | 'midiNumber'>): Note {
  return {
    measureNumber: 1,
    noteIndex: 0,
    pitch: { step: 'C', octave: 4 },
    duration: 1,
    startTick: 0,
    durationTicks: 480,
    startSeconds: 0,
    durationSeconds: 0.5,
    voice: 1,
    isChord: false,
    isRest: false,
    staff: 1,
    hand: 'right',
    ...overrides,
  };
}

describe('FingeringPanel wiring smoke test (real FingeringEngineService)', () => {
  beforeEach(() => {
    mockWorker.postMessage.mockClear();
    mockWorker.terminate.mockClear();
    mockWorker.onmessage = null;
  });

  it('sends a COMPUTE request through the real FingeringEngineService and reports the RESULT via onSuggested', async () => {
    const note = makeNote({ id: 'P1-M1-N0', partId: 'P1', midiNumber: 60, hand: 'right' });
    const score: Score = {
      title: 'Test',
      parts: [{ id: 'P1', name: 'Piano', hand: 'right', clef: 'treble' }],
      measures: [{ number: 1, startTick: 0, notes: [note] }],
      tempo: 120,
      ticksPerQuarter: 480,
      tempoMap: [{ tick: 0, bpm: 120 }],
      timeSignature: { beats: 4, beatType: 4 },
      keySignature: 0,
      pedalSpans: [],
    };

    const onSuggested = vi.fn();
    render(<FingeringPanel score={score} onSuggested={onSuggested} />);

    fireEvent.click(screen.getByText('運指提案'));

    await waitFor(() => expect(mockWorker.postMessage).toHaveBeenCalled());
    const request = mockWorker.postMessage.mock.calls[0][0] as {
      type: string;
      requestId: string;
      notes: Note[];
      hand: string;
    };
    // FingeringPanelがモックではなく実際のFingeringEngineServiceを経由して
    // Workerへリクエストを送っていること（結線）を検証する。
    expect(request.type).toBe('COMPUTE');
    expect(request.hand).toBe('right');
    expect(request.notes).toEqual([note]);

    mockWorker.onmessage?.({
      data: {
        type: 'RESULT',
        requestId: request.requestId,
        result: { assignments: [], totalCost: 0 },
      },
    } as MessageEvent);

    await waitFor(() => expect(onSuggested).toHaveBeenCalledWith([]));
  });
});
