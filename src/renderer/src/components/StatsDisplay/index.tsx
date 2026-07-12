import React from 'react';
import { usePracticeStore } from '../../store';
import { useTranslation } from '../../lib/i18n/useTranslation';

/**
 * 正解率・連続正解数の可視化（US-004、NFR-U-002: 日本語ラベル）。
 *
 * practice-engine が Zustand store（practice-slice）に保持する `stats` を購読し、
 * 練習画面（Toolbar）に常時表示する。
 */
export const StatsDisplay: React.FC = () => {
  const stats = usePracticeStore((s) => s.stats);
  const t = useTranslation();
  const accuracyPercent = Math.round(stats.accuracy * 100);

  return (
    <div
      data-testid="stats-display"
      style={{ display: 'flex', gap: '16px', alignItems: 'center', fontSize: '14px' }}
    >
      <span data-testid="stats-accuracy" style={{ color: '#374151', whiteSpace: 'nowrap' }}>
        {t.statsDisplay.accuracyLabel} <strong>{accuracyPercent}%</strong>
      </span>
      <span
        data-testid="stats-consecutive-correct"
        style={{ color: '#374151', whiteSpace: 'nowrap' }}
      >
        {t.statsDisplay.consecutiveLabel} <strong>{stats.consecutiveCorrect}</strong>
      </span>
    </div>
  );
};
