import React from 'react';
import { usePracticeStore } from '../../store';

// ズームレベルの選択肢（REQ-002-006）。50%〜400%の範囲を用意し、
// 400%はE2Eの手動スクロール検証（tests/e2e/app.spec.ts）が
// スクロール可能な状態を確実に作るために利用する。
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
 * `setZoom`（ui-slice）を直接呼び出すため、モーダルを開閉せずに
 * ScoreRenderer（osmd-controller.setZoom）へ即座に反映される。
 */
export const ZoomControl: React.FC = () => {
  const { zoom, setZoom } = usePracticeStore();

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <label htmlFor="zoom-select" style={{ fontSize: '14px', color: '#374151' }}>
        表示倍率:
      </label>
      <select
        id="zoom-select"
        data-testid="zoom-select"
        value={String(zoom)}
        onChange={(e) => setZoom(Number(e.target.value))}
        title="楽譜の表示倍率を変更します"
        style={{
          height: '44px',
          fontSize: '15px',
          padding: '0 8px',
          borderRadius: '6px',
          border: '1px solid #d1d5db',
          cursor: 'pointer',
        }}
      >
        {ZOOM_LEVELS.map((level) => (
          <option key={level.value} value={level.value}>
            {level.label}
          </option>
        ))}
      </select>
    </div>
  );
};
