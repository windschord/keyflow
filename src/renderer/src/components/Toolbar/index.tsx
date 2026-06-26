import React, { useEffect } from 'react';
import { PracticeModeSelector } from './PracticeModeSelector';
import { TempoControl } from './TempoControl';
import { LoopControl } from './LoopControl';

export const Toolbar: React.FC = () => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA'].includes(tag)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        // Dummy play/pause logic
        console.log('Play/Pause toggled');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        gap: '24px',
        padding: '12px',
        borderBottom: '1px solid #ccc',
        backgroundColor: '#f5f5f5',
        flexWrap: 'wrap',
      }}
    >
      <PracticeModeSelector />
      <div style={{ width: '1px', backgroundColor: '#ccc' }}></div>
      <TempoControl />
      <div style={{ width: '1px', backgroundColor: '#ccc' }}></div>
      <LoopControl />
    </div>
  );
};
