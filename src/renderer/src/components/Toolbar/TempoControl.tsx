import React, { useState, useEffect } from 'react';
import { usePracticeStore } from '../../store';

const INPUT_STYLE: React.CSSProperties = {
  height: '44px',
  fontSize: '16px',
  padding: '0 8px',
  borderRadius: '6px',
  border: '1px solid #d1d5db',
  boxSizing: 'border-box',
};

export const TempoControl: React.FC = () => {
  const { bpm, originalBpm, setBpm, metronomeEnabled, setMetronomeEnabled } = usePracticeStore();
  const [inputValue, setInputValue] = useState(bpm.toString());

  useEffect(() => {
    setInputValue(bpm.toString());
  }, [bpm]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const ratio = parseInt(e.target.value, 10) / 100;
    const newBpm = originalBpm > 0 ? Math.round(originalBpm * ratio) : 120;
    setBpm(Math.max(20, Math.min(400, newBpm)));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    let newBpm = parseInt(inputValue, 10);
    if (isNaN(newBpm)) {
      newBpm = bpm;
    } else {
      newBpm = Math.max(20, Math.min(400, newBpm));
    }
    setBpm(newBpm);
    setInputValue(newBpm.toString());
  };

  const currentRatio = originalBpm > 0 ? Math.round((bpm / originalBpm) * 100) : 100;

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <input
        type="range"
        min="20"
        max="200"
        value={currentRatio}
        onChange={handleSliderChange}
        style={{ height: '44px', cursor: 'pointer' }}
        data-testid="tempo-slider"
      />
      <input
        type="number"
        min="20"
        max="400"
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        style={{ ...INPUT_STYLE, width: '72px' }}
        data-testid="tempo-input"
      />
      <button
        onClick={() => setBpm(originalBpm)}
        style={{
          height: '44px',
          padding: '0 12px',
          fontSize: '15px',
          borderRadius: '6px',
          border: '1px solid #9ca3af',
          backgroundColor: 'white',
          cursor: 'pointer',
        }}
      >
        Reset
      </button>
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          height: '44px',
          cursor: 'pointer',
          fontSize: '15px',
        }}
      >
        <input
          type="checkbox"
          checked={metronomeEnabled}
          onChange={(e) => setMetronomeEnabled(e.target.checked)}
          style={{ width: '20px', height: '20px', cursor: 'pointer' }}
        />
        Metronome
      </label>
    </div>
  );
};
