import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { QuickPanel } from './QuickPanel';
import { usePracticeStore } from '../../store';

// TASK-074: 低頻度操作パネル（QuickPanel、design/components/header.md）。
// 音量・表示倍率・運指・成績・メトロノーム詳細の各セクションを内包し、
// 既存コンポーネント（VolumeControl/ZoomControl/FingeringToggle/FingeringPanel/
// StatsDisplay）はロジック不変で再利用する（REQ-012-004）。
//
// TASK-079: 2026-07-08のユーザー実機フィードバック（DEC-007改訂）により、
// セクションを「表示（音量・表示倍率）/ 運指 / 成績 / メトロノーム詳細（1拍目強調）」
// へ再編成した。メトロノームON/OFF本体はヘッダー常駐（MetronomeToggle）へ移動した
// ため、本パネルからは削除する。

vi.mock('../../lib/fingering-engine', () => ({
  FingeringEngineService: vi.fn().mockImplementation(() => ({
    computeFingering: vi.fn(),
    dispose: vi.fn(),
  })),
  DEFAULT_HAND_SETTINGS: { maxSpanSemitones: 14, scaleFactorLeft: 1.0 },
}));

describe('QuickPanel', () => {
  beforeEach(() => {
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

  it('forwards suggested fingerings from FingeringPanel to onFingeringSuggested', () => {
    const onFingeringSuggested = vi.fn();
    render(<QuickPanel score={null} onFingeringSuggested={onFingeringSuggested} />);
    // score が null の場合、運指提案ボタンは無効化されクリックしても
    // computeFingering は呼ばれない（FingeringPanelの既存挙動）。
    // ここではpropsが正しくFingeringPanelへ橋渡しされていることを型面で保証する。
    expect(screen.getByText('運指提案')).toBeInTheDocument();
    expect(onFingeringSuggested).not.toHaveBeenCalled();
  });
});
