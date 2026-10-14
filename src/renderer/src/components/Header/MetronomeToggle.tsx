import React from 'react';
import { usePracticeStore } from '../../store';
import { useTranslation } from '../../lib/i18n/useTranslation';

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
  const t = useTranslation();

  return (
    <button
      type="button"
      onClick={() => setMetronomeEnabled(!metronomeEnabled)}
      aria-pressed={metronomeEnabled}
      aria-label={t.metronome.toggleLabel}
      title={t.metronome.toggleLabel}
      data-testid="metronome-toggle"
      className={`kf-icon-btn ${metronomeEnabled ? 'kf-icon-btn--active' : ''}`}
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
  const t = useTranslation();

  return (
    <label
      title={t.metronome.accentTitle}
      className="kf-settings-check"
      style={{ height: '32px' }}
    >
      <input
        type="checkbox"
        checked={metronomeAccentEnabled}
        onChange={(e) => setMetronomeAccentEnabled(e.target.checked)}
        className="kf-check"
        data-testid="metronome-accent-checkbox"
      />
      {t.metronome.accentLabel}
    </label>
  );
};
