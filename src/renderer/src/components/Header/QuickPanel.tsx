import React from 'react';
import type { Score } from '../../types/score';
import type { FingerAssignment } from '../../types/annotation';
import { VolumeControl } from '../Toolbar/VolumeControl';
import { ZoomControl } from '../Toolbar/ZoomControl';
import { FingeringToggle } from '../Toolbar/FingeringToggle';
import { FingeringPanel } from '../FingeringPanel';
import { StatsDisplay } from '../StatsDisplay';
import { MetronomeToggle } from './MetronomeToggle';

export interface QuickPanelProps {
  /** 運指提案（FingeringPanel）の対象となる楽譜。未読み込み時はnull。 */
  score: Score | null;
  /** FingeringPanelが運指提案を計算した際に呼び出されるコールバック。 */
  onFingeringSuggested: (assignments: FingerAssignment[]) => void;
  /** アノテーション読み込み中など、運指提案ボタンを無効化したい場合にtrue。 */
  fingeringDisabled?: boolean;
}

const SECTION_LABEL_STYLE: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  color: '#6b7280',
  marginBottom: '4px',
};

const SECTION_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
};

/**
 * 低頻度操作パネル（QuickPanel、TASK-074、design/components/header.md）。
 * ヘッダーの`⋯`ボタン押下時にPopover内で表示する。
 *
 * 音量・表示倍率・運指・メトロノーム・成績の5セクションで構成し、
 * 各セクションは既存コンポーネント（ロジック不変）をそのまま再利用する。
 * このコンポーネント自体はコンパクト表示のためのラッパースタイルのみを
 * 追加し、既存コンポーネントのprops・store結線には一切手を加えない
 * （REQ-012-004: 機能の喪失禁止）。
 *
 * ヘッダー本体（Header/index.tsx）への統合・開閉状態の管理はTASK-075で行う。
 */
export const QuickPanel: React.FC<QuickPanelProps> = ({
  score,
  onFingeringSuggested,
  fingeringDisabled,
}) => {
  return (
    <div
      data-testid="quick-panel"
      style={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: '240px' }}
    >
      <div style={SECTION_STYLE}>
        <span style={SECTION_LABEL_STYLE}>音量</span>
        <VolumeControl />
      </div>

      <div style={SECTION_STYLE}>
        <span style={SECTION_LABEL_STYLE}>表示倍率</span>
        <ZoomControl />
      </div>

      <div style={SECTION_STYLE}>
        <span style={SECTION_LABEL_STYLE}>運指</span>
        <FingeringToggle />
        <FingeringPanel
          score={score}
          onSuggested={onFingeringSuggested}
          disabled={fingeringDisabled}
        />
      </div>

      <div style={SECTION_STYLE}>
        <span style={SECTION_LABEL_STYLE}>メトロノーム</span>
        <MetronomeToggle />
      </div>

      <div style={SECTION_STYLE}>
        <span style={SECTION_LABEL_STYLE}>成績</span>
        <StatsDisplay />
      </div>
    </div>
  );
};
