import React from 'react';
import { usePracticeStore } from '../../store';

/**
 * メトロノームのON/OFF + 1拍目強調トグル（TASK-074）。
 *
 * TempoControl（`components/Toolbar/TempoControl.tsx`）に元々含まれていた
 * メトロノーム関連チェックボックスをQuickPanel向けに切り出したもの。
 * Zustandの `metronomeEnabled` / `metronomeAccentEnabled` とその更新アクション
 * （`setMetronomeEnabled` / `setMetronomeAccentEnabled`）は、TempoControlと
 * 完全に同じ経路（同一のstoreアクション）で操作する。状態・結線は一切変更しない。
 *
 * TempoControl本体はこの時点では変更しない（メトロノームUIの除去はTASK-075）。
 */
export const MetronomeToggle: React.FC = () => {
  const {
    metronomeEnabled,
    setMetronomeEnabled,
    metronomeAccentEnabled,
    setMetronomeAccentEnabled,
  } = usePracticeStore();

  return (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
      <label
        title="メトロノームの音を鳴らします"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          height: '32px',
          cursor: 'pointer',
          fontSize: '14px',
          color: '#374151',
        }}
      >
        <input
          type="checkbox"
          checked={metronomeEnabled}
          onChange={(e) => setMetronomeEnabled(e.target.checked)}
          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
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
          height: '32px',
          cursor: 'pointer',
          fontSize: '14px',
          color: '#374151',
        }}
      >
        <input
          type="checkbox"
          checked={metronomeAccentEnabled}
          onChange={(e) => setMetronomeAccentEnabled(e.target.checked)}
          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          data-testid="metronome-accent-checkbox"
        />
        1拍目強調
      </label>
    </div>
  );
};
