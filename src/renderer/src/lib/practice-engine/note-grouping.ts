import { Note, PracticeMode } from '../../types';

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

const groupCache = new WeakMap<Note[], NoteGroup[]>();

/**
 * `groupNotesByStartTick` のメモ化版。`Measure.notes` 配列そのものの参照をキーに
 * キャッシュする（CodeRabbit指摘: resolvePositionが押鍵のたびに全小節をO(n)で
 * 再グルーピングしていたホットパスのコスト対応）。
 *
 * `Measure.notes` がMusicXMLパース後は不変（同一の配列インスタンスが使い回される）
 * という前提のもとで成立する。resolvePosition・getCurrentPositionTick等、同じ
 * `measure.notes` 配列に対して繰り返しグルーピングを行う呼び出し元はこちらを使う。
 *
 * 戻り値はキャッシュされた配列そのものを返すため、呼び出し側で内容を変更しないこと
 * （キャッシュを汚染してしまうため）。
 */
export function getGroupsForNotes(notes: Note[]): NoteGroup[] {
  const cached = groupCache.get(notes);
  if (cached) return cached;

  const groups = groupNotesByStartTick(notes);
  groupCache.set(notes, groups);
  return groups;
}

/**
 * 練習パートフィルタ（Left/Right/Both）をノーツ集合へ適用する。
 *
 * `both` の場合はフィルタなし。`right`/`left` の場合は、`note.hand` が
 * 一致するノーツのみを残す（TASK-048でパート単位判定からNote単位判定へ変更）。
 * 1パート2段譜でも段（手）ごとに正しくフィルタするためである。
 */
export function filterNotesByPracticeMode(notes: Note[], practiceMode: PracticeMode): Note[] {
  if (practiceMode === 'both') return notes;

  return notes.filter((note) => note.hand === practiceMode);
}
