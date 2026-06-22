import React, { useState, useEffect } from 'react';
import { usePracticeStore } from '../../store';

export const TempoControl: React.FC = () => {
  const { bpm, originalBpm, setBpm, metronomeEnabled, setMetronomeEnabled } = usePracticeStore();
  const [inputValue, setInputValue] = useState(bpm.toString());

  useEffect(() => {
    setInputValue(bpm.toString());
  }, [bpm]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const ratio = parseInt(e.target.value, 10) / 100;
    setBpm(Math.round(originalBpm * ratio));
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

  const currentRatio = Math.round((bpm / originalBpm) * 100) || 100;

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <label>Tempo:</label>
      <input
        type="range"
        min="20"
        max="200"
        value={currentRatio}
        onChange={handleSliderChange}
        data-testid="tempo-slider"
      />
      <input
        type="number"
        min="20"
        max="400"
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        style={{ width: '60px' }}
        data-testid="tempo-input"
      />
      <span>BPM</span>
      <button onClick={() => setBpm(originalBpm)}>Reset</button>
      <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <input
          type="checkbox"
          checked={metronomeEnabled}
          onChange={(e) => setMetronomeEnabled(e.target.checked)}
        />
        Metronome
      </label>
    </div>
  );
};
