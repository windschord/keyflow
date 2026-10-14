import React from 'react';
import type { Score } from '../../types/score';
import type { FingerAssignment } from '../../types/annotation';
import { VolumeControl } from '../Toolbar/VolumeControl';
import { ZoomControl } from '../Toolbar/ZoomControl';
import { ScoreLayoutControl } from '../Toolbar/ScoreLayoutControl';
import { FingeringToggle } from '../Toolbar/FingeringToggle';
import { FingeringEditToggle } from '../Toolbar/FingeringEditToggle';
import { FingeringPanel } from '../FingeringPanel';
import { StatsDisplay } from '../StatsDisplay';
import { MetronomeAccentToggle } from './MetronomeToggle';
import { useTranslation } from '../../lib/i18n/useTranslation';

export interface QuickPanelProps {
  /** 運指提案（FingeringPanel）の対象となる楽譜。未読み込み時はnull。 */
  score: Score | null;
  /** FingeringPanelが運指提案を計算した際に呼び出されるコールバック。 */
  onFingeringSuggested: (assignments: FingerAssignment[]) => void;
  /** アノテーション読み込み中など、運指提案ボタンを無効化したい場合にtrue。 */
  fingeringDisabled?: boolean;
  /** 指法编辑模式是否开启（FingeringEditToggle 受控状态，App 持有）。 */
  fingeringEditMode?: boolean;
  /** 指法编辑模式切换回调。 */
  onFingeringEditModeChange?: (checked: boolean) => void;
}

/**
 * 「表示・補助」パネル（QuickPanel、TASK-074、design/components/header.md）。
 * ヘッダーの表示・補助ボタン押下時にPopover内で表示する。
 *
 * 各セクションは既存コンポーネント（ロジック不変）をそのまま再利用する。
 * このコンポーネント自体はコンパクト表示のためのラッパースタイルのみを
 * 追加し、既存コンポーネントのprops・store結線には一切手を加えない
 * （REQ-012-004: 機能の喪失禁止）。
 *
 * TASK-079: 2026-07-08のユーザー実機フィードバック「⋯と設定画面の分類が
 * わからない」（DEC-007改訂節）を受け、セクションを「表示（音量・表示倍率）/
 * 運指 / 成績 / メトロノーム詳細（1拍目強調）」の4つへ再編成した。
 * メトロノームON/OFF本体はヘッダー常駐（`MetronomeToggle`）へ移動したため、
 * 本パネルには1拍目強調（`MetronomeAccentToggle`）のみを残す。
 *
 * ヘッダー本体（Header/index.tsx）への統合・開閉状態の管理はTASK-075で行う。
 */
export const QuickPanel: React.FC<QuickPanelProps> = ({
  score,
  onFingeringSuggested,
  fingeringDisabled,
  fingeringEditMode,
  onFingeringEditModeChange,
}) => {
  const t = useTranslation();

  return (
    <div
      data-testid="quick-panel"
      style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '240px' }}
    >
      <div className="kf-panel-section">
        <span className="kf-panel-label">{t.quickPanel.displaySection}</span>
        <VolumeControl />
        <ZoomControl />
        <ScoreLayoutControl />
      </div>

      <div className="kf-panel-section">
        <span className="kf-panel-label">{t.quickPanel.fingeringSection}</span>
        <FingeringToggle />
        <FingeringEditToggle
          checked={fingeringEditMode ?? false}
          onChange={onFingeringEditModeChange ?? (() => {})}
        />
        <FingeringPanel
          score={score}
          onSuggested={onFingeringSuggested}
          disabled={fingeringDisabled}
        />
      </div>

      <div className="kf-panel-section">
        <span className="kf-panel-label">{t.quickPanel.statsSection}</span>
        <StatsDisplay />
      </div>

      <div className="kf-panel-section">
        <span className="kf-panel-label">{t.quickPanel.metronomeDetailSection}</span>
        <MetronomeAccentToggle />
      </div>
    </div>
  );
};
