import React from 'react';
import { usePracticeStore } from '../../store';
import { useTranslation } from '../../lib/i18n/useTranslation';

// ズームレベルの選択肢（REQ-002-006）。50%〜400%の範囲を用意し、
// 400%はE2Eの手動スクロール検証（tests/e2e/app.spec.ts）が
// スクロール可能な状態を確実に作れるよう利用する。
const ZOOM_LEVELS: Array<{ value: number; label: string }> = [
  { value: 0.5, label: '50%' },
  { value: 0.75, label: '75%' },
  { value: 1, label: '100%' },
  { value: 1.25, label: '125%' },
  { value: 1.5, label: '150%' },
  { value: 2, label: '200%' },
  { value: 3, label: '300%' },
  { value: 4, label: '400%' },
];

/**
 * 楽譜の表示倍率（ズーム）を変更するUI（REQ-002-006）。
 * `setZoom`（ui-slice）を直接呼び出す。ScoreRenderer 側は CSS zoom で
 * 倍率を適用するため、変更しても OSMD の再描画は発生しない。
 * Ctrl+滚轮连续缩放会产生预设以外的任意值，此时在列表前部显示当前百分比。
 */
export const ZoomControl: React.FC = () => {
  const { zoom, setZoom } = usePracticeStore();
  const t = useTranslation();
  const isPreset = ZOOM_LEVELS.some((level) => level.value === zoom);

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <label htmlFor="zoom-select" style={{ fontSize: '14px', color: 'var(--kf-text-2)' }}>
        {t.zoomControl.label}
      </label>
      <select
        id="zoom-select"
        data-testid="zoom-select"
        value={String(zoom)}
        onChange={(e) => setZoom(Number(e.target.value))}
        title={t.zoomControl.title}
        className="kf-select"
      >
        {!isPreset && (
          <option value={zoom}>{Math.round(zoom * 100)}%</option>
        )}
        {ZOOM_LEVELS.map((level) => (
          <option key={level.value} value={level.value}>
            {level.label}
          </option>
        ))}
      </select>
    </div>
  );
};
