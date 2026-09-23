import React, { useEffect } from 'react';
import { usePracticeStore } from '../../store';
import { useTranslation } from '../../lib/i18n/useTranslation';

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
      className="kf-seg"
    >
      <button
        data-testid="mode-left"
        title={t.practiceModeSelector.leftTitle}
        className={`kf-seg__btn ${practiceMode === 'left' ? 'kf-seg__btn--active' : ''}`}
        onClick={() => setPracticeMode('left')}
      >
        {t.practiceModeSelector.left}
      </button>
      <button
        data-testid="mode-right"
        title={t.practiceModeSelector.rightTitle}
        className={`kf-seg__btn ${practiceMode === 'right' ? 'kf-seg__btn--active' : ''}`}
        onClick={() => setPracticeMode('right')}
      >
        {t.practiceModeSelector.right}
      </button>
      <button
        data-testid="mode-both"
        title={t.practiceModeSelector.bothTitle}
        className={`kf-seg__btn ${practiceMode === 'both' ? 'kf-seg__btn--active' : ''}`}
        onClick={() => setPracticeMode('both')}
      >
        {t.practiceModeSelector.both}
      </button>
    </div>
  );
};
