import React, { useRef, useState } from 'react';
import { PracticeModeSelector } from '../Toolbar/PracticeModeSelector';
import { TempoControl } from '../Toolbar/TempoControl';
import { LoopControl } from '../Toolbar/LoopControl';
import { PlaybackControls, PlaybackAudioEngine } from '../Toolbar/PlaybackControls';
import { Popover } from './Popover';
import { QuickPanel } from './QuickPanel';
import type { Score } from '../../types/score';
import type { FingerAssignment } from '../../types/annotation';

export interface HeaderProps {
  /** 「ファイルを開く」アイコンボタンクリック時に呼び出される（US-001）。 */
  onOpenFile: () => void;
  /** 右端の設定（歯車）ボタンクリック時に呼び出される。 */
  onOpenSettings: () => void;
  /** PlaybackControlsへそのまま橋渡しする再生エンジン参照。 */
  audioEngine?: PlaybackAudioEngine;
  /** 現在読み込まれている楽譜（PlaybackControls/QuickPanel内FingeringPanelの両方が使用）。 */
  score: Score | null;
  /** QuickPanel内FingeringPanelが運指提案を計算した際に呼び出されるコールバック。 */
  onFingeringSuggested: (assignments: FingerAssignment[]) => void;
  /** アノテーション読み込み中など、運指提案ボタンを無効化したい場合にtrue。 */
  fingeringDisabled?: boolean;
}

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

const Divider: React.FC = () => (
  <div style={{ width: '1px', height: '28px', backgroundColor: '#d1d5db', flexShrink: 0 }} />
);

/**
 * 1行ヘッダー（TASK-075、design/components/header.md）。
 *
 * 旧App.tsx上段バーとToolbar/index.tsxの2ブロック構成を、高さ48px（最大56px）の
 * 1行へ統合する（US-012、DEC-007）。
 * 頻用操作（開く・再生・停止・ループ・テンポ・練習対象）は常時表示する。
 * 低頻度操作（音量・表示倍率・運指・メトロノーム・成績）はQuickPanelへ移設する。
 * 各子コンポーネントはロジックとstore結線を一切変更せず再利用する（REQ-012-004）。
 */
export const Header: React.FC<HeaderProps> = ({
  onOpenFile,
  onOpenSettings,
  audioEngine,
  score,
  onFingeringSuggested,
  fingeringDisabled,
}) => {
  const [isQuickPanelOpen, setIsQuickPanelOpen] = useState(false);
  const quickPanelAnchorRef = useRef<HTMLButtonElement>(null);

  return (
    <div
      data-testid="app-header"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        height: '48px',
        maxHeight: '56px',
        padding: '0 12px',
        backgroundColor: '#f5f5f5',
        borderBottom: '1px solid #ccc',
        flexWrap: 'nowrap',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      <button
        type="button"
        onClick={onOpenFile}
        aria-label="ファイルを開く"
        title="MusicXMLファイルを開きます"
        style={ICON_BUTTON_STYLE}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"></path>
        </svg>
      </button>

      <Divider />
      <PlaybackControls audioEngine={audioEngine} score={score} />
      <Divider />
      <LoopControl />
      <Divider />
      <TempoControl />
      <Divider />
      <PracticeModeSelector />

      <div
        style={{
          marginLeft: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          position: 'relative',
          flexShrink: 0,
        }}
      >
        <button
          ref={quickPanelAnchorRef}
          type="button"
          onClick={() => setIsQuickPanelOpen((open) => !open)}
          aria-label="その他の操作"
          aria-expanded={isQuickPanelOpen}
          title="音量・表示倍率・運指・メトロノーム・成績"
          data-testid="quick-panel-toggle"
          style={ICON_BUTTON_STYLE}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="5" cy="12" r="2"></circle>
            <circle cx="12" cy="12" r="2"></circle>
            <circle cx="19" cy="12" r="2"></circle>
          </svg>
        </button>

        <Popover
          isOpen={isQuickPanelOpen}
          onClose={() => setIsQuickPanelOpen(false)}
          anchorRef={quickPanelAnchorRef}
        >
          <QuickPanel
            score={score}
            onFingeringSuggested={onFingeringSuggested}
            fingeringDisabled={fingeringDisabled}
          />
        </Popover>

        <button
          type="button"
          onClick={onOpenSettings}
          title="設定"
          aria-label="設定"
          style={ICON_BUTTON_STYLE}
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
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </button>
      </div>
    </div>
  );
};
