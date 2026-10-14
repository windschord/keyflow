import React, { useEffect, useRef } from 'react';
import type { Finger } from '../../types/annotation';
import { useTranslation } from '../../lib/i18n/useTranslation';

export interface FingeringPickerProps {
  /** 被点击指法数字对应的音符 noteId。 */
  noteId: string;
  /** 选择条显示位置（屏幕坐标，来自点击事件）。 */
  x: number;
  y: number;
  /** 当前指法（高亮显示），无指法时为 undefined。 */
  currentFinger?: number;
  /** 选中某个指法数字后触发（App 侧修改 annotation-store 并关闭）。 */
  onSelectFinger: (noteId: string, finger: Finger) => void;
  /** 关闭选择条（Esc / 点击外部）。 */
  onClose: () => void;
}

const FINGER_OPTIONS: Finger[] = [1, 2, 3, 4, 5];

/**
 * 指法编辑模式中点击乐谱上的指法数字后弹出的数字选择条（1-5）。
 * 选择后立即通过 onSelectFinger 修改指法并关闭；Esc 或点击外部关闭。
 * 与 NoteContextMenu（右键菜单）不同，本组件只提供指法数字选择，不含删除/评论。
 */
export const FingeringPicker: React.FC<FingeringPickerProps> = ({
  noteId,
  x,
  y,
  currentFinger,
  onSelectFinger,
  onClose,
}) => {
  const t = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handlePointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [onClose]);

  return (
    <div
      ref={rootRef}
      data-testid="fingering-picker"
      style={{
        position: 'fixed',
        left: x,
        top: y + 8,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        padding: '8px',
        borderRadius: '8px',
        border: '1px solid #d1d5db',
        backgroundColor: '#ffffff',
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
      }}
    >
      <div style={{ fontWeight: 600, fontSize: '12px', color: '#6b7280' }}>
        {t.fingeringPicker.title}
      </div>
      <div style={{ display: 'flex', gap: '4px' }}>
        {FINGER_OPTIONS.map((finger) => (
          <button
            key={finger}
            type="button"
            data-testid={`finger-pick-option-${finger}`}
            onClick={() => onSelectFinger(noteId, finger)}
            aria-pressed={currentFinger === finger}
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '4px',
              border: '1px solid #9ca3af',
              backgroundColor: currentFinger === finger ? '#18181b' : '#fff',
              color: currentFinger === finger ? '#fff' : '#111827',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            {finger}
          </button>
        ))}
      </div>
    </div>
  );
};
