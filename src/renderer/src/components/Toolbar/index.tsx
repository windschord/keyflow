import React, { useEffect, useState } from 'react';
import { PracticeModeSelector } from './PracticeModeSelector';
import { TempoControl } from './TempoControl';
import { LoopControl } from './LoopControl';
import { SettingsDialog } from './SettingsDialog';

export const Toolbar: React.FC = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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
        alignItems: 'center',
      }}
    >
      <PracticeModeSelector />
      <div style={{ width: '1px', alignSelf: 'stretch', backgroundColor: '#ccc' }}></div>
      <TempoControl />
      <div style={{ width: '1px', alignSelf: 'stretch', backgroundColor: '#ccc' }}></div>
      <LoopControl />
      <div style={{ flexGrow: 1 }}></div>
      <button
        onClick={() => setIsSettingsOpen(true)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '20px',
          padding: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title="Settings"
        aria-label="Settings"
      >
        ⚙️
      </button>

      {isSettingsOpen && <SettingsDialog onClose={() => setIsSettingsOpen(false)} />}
    </div>
  );
};
