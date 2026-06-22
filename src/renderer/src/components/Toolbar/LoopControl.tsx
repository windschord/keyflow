import React, { useState, useEffect } from 'react';
import { usePracticeStore } from '../../store';

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
      setError('Invalid values');
      return;
    }

    if (start >= end) {
      setError('Start must be < End');
      return;
    }

    setError(null);
    setLoopRange(start, end);
  };

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <input type="checkbox" checked={loopEnabled} onChange={toggleLoop} />
        Loop
      </label>
      <input
        type="number"
        value={startInput}
        onChange={(e) => setStartInput(e.target.value)}
        onBlur={handleBlur}
        style={{ width: '50px' }}
        data-testid="loop-start"
      />
      <span>-</span>
      <input
        type="number"
        value={endInput}
        onChange={(e) => setEndInput(e.target.value)}
        onBlur={handleBlur}
        style={{ width: '50px' }}
        data-testid="loop-end"
      />
      {error && <span style={{ color: 'red', fontSize: '12px' }}>{error}</span>}
      <span style={{ fontSize: '12px', color: '#666' }}>Count: 0</span>
    </div>
  );
};
