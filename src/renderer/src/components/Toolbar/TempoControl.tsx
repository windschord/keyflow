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
  const {
    bpm,
    originalBpm,
    setBpm,
    metronomeEnabled,
    setMetronomeEnabled,
    metronomeAccentEnabled,
    setMetronomeAccentEnabled,
  } = usePracticeStore();
  const [inputValue, setInputValue] = useState(bpm.toString());

  useEffect(() => {
    setInputValue(bpm.toString());
  }, [bpm]);

  // REQ-006-003: テンポは元のテンポ（originalBpm）の20%〜200%の範囲でのみ変更できる。
  // 絶対値でのクランプ（従来の20〜400固定）は行わず、setBpm側（ui-slice.ts）の
  // originalBpm比クランプに委ねる。
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const ratio = parseInt(e.target.value, 10) / 100;
    const newBpm = originalBpm > 0 ? Math.round(originalBpm * ratio) : 120;
    setBpm(newBpm);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    const newBpm = parseInt(inputValue, 10);
    setBpm(isNaN(newBpm) ? bpm : newBpm);
    // setBpmが実際にクランプ・適用した値を表示に反映する（自己矛盾のあるUI表示を防ぐ）。
    setInputValue(usePracticeStore.getState().bpm.toString());
  };

  const currentRatio = originalBpm > 0 ? Math.round((bpm / originalBpm) * 100) : 100;
  const bpmMin = originalBpm > 0 ? Math.round(originalBpm * 0.2) : 24;
  const bpmMax = originalBpm > 0 ? Math.round(originalBpm * 2.0) : 240;

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <label htmlFor="tempo-slider" style={{ fontSize: '14px', color: '#374151' }}>
        テンポ:
      </label>
      <input
        id="tempo-slider"
        type="range"
        min="20"
        max="200"
        value={currentRatio}
        onChange={handleSliderChange}
        title="テンポ（原曲テンポに対する割合。20%〜200%）"
        style={{ height: '44px', cursor: 'pointer' }}
        data-testid="tempo-slider"
      />
      <label htmlFor="tempo-input" style={{ fontSize: '14px', color: '#374151' }}>
        BPM:
      </label>
      <input
        id="tempo-input"
        type="number"
        min={bpmMin}
        max={bpmMax}
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        title="テンポをBPM（1分あたりの拍数）で直接指定します"
        style={{ ...INPUT_STYLE, width: '72px' }}
        data-testid="tempo-input"
      />
      <button
        onClick={() => setBpm(originalBpm)}
        title="テンポを楽譜本来のテンポに戻します"
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
        リセット
      </button>
      <label
        title="メトロノームの音を鳴らします"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          height: '44px',
          cursor: 'pointer',
          fontSize: '15px',
          color: '#374151',
        }}
      >
        <input
          type="checkbox"
          checked={metronomeEnabled}
          onChange={(e) => setMetronomeEnabled(e.target.checked)}
          style={{ width: '20px', height: '20px', cursor: 'pointer' }}
          data-testid="metronome-checkbox"
        />
        メトロノーム
      </label>
      <label
        title="メトロノームの一拍目のクリック音を他拍より強く鳴らします"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          height: '44px',
          cursor: 'pointer',
          fontSize: '15px',
          color: '#374151',
        }}
      >
        <input
          type="checkbox"
          checked={metronomeAccentEnabled}
          onChange={(e) => setMetronomeAccentEnabled(e.target.checked)}
          style={{ width: '20px', height: '20px', cursor: 'pointer' }}
          data-testid="metronome-accent-checkbox"
        />
        1拍目強調
      </label>
    </div>
  );
};
