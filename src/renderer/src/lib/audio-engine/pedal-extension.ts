import type { Note, PedalSpan } from '../../types';

/**
 * ダンパーペダル区間による発音リリース延長（US-014、REQ-014-002）。
 * 設計: docs/sdd/design/components/pedal-playback.md（再生反映の節）
 *
 * スケジューリング前の純関数計算として、記譜上のノーツからペダル反映後の
 * 実効リリースtick / 実効音価（durationTicks）を静的に解決する。実行時の
 * 動的処理（Transport上でのペダル状態追跡）は行わない。
 */

/** `resolveEffectiveEndTick` が要求する最小限のノーツ形状。 */
export interface NoteRelease {
  startTick: number;
  durationTicks: number;
}

/**
 * ノーツ1件の記譜上のリリースtickに対し、ペダル区間による延長を適用した
 * 実効リリースtickを返す（REQ-014-002）。
 *
 * - 記譜リリース `e = startTick + durationTicks` が `span.startTick <= e < span.endTick`
 *   を満たす区間があれば、実効リリースを `span.endTick` へ延長する。
 * - 境界 `e === span.endTick` はダンパーが上がった直後とみなし、延長しない。
 * - 該当区間がなければ記譜どおり（延長なし）。
 * - 同音再打鍵の切り詰め（次ノートのstartTickでの打ち切り）は本関数の責務外
 *   （一括解決の `resolveEffectiveDurations` が担う）。
 */
export function resolveEffectiveEndTick(
  note: NoteRelease,
  pedalSpans: readonly PedalSpan[]
): number {
  const releaseTick = note.startTick + note.durationTicks;

  const extendingSpan = pedalSpans.find(
    (span) => span.startTick <= releaseTick && releaseTick < span.endTick
  );

  return extendingSpan ? extendingSpan.endTick : releaseTick;
}

/**
 * ノーツ集合に対して、ペダル延長と同音再打鍵の切り詰めを適用した実効音価
 * （durationTicks）を一括解決する（US-014備考）。
 *
 * 同一 `midiNumber` のノーツを `startTick` 昇順に走査し、延長後の実効リリースが
 * 次の同音の `startTick` を超える場合は、次の発音開始tickまでに切り詰める
 * （`Tone.Sampler` 等の同音重複トリガーによる音量肥大・位相干渉を防ぐため）。
 *
 * 戻り値は入力の `Note` オブジェクト参照をキーとした `Map`。呼び出し側
 * （`loadScore`）は同一の配列を渡し、同一の参照でルックアップすること。
 */
export function resolveEffectiveDurations(
  notes: readonly Note[],
  pedalSpans: readonly PedalSpan[]
): Map<Note, number> {
  const result = new Map<Note, number>();

  const notesByMidiNumber = new Map<number, Note[]>();
  notes.forEach((note) => {
    const group = notesByMidiNumber.get(note.midiNumber) ?? [];
    group.push(note);
    notesByMidiNumber.set(note.midiNumber, group);
  });

  notesByMidiNumber.forEach((group) => {
    const sortedByStartTick = [...group].sort((a, b) => a.startTick - b.startTick);

    sortedByStartTick.forEach((note, index) => {
      const extendedEndTick = resolveEffectiveEndTick(note, pedalSpans);
      const nextNote = sortedByStartTick[index + 1];
      const effectiveEndTick = nextNote
        ? Math.min(extendedEndTick, nextNote.startTick)
        : extendedEndTick;

      result.set(note, effectiveEndTick - note.startTick);
    });
  });

  return result;
}
