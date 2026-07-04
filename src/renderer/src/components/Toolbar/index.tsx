import React from 'react';
import { PracticeModeSelector } from './PracticeModeSelector';
import { TempoControl } from './TempoControl';
import { LoopControl } from './LoopControl';
import { PlaybackControls, PlaybackAudioEngine } from './PlaybackControls';

interface ToolbarProps {
  onOpenSettings?: () => void;
  audioEngine?: PlaybackAudioEngine;
}

export const Toolbar: React.FC<ToolbarProps> = ({ onOpenSettings, audioEngine }) => {
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
      <div style={{ width: '1px', backgroundColor: '#ccc' }}></div>
      <PlaybackControls audioEngine={audioEngine} />

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
        <button
          onClick={onOpenSettings}
          title="設定"
          aria-label="設定"
          style={{
            padding: '8px',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            borderRadius: '50%',
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#e0e0e0')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </button>
      </div>
    </div>
  );
};
