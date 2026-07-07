import React from 'react';
import { usePracticeStore } from '../../store';

const ICON_BUTTON_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '36px',
  height: '36px',
  flexShrink: 0,
  padding: 0,
  backgroundColor: 'transparent',
  border: 'none',
  borderRadius: '6px',
  color: '#374151',
  cursor: 'pointer',
};

const ICON_BUTTON_ACTIVE_STYLE: React.CSSProperties = {
  ...ICON_BUTTON_STYLE,
  backgroundColor: '#dbeafe',
  color: '#3b82f6',
};

/**
 * メトロノームON/OFFのヘッダー常駐アイコントグル（TASK-079）。
 *
 * 2026-07-08のユーザー実機フィードバック「⋯の中にあると見つけられない」
 * （docs/sdd/design/decisions/DEC-007.md 改訂節）を受け、練習中によく
 * 触る操作としてヘッダーへ常駐させた。`metronomeEnabled`のみを操作する。
 * PracticeModeSelectorの選択中スタイルに合わせたアクティブ表示（背景色）と
 * `aria-pressed`で状態を示す。再生中も操作可能な現行仕様は維持する。
 *
 * 1拍目強調（`metronomeAccentEnabled`）は下記`MetronomeAccentToggle`として
 * QuickPanel側に残す（機能の喪失禁止、REQ-012-004）。
 */
export const MetronomeToggle: React.FC = () => {
  const { metronomeEnabled, setMetronomeEnabled } = usePracticeStore();

  return (
    <button
      type="button"
      onClick={() => setMetronomeEnabled(!metronomeEnabled)}
      aria-pressed={metronomeEnabled}
      aria-label="メトロノーム"
      title="メトロノーム"
      data-testid="metronome-toggle"
      style={metronomeEnabled ? ICON_BUTTON_ACTIVE_STYLE : ICON_BUTTON_STYLE}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6 20h12l-3-14H9z"></path>
        <line x1="12" y1="6" x2="9" y2="20"></line>
        <circle cx="12" cy="11" r="1" fill="currentColor" stroke="none"></circle>
      </svg>
    </button>
  );
};

/**
 * 1拍目強調のみを操作するチェックボックス（QuickPanel用、TASK-079）。
 *
 * TempoControl（`components/Toolbar/TempoControl.tsx`）から切り出した
 * メトロノームON/OFF+1拍目強調トグル（TASK-074）のうち、ON/OFF部分は
 * 上記`MetronomeToggle`としてヘッダーへ移動した。
 * 本コンポーネントは1拍目強調（`metronomeAccentEnabled`）のみを操作する。
 * storeアクション（`setMetronomeAccentEnabled`）の経路は変更しない。
 */
export const MetronomeAccentToggle: React.FC = () => {
  const { metronomeAccentEnabled, setMetronomeAccentEnabled } = usePracticeStore();

  return (
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
  );
};
