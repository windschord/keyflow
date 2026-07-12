import React, { useCallback, useRef } from 'react';
import { usePracticeStore } from '../../store';
import { useTranslation } from '../../lib/i18n/useTranslation';

/**
 * persistVolume の書き込みを直列化するための内部状態（CodeRabbit PR#25指摘#1）。
 *
 * `chain`: それまでの書き込み処理をすべて連結したPromise。次の書き込みは必ず
 * これが解決してから開始する（read-modify-writeの並行実行によるlost updateを防ぐ）。
 * `latestValue`: まだ書き込まれていない最新のボリューム値。連続して呼ばれた場合、
 * 実際にget/setを行うのは1回だけになり、常に「最後に呼ばれた値」が書き込まれる。
 */
interface VolumeWriteState {
  chain: Promise<void>;
  latestValue: number | null;
}

/**
 * ボリューム変更を electron-store の `ui` 設定へ永続化する（TASK-052）。
 * 既存の `ui` 設定（zoom/pianoHeight等）を保持したままマージして保存する
 * （SettingsModal.updateUiSetting と同じ「読み取り→マージ→保存」パターン）。
 * electronAPI が利用できない環境（テスト・ブラウザ単体表示）ではクラッシュせず
 * 何もしない。
 *
 * range の onChange は高頻度で発火するため、get('ui')→set('ui') という
 * 非同期read-modify-writeを並行実行すると解決順序が入れ替わりうる。
 * 後から開始した書き込みが先に完了し、その後に古い値のsetも完了して
 * 上書きする（lost update）おそれあり。`writeState` に保持したPromiseチェーンで
 * 書き込みを直列化し、各書き込みの実行時点で最新の値のみを反映することで防ぐ。
 */
function persistVolume(writeState: VolumeWriteState, value: number): void {
  if (!window.electronAPI?.settings) return;
  writeState.latestValue = value;
  writeState.chain = writeState.chain.then(async () => {
    const valueToWrite = writeState.latestValue;
    if (valueToWrite === null) return;
    // 直前の書き込みで確定させる値を確保したら、以降に来る書き込みが
    // 重複して同じ値を書かないようクリアする。
    writeState.latestValue = null;
    try {
      const currentUi = await window.electronAPI!.settings.get('ui');
      await window.electronAPI!.settings.set('ui', { ...currentUi, volume: valueToWrite });
    } catch (error) {
      console.error('Failed to persist volume setting:', error);
    }
  });
}

/**
 * マスターボリュームを変更するツールバー部品（TASK-052）。
 * `setVolume`（ui-slice）を直接呼び出すため即座に反映され、usePractice側の
 * useEffect（bpm/metronomeEnabledと同型）が `audioEngine.setMasterVolume` へ同期する。
 */
export const VolumeControl: React.FC = () => {
  const { volume, setVolume } = usePracticeStore();
  const t = useTranslation();

  const writeStateRef = useRef<VolumeWriteState>({ chain: Promise.resolve(), latestValue: null });

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number(e.target.value);
      setVolume(value);
      persistVolume(writeStateRef.current, value);
    },
    [setVolume]
  );

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <label htmlFor="volume-slider" style={{ fontSize: '14px', color: '#374151' }}>
        {t.volumeControl.label}
      </label>
      <input
        id="volume-slider"
        data-testid="volume-slider"
        type="range"
        min={0}
        max={100}
        value={volume}
        onChange={handleChange}
        title={t.volumeControl.title}
        style={{ height: '44px', cursor: 'pointer' }}
      />
      <span style={{ fontSize: '14px', color: '#374151', minWidth: '28px' }}>{volume}</span>
    </div>
  );
};
