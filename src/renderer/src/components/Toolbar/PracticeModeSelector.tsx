import React, { useEffect } from 'react';
import { usePracticeStore } from '../../store';

const BTN_STYLE: React.CSSProperties = {
  height: '44px',
  padding: '0 14px',
  fontSize: '15px',
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
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      <button
        data-testid="mode-left"
        style={practiceMode === 'left' ? BTN_ACTIVE_STYLE : BTN_STYLE}
        onClick={() => setPracticeMode('left')}
      >
        Left (L)
      </button>
      <button
        data-testid="mode-right"
        style={practiceMode === 'right' ? BTN_ACTIVE_STYLE : BTN_STYLE}
        onClick={() => setPracticeMode('right')}
      >
        Right (R)
      </button>
      <button
        data-testid="mode-both"
        style={practiceMode === 'both' ? BTN_ACTIVE_STYLE : BTN_STYLE}
        onClick={() => setPracticeMode('both')}
      >
        Both (B)
      </button>
    </div>
  );
};
