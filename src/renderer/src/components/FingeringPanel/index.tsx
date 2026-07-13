import React, { useState, useRef, useEffect } from 'react';
import type { Score, FingerAssignment } from '../../types';
import { FingeringEngineService, DEFAULT_HAND_SETTINGS } from '../../lib/fingering-engine';
import type { FingeringHand } from '../../workers/fingering/types';
import { useTranslation } from '../../lib/i18n/useTranslation';
import { formatMessage } from '../../lib/i18n/format';

interface FingeringPanelProps {
  score: Score | null;
  onSuggested: (assignments: FingerAssignment[]) => void;
  disabled?: boolean;
}

const TOUCH_HEIGHT = 44;

export const FingeringPanel: React.FC<FingeringPanelProps> = ({ score, onSuggested, disabled }) => {
  const t = useTranslation();
  const [computing, setComputing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [hand, setHand] = useState<FingeringHand>('right');

  const engineRef = useRef<FingeringEngineService | null>(null);

  useEffect(() => {
    engineRef.current = new FingeringEngineService();
    return () => {
      engineRef.current?.dispose();
    };
  }, []);

  const handleCompute = async () => {
    if (!score || !engineRef.current) return;

    setComputing(true);
    setProgress(0);
    setError(null);

    // TASK-048: パート単位（Part.hand）ではなくNote単位（Note.hand）でフィルタする。
    // 1パート2段譜（`staves=2`）でも、staff由来のNote.handにより正しく
    // 対象の手の音符だけを計算対象にできる。
    const notesToCompute = score.measures
      .flatMap((m) => m.notes)
      .filter((n) => n.hand === hand && !n.isRest);

    if (notesToCompute.length === 0) {
      const handLabel =
        hand === 'right' ? t.fingeringPanel.handOptionRight : t.fingeringPanel.handOptionLeft;
      setError(formatMessage(t.fingeringPanel.noNotesError, { hand: handLabel }));
      setComputing(false);
      return;
    }

    try {
      const result = await engineRef.current.computeFingering(
        notesToCompute,
        hand,
        DEFAULT_HAND_SETTINGS,
        (p) => setProgress(p)
      );
      onSuggested(result.assignments);
    } catch (err) {
      setError(String(err));
    } finally {
      setComputing(false);
    }
  };

  const isDisabled = computing || !score || !!disabled;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
      <label
        htmlFor="hand-select"
        style={{ fontSize: '14px', whiteSpace: 'nowrap', color: '#374151' }}
      >
        {t.fingeringPanel.handSelectLabel}
      </label>
      <select
        id="hand-select"
        value={hand}
        onChange={(e) => setHand(e.target.value as FingeringHand)}
        disabled={computing || !!disabled}
        title={t.fingeringPanel.handSelectTitle}
        style={{
          height: `${TOUCH_HEIGHT}px`,
          fontSize: '16px',
          padding: '0 8px',
          borderRadius: '6px',
          border: '1px solid #d1d5db',
          backgroundColor: 'white',
          cursor: computing || !!disabled ? 'not-allowed' : 'pointer',
        }}
      >
        <option value="right">{t.fingeringPanel.handOptionRight}</option>
        <option value="left">{t.fingeringPanel.handOptionLeft}</option>
      </select>

      <div style={{ position: 'relative' }}>
        <button
          onClick={handleCompute}
          disabled={isDisabled}
          style={{
            height: `${TOUCH_HEIGHT}px`,
            padding: '0 18px',
            fontSize: '16px',
            fontWeight: 500,
            borderRadius: '6px',
            border: 'none',
            backgroundColor: isDisabled ? '#9ca3af' : '#3b82f6',
            color: 'white',
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
            minWidth: '110px',
            transition: 'background-color 0.15s',
            overflow: 'hidden',
          }}
        >
          {computing ? `${Math.round(progress * 100)}%` : t.fingeringPanel.computeButton}
          {computing && (
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                height: '3px',
                width: `${progress * 100}%`,
                backgroundColor: 'rgba(255,255,255,0.6)',
                transition: 'width 0.3s ease',
              }}
            />
          )}
        </button>
      </div>

      {error && (
        <span
          title={error}
          style={{
            fontSize: '13px',
            color: '#ef4444',
            whiteSpace: 'nowrap',
            maxWidth: '200px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          ⚠ {error}
        </span>
      )}
    </div>
  );
};
