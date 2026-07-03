import React, { useState, useEffect } from 'react';
import { usePracticeStore } from '../../store';

const INPUT_STYLE: React.CSSProperties = {
  height: '44px',
  width: '64px',
  fontSize: '16px',
  padding: '0 8px',
  borderRadius: '6px',
  border: '1px solid #d1d5db',
  boxSizing: 'border-box',
  textAlign: 'center',
};

export const LoopControl: React.FC = () => {
  const { loopStart, loopEnd, setLoopRange, loopEnabled, toggleLoop } = usePracticeStore();
  const [startInput, setStartInput] = useState(loopStart.toString());
  const [endInput, setEndInput] = useState(loopEnd.toString());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStartInput(loopStart.toString());
    setEndInput(loopEnd.toString());
  }, [loopStart, loopEnd]);

  const handleBlur = () => {
    const start = parseInt(startInput, 10);
    const end = parseInt(endInput, 10);

    if (isNaN(start) || isNaN(end) || start < 1 || end < 1) {
      setError('無効な値');
      return;
    }

    if (start >= end) {
      setError('開始 < 終了');
      return;
    }

    setError(null);
    setLoopRange(start, end);
  };

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
          checked={loopEnabled}
          onChange={toggleLoop}
          style={{ width: '20px', height: '20px', cursor: 'pointer' }}
        />
        Loop
      </label>
      <input
        type="number"
        value={startInput}
        onChange={(e) => setStartInput(e.target.value)}
        onBlur={handleBlur}
        style={INPUT_STYLE}
        data-testid="loop-start"
      />
      <span style={{ fontSize: '15px' }}>–</span>
      <input
        type="number"
        value={endInput}
        onChange={(e) => setEndInput(e.target.value)}
        onBlur={handleBlur}
        style={INPUT_STYLE}
        data-testid="loop-end"
      />
      {error && <span style={{ color: '#ef4444', fontSize: '13px' }}>{error}</span>}
    </div>
  );
};
