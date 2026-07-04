import { Note, Part, PracticeMode } from '../../types';

/**
 * 判定グループ（派生構造）。
 *
 * `docs/sdd/design/components/data-model-v2.md` の
 * 「判定グループ（派生構造）」節を参照。Scoreには保存せず、
 * practice-engineが小節のNote配列から実行時に導出する。
 */
export interface NoteGroup {
  startTick: number;
  notes: Note[];
}

/**
 * 小節内ノーツを `startTick` でグルーピングする。
 *
 * - 休符（`isRest: true`）は判定グループの対象外として除外する。
 * - 返却されるグループは `startTick` 昇順にソートされる。
 * - グループ内のノーツの順序は、入力配列における出現順を保持する
 *   （`Measure.notes` はstartTick昇順ソート済みが前提だが、本関数自体は
 *   入力順序に依存せず正しくグルーピングできるようMapベースで実装する）。
 */
export function groupNotesByStartTick(notes: Note[]): NoteGroup[] {
  const groupsByTick = new Map<number, Note[]>();

  for (const note of notes) {
    if (note.isRest) continue;

    const existing = groupsByTick.get(note.startTick);
    if (existing) {
      existing.push(note);
    } else {
      groupsByTick.set(note.startTick, [note]);
    }
  }

  return Array.from(groupsByTick.entries())
    .sort(([tickA], [tickB]) => tickA - tickB)
    .map(([startTick, groupNotes]) => ({ startTick, notes: groupNotes }));
}

/**
 * 練習パートフィルタ（Left/Right/Both）をノーツ集合へ適用する。
 *
 * `both` の場合はフィルタなし。`right`/`left` の場合は、対応する
 * `Part.hand` を持つパートのノーツのみを残す。
 */
export function filterNotesByPracticeMode(
  notes: Note[],
  practiceMode: PracticeMode,
  parts: Part[]
): Note[] {
  if (practiceMode === 'both') return notes;

  const rightPartIds = new Set(parts.filter((p) => p.hand === 'right').map((p) => p.id));
  const leftPartIds = new Set(parts.filter((p) => p.hand === 'left').map((p) => p.id));

  return notes.filter((note) => {
    if (practiceMode === 'right') return rightPartIds.has(note.partId);
    if (practiceMode === 'left') return leftPartIds.has(note.partId);
    return true;
  });
}
