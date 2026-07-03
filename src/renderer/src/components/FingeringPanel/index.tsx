import React, { useState, useRef, useEffect } from 'react';
import type { Score, FingerAssignment } from '../../types';
import { FingeringEngineService, DEFAULT_HAND_SETTINGS } from '../../lib/fingering-engine';
import type { FingeringHand } from '../../workers/fingering/types';

interface FingeringPanelProps {
  score: Score | null;
  onSuggested: (assignments: FingerAssignment[]) => void;
}

export const FingeringPanel: React.FC<FingeringPanelProps> = ({ score, onSuggested }) => {
  const [computing, setComputing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
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
    setMessage(null);

    // Extract all notes from the score for the selected hand.
    // Assuming part's hand matches `hand` state, or we just extract all for now.
    // Better to filter by part.hand === hand if available, otherwise just use all notes.
    // For simplicity, extracting all notes from the first matching part.
    const parts = score.parts.filter((p) => p.hand === hand || p.hand === 'unknown');
    if (parts.length === 0) {
      setError(`No parts found for hand: ${hand}`);
      setComputing(false);
      return;
    }

    const partIds = new Set(parts.map((p) => p.id));
    const notesToCompute = score.measures
      .flatMap((m) => m.notes)
      .filter((n) => partIds.has(n.partId) && !n.isRest);

    if (notesToCompute.length === 0) {
      setError('No playable notes found to compute.');
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
      setMessage(`Fingering computation complete. Total cost: ${result.totalCost}`);
    } catch (err) {
      setError(String(err));
    } finally {
      setComputing(false);
    }
  };

  return (
    <div className="fingering-panel border p-4 rounded shadow-sm bg-white">
      <h3 className="text-lg font-bold mb-4">運指提案</h3>

      <div className="mb-4">
        <label className="mr-2 font-medium">対象手:</label>
        <select
          value={hand}
          onChange={(e) => setHand(e.target.value as FingeringHand)}
          disabled={computing}
          className="border p-1 rounded"
        >
          <option value="right">右手</option>
          <option value="left">左手</option>
        </select>
      </div>

      <button
        onClick={handleCompute}
        disabled={computing || !score}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
      >
        {computing ? '計算中...' : '運指提案'}
      </button>

      {computing && (
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded h-2">
            <div className="bg-blue-500 h-2 rounded" style={{ width: `${progress * 100}%` }} />
          </div>
          <p className="text-sm text-gray-600 mt-1">{Math.round(progress * 100)}%</p>
        </div>
      )}

      {error && <p className="mt-4 text-red-500">{error}</p>}
      {message && <p className="mt-4 text-green-600">{message}</p>}
    </div>
  );
};
