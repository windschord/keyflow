import React, { useEffect } from 'react';
import { usePracticeStore } from '../../store';
import { useTranslation } from '../../lib/i18n/useTranslation';

const BTN_STYLE: React.CSSProperties = {
  height: '36px',
  padding: '0 12px',
  fontSize: '14px',
  borderRadius: '6px',
  border: '1px solid #9ca3af',
  backgroundColor: 'white',
  cursor: 'pointer',
};

const BTN_ACTIVE_STYLE: React.CSSProperties = {
  ...BTN_STYLE,
  fontWeight: 'bold',
  backgroundColor: '#dbeafe',
  borderColor: '#3b82f6',
};

/**
 * 練習対象（左手/右手/両手）セグメントボタン（TASK-075でコンパクト化）。
 *
 * 「練習対象:」の可視グループラベルは、運指対象選択（FingeringPanel）との
 * 混同を避けるための説明であるため、コンテナ全体の`title`属性（ツールチップ）へ
 * 移す（design/components/header.md: ラベルテキストのツールチップ化）。
 * 各ボタン自体の日本語ラベル・ショートカット表記（toolbar.md）は変更しない。
 */
export const PracticeModeSelector: React.FC = () => {
  const { practiceMode, setPracticeMode } = usePracticeStore();
  const t = useTranslation();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLButtonElement ||
        e.target instanceof HTMLSelectElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      switch (e.key.toLowerCase()) {
        case 'r':
          setPracticeMode('right');
          break;
        case 'l':
          setPracticeMode('left');
          break;
        case 'b':
          setPracticeMode('both');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setPracticeMode]);

  return (
    <div
      data-testid="practice-mode-group"
      title={t.practiceModeSelector.groupTitle}
      style={{ display: 'flex', gap: '6px', alignItems: 'center' }}
    >
      <button
        data-testid="mode-left"
        title={t.practiceModeSelector.leftTitle}
        style={practiceMode === 'left' ? BTN_ACTIVE_STYLE : BTN_STYLE}
        onClick={() => setPracticeMode('left')}
      >
        {t.practiceModeSelector.left}
      </button>
      <button
        data-testid="mode-right"
        title={t.practiceModeSelector.rightTitle}
        style={practiceMode === 'right' ? BTN_ACTIVE_STYLE : BTN_STYLE}
        onClick={() => setPracticeMode('right')}
      >
        {t.practiceModeSelector.right}
      </button>
      <button
        data-testid="mode-both"
        title={t.practiceModeSelector.bothTitle}
        style={practiceMode === 'both' ? BTN_ACTIVE_STYLE : BTN_STYLE}
        onClick={() => setPracticeMode('both')}
      >
        {t.practiceModeSelector.both}
      </button>
    </div>
  );
};
