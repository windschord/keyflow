import React, { useCallback, useRef } from 'react';
import { usePracticeStore } from '../../store';
import { useTranslation } from '../../lib/i18n/useTranslation';

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
 *
 * TASK-059: ボタンの配色だけでは状態が読み取れないという実機フィードバックを
 * 受け、「運指」ラベル・ON/OFFスイッチ（トラック＋ノブ）・状態文言
 * （表示中/非表示）の3要素で構成するスイッチ型トグルに変更した。クリック可能
 * 領域はこれら3要素を包むbutton要素全体のままとし、操作性を維持する。
 */
export const FingeringToggle: React.FC = () => {
  const { showFingerings, setShowFingerings } = usePracticeStore();
  const t = useTranslation();

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
      title={showFingerings ? t.fingeringToggle.titleHide : t.fingeringToggle.titleShow}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        height: '44px',
        padding: '0 14px',
        fontSize: '14px',
        fontWeight: 500,
        borderRadius: '6px',
        border: '1px solid #9ca3af',
        backgroundColor: 'white',
        color: '#374151',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      <span>{t.fingeringToggle.label}</span>
      <span
        aria-hidden="true"
        style={{
          position: 'relative',
          display: 'inline-block',
          width: '36px',
          height: '20px',
          borderRadius: '10px',
          backgroundColor: showFingerings ? '#3b82f6' : '#9ca3af',
          transition: 'background-color 0.15s ease',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: '2px',
            left: showFingerings ? '18px' : '2px',
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            backgroundColor: 'white',
            transition: 'left 0.15s ease',
          }}
        />
      </span>
      <span>{showFingerings ? t.fingeringToggle.statusShown : t.fingeringToggle.statusHidden}</span>
    </button>
  );
};
