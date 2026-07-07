import React, { useRef, useState } from 'react';
import { PracticeModeSelector } from '../Toolbar/PracticeModeSelector';
import { TempoControl } from '../Toolbar/TempoControl';
import { LoopControl } from '../Toolbar/LoopControl';
import { PlaybackControls, PlaybackAudioEngine } from '../Toolbar/PlaybackControls';
import { Popover } from './Popover';
import { QuickPanel } from './QuickPanel';
import { MetronomeToggle } from './MetronomeToggle';
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
 * 頻用操作（開く・再生・停止・ループ・テンポ・練習対象・メトロノームON/OFF）は
 * 常時表示する。低頻度操作（音量・表示倍率・運指・成績・メトロノーム詳細）は
 * 「表示・補助」パネル（QuickPanel）へ移設する。
 * 各子コンポーネントはロジックとstore結線を一切変更せず再利用する（REQ-012-004）。
 *
 * TASK-078: 1行維持のための`overflow: hidden`が絶対配置のPopoverをクリップしていた
 * （docs/sdd/troubleshooting/2026-07-08-quickpanel-clipped/analysis.md）。
 * これを避けるため、「外側ラッパー（overflowなし）＋内側1行row（overflow:hidden）」の
 * 2層構造にする。Popoverは内側rowの外、外側ラッパー直下に配置する。
 *
 * TASK-079: 2026-07-08のユーザー実機フィードバック「⋯と設定画面の分類がわからない」
 * （DEC-007改訂節）を受け、メトロノームON/OFFは練習中によく触る操作として
 * ヘッダーへ常駐させ、QuickPanelは「表示・補助」用途であることをアイコンと
 * ツールチップで明示する。
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
    <div data-testid="app-header" style={{ position: 'relative' }}>
      <div
        data-testid="app-header-row"
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
        <Divider />
        <MetronomeToggle />

        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            flexShrink: 0,
          }}
        >
          <button
            ref={quickPanelAnchorRef}
            type="button"
            onClick={() => setIsQuickPanelOpen((open) => !open)}
            aria-label="表示・補助"
            aria-expanded={isQuickPanelOpen}
            title="表示・補助（音量・表示倍率・運指・成績）"
            data-testid="quick-panel-toggle"
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
              <line x1="4" y1="21" x2="4" y2="14"></line>
              <line x1="4" y1="10" x2="4" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12" y2="3"></line>
              <line x1="20" y1="21" x2="20" y2="16"></line>
              <line x1="20" y1="12" x2="20" y2="3"></line>
              <line x1="1" y1="14" x2="7" y2="14"></line>
              <line x1="9" y1="8" x2="15" y2="8"></line>
              <line x1="17" y1="16" x2="23" y2="16"></line>
            </svg>
          </button>

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

      <Popover
        isOpen={isQuickPanelOpen}
        onClose={() => setIsQuickPanelOpen(false)}
        anchorRef={quickPanelAnchorRef}
        rightOffset={12}
      >
        <QuickPanel
          score={score}
          onFingeringSuggested={onFingeringSuggested}
          fingeringDisabled={fingeringDisabled}
        />
      </Popover>
    </div>
  );
};
