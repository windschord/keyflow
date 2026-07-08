import React, { useState, useEffect } from 'react';
import { usePracticeStore } from '../../store';

const INPUT_STYLE: React.CSSProperties = {
  height: '36px',
  fontSize: '14px',
  padding: '0 6px',
  borderRadius: '6px',
  border: '1px solid #d1d5db',
  boxSizing: 'border-box',
};

/**
 * テンポ（BPM入力＋原曲比スライダー＋リセット）を操作するコントロール（TASK-075でコンパクト化）。
 *
 * メトロノームのON/OFF・1拍目強調はQuickPanel内のMetronomeToggleへ移設済み（TASK-074）であり、
 * 本コンポーネントはテンポ系のみを扱う。
 * 説明ラベルは可視テキストとして表示せず、各入力のtitle属性（ツールチップ）へ集約する。
 * 詳細はdesign/components/header.mdを参照。
 */
export const TempoControl: React.FC = () => {
  const { bpm, originalBpm, setBpm, playbackState } = usePracticeStore();
  const [inputValue, setInputValue] = useState(bpm.toString());

  // TASK-067: 再生中（playing）はテンポ設定UI（スライダー・数値入力・
  // リセットボタン）を無効化する（REQ-006-010、ユーザー要望2026-07-07）。
  // エンジン側のテンポ変更自体は再生中も機能しているが、UI仕様として
  // 変更操作を制限する。メトロノーム系チェックボックスは対象外とする
  // （MetronomeToggle.tsx側で再生中も操作可能であることを検証済み）。
  const isTempoLocked = playbackState === 'playing';

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
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      <span
        aria-hidden="true"
        title="テンポ（BPM: 1分あたりの拍数）"
        style={{ fontSize: '15px', color: '#374151' }}
      >
        &#9834;=
      </span>
      <input
        id="tempo-input"
        type="number"
        min={bpmMin}
        max={bpmMax}
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        disabled={isTempoLocked}
        title="テンポをBPM（1分あたりの拍数）で直接指定します"
        style={{ ...INPUT_STYLE, width: '56px' }}
        data-testid="tempo-input"
      />
      <input
        id="tempo-slider"
        type="range"
        min="20"
        max="200"
        value={currentRatio}
        onChange={handleSliderChange}
        disabled={isTempoLocked}
        title="テンポ（原曲テンポに対する割合。20%〜200%）"
        style={{
          height: '36px',
          width: '100px',
          cursor: isTempoLocked ? 'not-allowed' : 'pointer',
        }}
        data-testid="tempo-slider"
      />
      <button
        type="button"
        onClick={() => setBpm(originalBpm)}
        disabled={isTempoLocked}
        title="テンポを楽譜本来のテンポに戻します"
        aria-label="テンポをリセット"
        style={{
          height: '36px',
          width: '36px',
          padding: 0,
          fontSize: '15px',
          borderRadius: '6px',
          border: '1px solid #9ca3af',
          backgroundColor: 'white',
          cursor: isTempoLocked ? 'not-allowed' : 'pointer',
        }}
      >
        &#8635;
      </button>
    </div>
  );
};
