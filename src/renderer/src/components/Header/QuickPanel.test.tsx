import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { QuickPanel } from './QuickPanel';
import { usePracticeStore } from '../../store';
import type { Note, Score } from '../../types';

// TASK-074: 低頻度操作パネル（QuickPanel、design/components/header.md）。
// 音量・表示倍率・運指・成績・メトロノーム詳細の各セクションを内包し、
// 既存コンポーネント（VolumeControl/ZoomControl/FingeringToggle/FingeringPanel/
// StatsDisplay）はロジック不変で再利用する（REQ-012-004）。
//
// TASK-079: 2026-07-08のユーザー実機フィードバック（DEC-007改訂）により、
// セクションを「表示（音量・表示倍率）/ 運指 / 成績 / メトロノーム詳細（1拍目強調）」
// へ再編成した。メトロノームON/OFF本体はヘッダー常駐（MetronomeToggle）へ移動した
// ため、本パネルからは削除する。

// CodeRabbit PR#28指摘#4: computeFingeringの戻り値をここで固定する。
// QuickPanel → FingeringPanel → onFingeringSuggestedの結線を実経路で検証し、
// 運指Workerを内包するFingeringEngineServiceのみモック境界とする。
const mockComputeFingering = vi.fn();

vi.mock('../../lib/fingering-engine', () => ({
  FingeringEngineService: vi.fn().mockImplementation(() => ({
    computeFingering: mockComputeFingering,
    dispose: vi.fn(),
  })),
  DEFAULT_HAND_SETTINGS: { maxSpanSemitones: 14, scaleFactorLeft: 1.0 },
}));

function makeNote(overrides: Partial<Note> & Pick<Note, 'id' | 'midiNumber'>): Note {
  return {
    partId: 'P1',
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

function makeScore(): Score {
  const note = makeNote({ id: 'P1-M1-N0', midiNumber: 60 });
  return {
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
}

describe('QuickPanel', () => {
  beforeEach(() => {
    mockComputeFingering.mockReset();
    usePracticeStore.setState({
      volume: 80,
      zoom: 1,
      showFingerings: true,
      metronomeEnabled: false,
      metronomeAccentEnabled: true,
      stats: {
        totalNotes: 10,
        correctNotes: 8,
        incorrectNotes: 2,
        accuracy: 0.8,
        consecutiveCorrect: 3,
      },
    });
  });

  it('renders a "表示" section containing VolumeControl and ZoomControl (TASK-079)', () => {
    render(<QuickPanel score={null} onFingeringSuggested={() => {}} />);
    expect(screen.getByText('表示')).toBeInTheDocument();
    expect(screen.getByTestId('volume-slider')).toBeInTheDocument();
    expect(screen.getByTestId('zoom-select')).toBeInTheDocument();
  });

  it('renders the fingering section (FingeringToggle + FingeringPanel)', () => {
    render(<QuickPanel score={null} onFingeringSuggested={() => {}} />);
    // 「運指」というテキストはセクション見出しとFingeringToggle本体のラベルの
    // 両方に存在するため、件数のみを検証する（表記の重複自体は既存仕様、REQ-012-004）。
    expect(screen.getAllByText('運指').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('fingering-toggle')).toBeInTheDocument();
    expect(screen.getByText('運指対象:')).toBeInTheDocument();
  });

  it('renders the stats section (StatsDisplay)', () => {
    render(<QuickPanel score={null} onFingeringSuggested={() => {}} />);
    expect(screen.getByText('成績')).toBeInTheDocument();
    expect(screen.getByTestId('stats-display')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
  });

  it('renders a "メトロノーム詳細" section with only the accent checkbox, without an ON/OFF checkbox (TASK-079)', () => {
    render(<QuickPanel score={null} onFingeringSuggested={() => {}} />);
    expect(screen.getByText('メトロノーム詳細')).toBeInTheDocument();
    expect(screen.getByTestId('metronome-accent-checkbox')).toBeInTheDocument();
    expect(screen.queryByTestId('metronome-checkbox')).not.toBeInTheDocument();
  });

  it('toggles the store metronomeAccentEnabled state when the accent checkbox is operated', () => {
    render(<QuickPanel score={null} onFingeringSuggested={() => {}} />);
    const checkbox = screen.getByTestId('metronome-accent-checkbox') as HTMLInputElement;

    checkbox.click();

    expect(usePracticeStore.getState().metronomeAccentEnabled).toBe(false);
  });

  it('forwards suggested fingerings from FingeringPanel to onFingeringSuggested', async () => {
    const assignments = [{ noteId: 'P1-M1-N0', finger: 1 as const, cost: 0 }];
    mockComputeFingering.mockResolvedValue({ assignments, totalCost: 0 });
    const onFingeringSuggested = vi.fn();
    render(<QuickPanel score={makeScore()} onFingeringSuggested={onFingeringSuggested} />);

    fireEvent.click(screen.getByText('運指提案'));

    await waitFor(() => expect(mockComputeFingering).toHaveBeenCalled());
    await waitFor(() => expect(onFingeringSuggested).toHaveBeenCalledWith(assignments));
  });
});
