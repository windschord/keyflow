import React, { useCallback } from 'react';
import { useTranslation } from '../../lib/i18n/useTranslation';

export interface FingeringEditToggleProps {
  /** 指法编辑模式是否开启（受控状态，由 App 持有）。 */
  checked: boolean;
  /** 切换时的回调。 */
  onChange: (checked: boolean) => void;
}

/**
 * 指法编辑模式开关（QuickPanel「運指」セクションに配置）。
 * 开启后乐谱上的指法数字变为可点击，点击数字可修改指法（App 侧弹出数字选择条）。
 * 与 FingeringToggle（指法显示开关）相互独立：编辑模式开启时 App 会强制显示指法，
 * 关闭后按 FingeringToggle 的原设置显示。
 * 仿 FingeringToggle 的开关样式（label + 开关 + 状态文言）。
 */
export const FingeringEditToggle: React.FC<FingeringEditToggleProps> = ({ checked, onChange }) => {
  const t = useTranslation();

  const handleClick = useCallback(() => {
    onChange(!checked);
  }, [checked, onChange]);

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={checked}
      data-testid="fingering-edit-toggle"
      title={checked ? t.fingeringEditToggle.titleOn : t.fingeringEditToggle.titleOff}
      className="kf-toggle"
    >
      <span>{t.fingeringEditToggle.label}</span>
      <span
        aria-hidden="true"
        style={{
          position: 'relative',
          display: 'inline-block',
          width: '36px',
          height: '20px',
          borderRadius: '10px',
          backgroundColor: checked ? '#16a34a' : '#9ca3af',
          transition: 'background-color 0.15s ease',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: '2px',
            left: checked ? '18px' : '2px',
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            backgroundColor: 'white',
            transition: 'left 0.15s ease',
          }}
        />
      </span>
      <span>{checked ? t.fingeringEditToggle.statusOn : t.fingeringEditToggle.statusOff}</span>
    </button>
  );
};
