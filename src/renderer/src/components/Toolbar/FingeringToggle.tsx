import React, { useCallback, useRef } from 'react';
import { usePracticeStore } from '../../store';

/**
 * persistShowFingerings の書き込みを直列化するための内部状態
 * （VolumeControl.tsxのpersistVolumeと同型、TASK-055）。
 *
 * `chain`: それまでの書き込み処理をすべて連結したPromise。次の書き込みは必ず
 * これが解決してから開始する（read-modify-writeの並行実行によるlost updateを防ぐ）。
 * `latestValue`: まだ書き込まれていない最新のトグル値。連続してクリックされた場合、
 * 実際にget/setを行うのは1回だけになり、常に「最後に呼ばれた値」が書き込まれる。
 */
interface FingeringVisibilityWriteState {
  chain: Promise<void>;
  latestValue: boolean | null;
}

/**
 * 運指の表示/非表示トグルを electron-store の `ui` 設定へ永続化する（TASK-055）。
 * 既存の `ui` 設定（zoom/pianoHeight/volume等）を保持したままマージして保存する
 * （VolumeControl.persistVolumeと同じ「読み取り→マージ→保存」パターン）。
 * electronAPI が利用できない環境（テスト・ブラウザ単体表示）ではクラッシュせず
 * 何もしない。
 */
function persistShowFingerings(writeState: FingeringVisibilityWriteState, value: boolean): void {
  if (!window.electronAPI?.settings) return;
  writeState.latestValue = value;
  writeState.chain = writeState.chain.then(async () => {
    const valueToWrite = writeState.latestValue;
    if (valueToWrite === null) return;
    writeState.latestValue = null;
    try {
      const currentUi = await window.electronAPI!.settings.get('ui');
      await window.electronAPI!.settings.set('ui', {
        ...currentUi,
        showFingerings: valueToWrite,
      });
    } catch (error) {
      console.error('Failed to persist showFingerings setting:', error);
    }
  });
}

/**
 * 楽譜上・鍵盤上の指番号を一括で表示/非表示にするツールバーのトグルボタン
 * （TASK-055）。`setShowFingerings`（ui-slice）を直接呼び出すため即座に反映され、
 * App.tsx側でScoreRenderer/PianoKeyboardへ渡すannotationsを空配列に切り替える
 * ことで両方の指番号表示を一括制御する。annotation-store自体のデータは
 * 変更しない（表示レイヤの制御のみ）。
 */
export const FingeringToggle: React.FC = () => {
  const { showFingerings, setShowFingerings } = usePracticeStore();

  const writeStateRef = useRef<FingeringVisibilityWriteState>({
    chain: Promise.resolve(),
    latestValue: null,
  });

  const handleClick = useCallback(() => {
    const next = !showFingerings;
    setShowFingerings(next);
    persistShowFingerings(writeStateRef.current, next);
  }, [showFingerings, setShowFingerings]);

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={showFingerings}
      data-testid="fingering-toggle"
      title={
        showFingerings
          ? '運指を非表示にします（楽譜・鍵盤上の指番号を一括で隠します）'
          : '運指を表示します（楽譜・鍵盤上の指番号を一括で表示します）'
      }
      style={{
        height: '44px',
        padding: '0 14px',
        fontSize: '14px',
        fontWeight: 500,
        borderRadius: '6px',
        border: '1px solid #9ca3af',
        backgroundColor: showFingerings ? '#3b82f6' : 'white',
        color: showFingerings ? 'white' : '#374151',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      運指
    </button>
  );
};
