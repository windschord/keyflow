import type { Note, Finger, FingerAssignment } from '../../types';
import type { HandSettings, FingeringResult, DPState, FingeringHand } from './types';
import { weakFingerCost, totalTransitionCost } from './cost-functions';

const FINGERS: Finger[] = [1, 2, 3, 4, 5];

export function computeFingering(
  notes: Note[],
  hand: FingeringHand,
  settings: HandSettings,
  onProgress?: (progress: number) => void,
  deadline?: number
): FingeringResult {
  const n = notes.length;
  if (n === 0) return { assignments: [], totalCost: 0 };

  // 動的計画法の配列、音符と指のインデックスで最小コスト状態を保持
  const dp: DPState[][] = Array.from({ length: n }, () =>
    Array(6)
      .fill(null)
      .map(() => ({ cost: Infinity, prevFinger: null }))
  );

  // 初期化（最初の音符は weakFingerCost のみ）
  for (const f of FINGERS) {
    dp[0][f] = { cost: weakFingerCost(f), prevFinger: null };
  }

  // DP遷移
  for (let i = 1; i < n; i++) {
    // Check for timeout (every 100 iterations to avoid excessive Date.now() calls)
    if (deadline && i % 100 === 0 && Date.now() > deadline) {
      // Return partial result up to the last fully-computed position.
      // dp[i] is not yet computed at this point (before inner loops), so use i-1.
      onProgress?.(i / n);
      return backtrackPartial(dp, notes, i - 1);
    }

    for (const f2 of FINGERS) {
      for (const f1 of FINGERS) {
        if (dp[i - 1][f1].cost === Infinity) continue;
        const tc = totalTransitionCost(f1, f2, notes[i - 1], notes[i], hand, settings);
        const total = dp[i - 1][f1].cost + tc;
        if (total < dp[i][f2].cost) {
          dp[i][f2] = { cost: total, prevFinger: f1 };
        }
      }
    }
    if (i % 10 === 0) onProgress?.(i / n);
  }

  // Report 100% completion after loop finishes
  onProgress?.(1.0);

  return backtrack(dp, notes);
}

function backtrack(dp: DPState[][], notes: Note[]): FingeringResult {
  const n = notes.length;
  let bestFinger: Finger = 1;
  let minCost = Infinity;
  for (const f of FINGERS) {
    if (dp[n - 1][f].cost < minCost) {
      minCost = dp[n - 1][f].cost;
      bestFinger = f;
    }
  }

  const assignments: FingerAssignment[] = [];
  let f: Finger | null = bestFinger;
  for (let i = n - 1; i >= 0; i--) {
    assignments.unshift({ noteId: notes[i].id, finger: f!, cost: dp[i][f!].cost });
    f = dp[i][f!].prevFinger;
  }
  return { assignments, totalCost: minCost };
}

function backtrackPartial(dp: DPState[][], notes: Note[], lastIndex: number): FingeringResult {
  // Return best solution found up to lastIndex
  let bestFinger: Finger = 1;
  let minCost = Infinity;
  for (const f of FINGERS) {
    if (dp[lastIndex][f].cost < minCost) {
      minCost = dp[lastIndex][f].cost;
      bestFinger = f;
    }
  }

  const assignments: FingerAssignment[] = [];
  let f: Finger | null = bestFinger;
  for (let i = lastIndex; i >= 0; i--) {
    assignments.unshift({ noteId: notes[i].id, finger: f!, cost: dp[i][f!].cost });
    f = dp[i][f!].prevFinger;
  }
  return { assignments, totalCost: minCost };
}
