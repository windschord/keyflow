import React, { useEffect } from 'react';
import { usePracticeStore } from '../../store';

export const PracticeModeSelector: React.FC = () => {
  const { practiceMode, setPracticeMode } = usePracticeStore();

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
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <label>Mode:</label>
      <button
        data-testid="mode-left"
        style={{ fontWeight: practiceMode === 'left' ? 'bold' : 'normal' }}
        onClick={() => setPracticeMode('left')}
      >
        Left (L)
      </button>
      <button
        data-testid="mode-right"
        style={{ fontWeight: practiceMode === 'right' ? 'bold' : 'normal' }}
        onClick={() => setPracticeMode('right')}
      >
        Right (R)
      </button>
      <button
        data-testid="mode-both"
        style={{ fontWeight: practiceMode === 'both' ? 'bold' : 'normal' }}
        onClick={() => setPracticeMode('both')}
      >
        Both (B)
      </button>
    </div>
  );
};
