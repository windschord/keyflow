import React, { useState, useEffect } from 'react';
import { usePracticeStore } from '../../store';

const INPUT_STYLE: React.CSSProperties = {
  height: '36px',
  width: '48px',
  fontSize: '14px',
  padding: '0 6px',
  borderRadius: '6px',
  border: '1px solid #d1d5db',
  boxSizing: 'border-box',
  textAlign: 'center',
};

/**
 * ループ有効トグル＋開始/終了小節入力（TASK-075でコンパクト化）。
 *
 * 「開始小節:」「終了小節:」の可視ラベルは各入力の`title`属性（ツールチップ）へ
 * 集約し、ループ有効トグルの「ループ」テキストはアイコン表示に置き換えつつ
 * `aria-label`/`title`で意味を維持する（design/components/header.md）。
 */
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
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      <label
        title="ループ再生（指定した小節範囲の繰り返し）の有効/無効を切り替えます"
        aria-label="ループ"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          height: '36px',
          cursor: 'pointer',
          fontSize: '16px',
          color: '#374151',
        }}
      >
        <input
          type="checkbox"
          checked={loopEnabled}
          onChange={toggleLoop}
          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
        />
        <span aria-hidden="true">&#128257;</span>
      </label>
      <input
        id="loop-start"
        type="number"
        value={startInput}
        onChange={(e) => setStartInput(e.target.value)}
        onBlur={handleBlur}
        title="ループの開始小節番号"
        style={INPUT_STYLE}
        data-testid="loop-start"
      />
      <span style={{ fontSize: '14px', color: '#374151' }}>–</span>
      <input
        id="loop-end"
        type="number"
        value={endInput}
        onChange={(e) => setEndInput(e.target.value)}
        onBlur={handleBlur}
        title="ループの終了小節番号"
        style={INPUT_STYLE}
        data-testid="loop-end"
      />
      {error && <span style={{ color: '#ef4444', fontSize: '12px' }}>{error}</span>}
    </div>
  );
};
