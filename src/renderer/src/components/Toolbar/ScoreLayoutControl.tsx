import React from 'react';
import { usePracticeStore } from '../../store';
import { useTranslation } from '../../lib/i18n/useTranslation';
import type { ScoreLayout } from '../../types/score-layout';

/**
 * 楽譜ページの配置方向（縦積み/横並び）を切り替えるUI。
 * `setScoreLayout`（ui-slice）を直接呼び出す。ScoreRenderer 側はこの値で
 * ページの並べ方を CSS のみで切り替えるため、OSMD の再描画は発生しない。
 */

/**
 * 布局方向变更时持久化到 electron-store（"记住用户习惯"）。
 * 与 VolumeControl/FingeringToggle 相同的「读取→合并→保存」模式，
 * 保持其它 ui 设置（zoom/pianoHeight 等）不变。electronAPI 不可用
 * （测试・浏览器单页展示）时静默跳过。布局切换是低频点击操作，
 * 无需像音量滑杆那样做写入串行化。
 */
function persistScoreLayout(layout: ScoreLayout): void {
  if (!window.electronAPI?.settings) return;
  window.electronAPI.settings
    .get('ui')
    .then((currentUi) => window.electronAPI!.settings.set('ui', { ...currentUi, scoreLayout: layout }))
    .catch((error) => console.error('Failed to persist score layout setting:', error));
}

const LAYOUTS: Array<{ value: ScoreLayout; label: string }> = [
  { value: 'vertical', label: 'Vertical' },
  { value: 'horizontal', label: 'Horizontal' },
];

export const ScoreLayoutControl: React.FC = () => {
  const { scoreLayout, setScoreLayout } = usePracticeStore();
  const t = useTranslation();

  const handleSelect = (layout: ScoreLayout): void => {
    setScoreLayout(layout);
    persistScoreLayout(layout);
  };

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <label htmlFor="score-layout-toggle" style={{ fontSize: '14px', color: 'var(--kf-text-2)' }}>
        {t.scoreLayoutControl.label}
      </label>
      <div
        id="score-layout-toggle"
        data-testid="score-layout-toggle"
        title={t.scoreLayoutControl.title}
        className="kf-seg"
      >
        {LAYOUTS.map((l) => (
          <button
            key={l.value}
            type="button"
            data-testid={`score-layout-${l.value}`}
            onClick={() => handleSelect(l.value)}
            className={`kf-seg__btn ${scoreLayout === l.value ? 'kf-seg__btn--active' : ''}`}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
};
