import { Note } from '../../types';

/**
 * 判定グループ（`Note[]`、パートをまたぐ和音・両手同時押下を含む）に対する
 * 現在の押鍵状態を判定する。
 *
 * パート横断のグループでも、同じ判定基準（MIDIノート番号の集合一致）で
 * 正誤判定できるため、単一パート内の和音判定との後方互換を保ったまま
 * 両手同時押下にも対応する。
 */
export function judgeChord(
  pressedKeys: Set<number>,
  expectedNotes: Note[]
): 'correct' | 'incorrect' | 'partial' {
  if (expectedNotes.length === 0) return 'correct';

  const expectedMidiNumbers = new Set(expectedNotes.map((n) => n.midiNumber));

  let hasIncorrect = false;
  for (const key of pressedKeys) {
    if (!expectedMidiNumbers.has(key)) {
      hasIncorrect = true;
      break;
    }
  }

  if (hasIncorrect) {
    return 'incorrect';
  }

  // All pressed keys are expected, check if we have ALL expected keys
  if (pressedKeys.size === expectedMidiNumbers.size) {
    return 'correct';
  }

  return 'partial';
}
