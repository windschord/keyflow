import React, { useCallback } from 'react';
import { usePracticeStore } from '../../store';

/**
 * ボリューム変更を electron-store の `ui` 設定へ永続化する（TASK-052）。
 * 既存の `ui` 設定（zoom/pianoHeight等）を保持したままマージして保存する
 * （SettingsModal.updateUiSetting と同じ「読み取り→マージ→保存」パターン）。
 * electronAPI が利用できない環境（テスト・ブラウザ単体表示）ではクラッシュせず
 * 何もしない。
 */
async function persistVolume(value: number): Promise<void> {
  if (!window.electronAPI?.settings) return;
  try {
    const currentUi = await window.electronAPI.settings.get('ui');
    await window.electronAPI.settings.set('ui', { ...currentUi, volume: value });
  } catch (error) {
    console.error('Failed to persist volume setting:', error);
  }
}

/**
 * マスターボリュームを変更するツールバー部品（TASK-052）。
 * `setVolume`（ui-slice）を直接呼び出すため即座に反映され、usePractice側の
 * useEffect（bpm/metronomeEnabledと同型）が `audioEngine.setMasterVolume` へ同期する。
 */
export const VolumeControl: React.FC = () => {
  const { volume, setVolume } = usePracticeStore();

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number(e.target.value);
      setVolume(value);
      void persistVolume(value);
    },
    [setVolume]
  );

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <label htmlFor="volume-slider" style={{ fontSize: '14px', color: '#374151' }}>
        音量:
      </label>
      <input
        id="volume-slider"
        data-testid="volume-slider"
        type="range"
        min={0}
        max={100}
        value={volume}
        onChange={handleChange}
        title="音量を調整します（0でミュート、再生・メトロノーム・効果音すべてに反映されます）"
        style={{ height: '44px', cursor: 'pointer' }}
      />
      <span style={{ fontSize: '14px', color: '#374151', minWidth: '28px' }}>{volume}</span>
    </div>
  );
};
