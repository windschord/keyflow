import type { Note, Finger, FingerAssignment } from '../../types';
import type { HandSettings, FingeringResult, FingeringHand } from './types';
import { getSpan } from './span-table';
import {
  weakFingerCost,
  thumbOnBlackCost,
  fiveOnBlackCost,
  spanCost,
  thumbPassingCost,
  largeJumpCost,
} from './cost-functions';
import { applyScalePattern } from './scale-patterns';

/**
 * 1コードユニット（和音）内で同時に扱える最大構成音数。
 * 片手の指は5本のため、C(5,k)の組み合わせ状態が扱える上限はk=5。
 * TASK-050注意事項: 6音以上の同時発音（片手内で5音を超える場合）は稀な入力として、
 * 最も低い5音のみをDPの対象にし、残りは `assignOverflowFingers` で
 * 最も近い割当済みの指を再利用するフォールバックとする（詳細は同関数のコメント参照）。
 */
const MAX_UNIT_SIZE = 5;

/** あふれた構成音（MAX_UNIT_SIZEを超える分）に課す固定ペナルティ。物理的に演奏不能なことを示す。 */
const OVERFLOW_PENALTY = 100;

/**
 * DPの連鎖が断絶した（あるユニットで全組み合わせのコストがInfinityになった）場合に、
 * チェーンを再開するときに課す固定ペナルティ（2026-07-05 実機フィードバック対応）。
 *
 * 実楽譜では以下が普通に起きるため、Infinityのままにするとバックトラックが破綻し
 * 運指が一切出力されなくなる:
 * - 手のスパン上限を超える広い和音（アルペジオ前提の記譜等）→ 全comboのユニット内コストがInfinity
 * - 5音和音の連続 → 対応する指同士が必ず「同一指・異音高」となり全遷移コストがInfinity
 */
const CHAIN_BREAK_PENALTY = 500;

/** 緩和コスト: スパンが物理上限(max)を超えた場合の、超過半音あたりのペナルティ。 */
const INFEASIBLE_SPAN_PENALTY_PER_SEMITONE = 25;

/** 緩和コスト: ユニット内で同一指が異音高に重複した場合の固定ペナルティ。 */
const SAME_FINGER_UNIT_PENALTY = 200;

/**
 * 「コードユニット」: 同時に鳴る音の集合（和音、単音の場合はサイズ1）を1つの遷移ステップとして
 * まとめたもの。
 *
 * ユニット化にはNote.isChordを判定基準として使う（同一startTickかどうかを都度比較するのではない）。
 * MusicXMLの仕様上、`<chord/>` 要素を持つ音符（isChord===true）は必ず直前の非chord音符と
 * 同一startTickで発音されるため、「isChordが連続する音符を1ユニットにまとめる」ことは
 * 実データにおいて「同一startTickの音集合をユニット化する」ことと等価である。
 * 一方でisChordを判定基準にすることで、実際の時刻情報（startTick）を厳密に持たない
 * テスト用Noteフィクスチャ（例: 本ファイルのテストで使うmakeNoteは全ノートでstartTick:0固定）
 * に対しても、和音でない限り従来どおり1音=1ユニットの区切りを維持できる
 * （既存dp-solver.test.tsの単旋律回帰テストとの互換性を優先するための設計判断）。
 */
interface ChordUnit {
  /** ユニットを構成する音符（元の入力配列内での相対順序のまま保持）。 */
  notes: Note[];
}

function groupIntoChordUnits(notes: Note[]): ChordUnit[] {
  const units: ChordUnit[] = [];
  for (const note of notes) {
    if (note.isChord && units.length > 0) {
      units[units.length - 1].notes.push(note);
    } else {
      units.push({ notes: [note] });
    }
  }
  return units;
}

/** 1..5の指からサイズkの昇順の組み合わせ（C(5,k)）を列挙する。 */
function generateCombinations(k: number): Finger[][] {
  const result: Finger[][] = [];
  const combo: Finger[] = [];

  function backtrack(start: number): void {
    if (combo.length === k) {
      result.push([...combo]);
      return;
    }
    for (let f = start; f <= 5; f++) {
      combo.push(f as Finger);
      backtrack(f + 1);
      combo.pop();
    }
  }

  backtrack(1);
  return result;
}

const combinationsCache = new Map<number, Finger[][]>();

function getCombinations(k: number): Finger[][] {
  const cached = combinationsCache.get(k);
  if (cached) return cached;
  const combos = generateCombinations(k);
  combinationsCache.set(k, combos);
  return combos;
}

interface NoteFingerPair {
  finger: Finger;
  note: Note;
}

interface PreparedUnit {
  /** ピッチ昇順にソートした構成音のうち、DPの対象になる先頭MAX_UNIT_SIZE件。 */
  primary: Note[];
  /** MAX_UNIT_SIZEを超えた場合の残り（ピッチが最も高い側）。稀な入力のフォールバック対象。 */
  overflow: Note[];
  /** primary.lengthに対応するC(5,k)の組み合わせ一覧。 */
  combos: Finger[][];
}

function prepareUnit(unit: ChordUnit): PreparedUnit {
  const sortedByPitch = [...unit.notes].sort((a, b) => a.midiNumber - b.midiNumber);
  const k = Math.min(sortedByPitch.length, MAX_UNIT_SIZE);
  return {
    primary: sortedByPitch.slice(0, k),
    overflow: sortedByPitch.slice(k),
    combos: getCombinations(k),
  };
}

/**
 * 組み合わせ（昇順の指番号配列）を、ピッチ昇順の構成音に割り当てる。
 * 右手: 音高昇順に対して指番号昇順（combo をそのまま使う）。
 * 左手: 音高昇順に対して指番号降順（comboを反転して使う。親指が高音側に来る）。
 */
function toFingerSeq(primary: Note[], combo: Finger[], hand: FingeringHand): NoteFingerPair[] {
  const order = hand === 'right' ? combo : [...combo].reverse();
  return primary.map((note, i) => ({ finger: order[i], note }));
}

/**
 * ユニット内コスト（和音の構成音同士の物理的な整合性チェック＋各構成音の静的コスト）。
 *
 * - 各構成音について weakFingerCost / thumbOnBlackCost / fiveOnBlackCost を加算する
 *   （どのユニットに属する音であっても、静的コストはここで一度だけ計上する）。
 * - ユニット内が2音以上の場合、ピッチ順で隣接するペアと、3音以上のときは端点ペア
 *   （最低音・最高音）についてSPAN_TABLEで実行可能性をチェックする。
 *   物理的なスパン上限（max）を超える組み合わせはInfinityとし、DPの選択肢から排除する。
 *   comfortable超・max以内の場合は超過分をコストとして加算する。
 */
function unitInternalCost(
  fingerSeq: NoteFingerPair[],
  hand: FingeringHand,
  settings: HandSettings
): number {
  let cost = 0;
  for (const { finger, note } of fingerSeq) {
    cost += weakFingerCost(finger) + thumbOnBlackCost(finger, note) + fiveOnBlackCost(finger, note);
  }

  const k = fingerSeq.length;
  if (k < 2) return cost;

  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < k - 1; i++) pairs.push([i, i + 1]);
  // 3音以上のときは、隣接ペアだけでは捉えきれない全体スパン（端点ペア）も確認する。
  if (k >= 3) pairs.push([0, k - 1]);

  for (const [a, b] of pairs) {
    const fa = fingerSeq[a].finger;
    const fb = fingerSeq[b].finger;
    const na = fingerSeq[a].note;
    const nb = fingerSeq[b].note;

    // combosはC(5,k)（組み合わせ）から生成されるため同一ユニット内で指が重複することはないが、
    // 防御的にチェックしておく（同音高なら同指でも可）。
    if (fa === fb) {
      if (na.midiNumber === nb.midiNumber) continue;
      return Infinity;
    }

    const span = Math.abs(nb.midiNumber - na.midiNumber);
    const { comfortable, max } = getSpan(fa, fb, hand, settings);
    if (span > max) return Infinity;
    if (span > comfortable) cost += span - comfortable;
  }

  return cost;
}

/**
 * `unitInternalCost` の緩和版（必ず有限値を返す）。
 * 全組み合わせがInfinityになる「物理的に演奏不可能な和音」（例: 片手で2オクターブ超）
 * でも、最も妥協的な指割当を選んで運指を出力し続けるために使う。
 * Infinityの代わりに、スパン超過分・同一指重複へ大きな有限ペナルティを課す。
 */
function unitInternalCostRelaxed(
  fingerSeq: NoteFingerPair[],
  hand: FingeringHand,
  settings: HandSettings
): number {
  let cost = 0;
  for (const { finger, note } of fingerSeq) {
    cost += weakFingerCost(finger) + thumbOnBlackCost(finger, note) + fiveOnBlackCost(finger, note);
  }

  const k = fingerSeq.length;
  if (k < 2) return cost;

  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < k - 1; i++) pairs.push([i, i + 1]);
  if (k >= 3) pairs.push([0, k - 1]);

  for (const [a, b] of pairs) {
    const fa = fingerSeq[a].finger;
    const fb = fingerSeq[b].finger;
    const na = fingerSeq[a].note;
    const nb = fingerSeq[b].note;

    if (fa === fb) {
      if (na.midiNumber !== nb.midiNumber) cost += SAME_FINGER_UNIT_PENALTY;
      continue;
    }

    const span = Math.abs(nb.midiNumber - na.midiNumber);
    const { comfortable, max } = getSpan(fa, fb, hand, settings);
    if (span > max) {
      cost += max - comfortable + (span - max) * INFEASIBLE_SPAN_PENALTY_PER_SEMITONE;
    } else if (span > comfortable) {
      cost += span - comfortable;
    }
  }

  return cost;
}

/**
 * ユニット間（時間的に連続する2つのコードユニット）の移動コスト。
 *
 * 既存の `totalTransitionCost`（cost-functions.ts）は「遷移先の指の静的コスト
 * （weakFingerCost/thumbOnBlackCost/fiveOnBlackCost）」を含めて計算するが、
 * 本モジュールでは静的コストを `unitInternalCost` 側でユニット内の全構成音に対して
 * 一度だけ計上する（和音の全構成音を漏れなく評価するため）。そのため、ここでは
 * `totalTransitionCost` を構成する既存のコスト関数のうち、純粋に「動き」に関わる
 * 部分（spanCost・thumbPassingCost・largeJumpCost）のみを合算し、静的コストの
 * 二重計上を避ける。
 *
 * 単音ユニット同士（k=1）の遷移では、
 *   unitInternalCost(現在ユニット) の静的コスト + このunitTransitionMotionCost
 *   === totalTransitionCost(f1, f2, n1, n2, hand, settings)
 * と厳密に一致する（両者を合算した式を展開すると、spanCost + weakFingerCost(f2) +
 * thumbOnBlackCost(f2, n2) + fiveOnBlackCost(f2, n2) + thumbPassingCost + largeJumpCost
 * となり totalTransitionCost の定義そのものになる）。これにより、単旋律入力での
 * 既存dp-solver.test.tsの結果・コストと完全に一致する（回帰テストで担保）。
 *
 * 代表ペアの取り方: ユニット内の構成音をピッチ昇順に並べたときの対応する順位同士
 * （例: 前ユニットの最低音と現ユニットの最低音、2番目に低い音同士…）をmin(前ユニットの
 * 構成音数, 現ユニットの構成音数)件だけ比較する「隣接する構成音同士」を代表ペアとする。
 * 構成音数が異なる場合、対応しきれない超過分の構成音は、ここでの遷移コストの対象外とする
 * （それらの構成音自身の静的コスト・和音内スパン制約はunitInternalCost側で既に評価済みのため、
 * 情報が完全に失われるわけではない）。
 */
function unitTransitionMotionCost(
  prevSeq: NoteFingerPair[],
  curSeq: NoteFingerPair[],
  hand: FingeringHand,
  settings: HandSettings
): number {
  const pairCount = Math.min(prevSeq.length, curSeq.length);
  let cost = 0;
  for (let i = 0; i < pairCount; i++) {
    const { finger: f1, note: n1 } = prevSeq[i];
    const { finger: f2, note: n2 } = curSeq[i];
    cost +=
      spanCost(f1, f2, n1, n2, hand, settings) +
      thumbPassingCost(f1, f2, n1, n2) +
      largeJumpCost(n1, n2);
  }
  return cost;
}

/**
 * MAX_UNIT_SIZEを超えた構成音（overflow）に指を割り当てるフォールバック。
 * 片手6音以上の同時発音は物理的に演奏不可能なため、正しい解は存在しない。
 * ここでは「UIに欠落を出さない」ことを優先し、最も近いピッチのDP割当済みの指
 * （primaryの最高音に割り当てられた指）を再利用し、固定ペナルティを加算する。
 */
function assignOverflowFingers(unit: PreparedUnit, chosenSeq: NoteFingerPair[]): NoteFingerPair[] {
  if (unit.overflow.length === 0) return [];
  const fallbackFinger: Finger = chosenSeq[chosenSeq.length - 1]?.finger ?? 5;
  return unit.overflow.map((note) => ({ finger: fallbackFinger, note }));
}

interface UnitDPCell {
  cost: number;
  prevIndex: number | null;
}

export function computeFingering(
  notes: Note[],
  hand: FingeringHand,
  settings: HandSettings,
  onProgress?: (progress: number) => void,
  deadline?: number
): FingeringResult {
  const n = notes.length;
  if (n === 0) return { assignments: [], totalCost: 0 };

  const units = groupIntoChordUnits(notes);

  // REQ-009-A06 / TASK-050: スケール・アルペジオの定型運指パターンは単旋律
  // （全ユニットがサイズ1）のときのみDPより優先して適用する。和音が1つでも
  // 含まれる場合は定型パターンを誤適用せず、常にDP（コードユニットDP）にフォールバックする。
  const allSingleNoteUnits = units.every((u) => u.notes.length === 1);
  if (allSingleNoteUnits) {
    const scalePatternAssignments = applyScalePattern(notes, hand);
    if (scalePatternAssignments) {
      onProgress?.(1.0);
      return { assignments: scalePatternAssignments, totalCost: 0 };
    }
  }

  return computeChordUnitDP(notes, units, hand, settings, onProgress, deadline);
}

function computeChordUnitDP(
  notes: Note[],
  units: ChordUnit[],
  hand: FingeringHand,
  settings: HandSettings,
  onProgress?: (progress: number) => void,
  deadline?: number
): FingeringResult {
  const prepared = units.map(prepareUnit);
  const unitCount = prepared.length;

  // fingerSeqCache[u][comboIndex] = そのユニットのcombosCache[u][comboIndex]をpitch順に割り当てた結果
  const fingerSeqCache: NoteFingerPair[][][] = prepared.map((p) =>
    p.combos.map((combo) => toFingerSeq(p.primary, combo, hand))
  );

  const dp: UnitDPCell[][] = new Array(unitCount);
  dp[0] = fingerSeqCache[0].map((seq) => ({
    cost: unitInternalCost(seq, hand, settings),
    prevIndex: null,
  }));
  // 曲頭が「物理的に演奏不可能な和音」（全comboがInfinity）の場合は緩和コストで開始する
  // （2026-07-05 実機フィードバック: 連鎖断絶によるバックトラック破綻の防止）。
  if (dp[0].every((c) => c.cost === Infinity)) {
    dp[0] = fingerSeqCache[0].map((seq) => ({
      cost: unitInternalCostRelaxed(seq, hand, settings),
      prevIndex: null,
    }));
  }

  for (let u = 1; u < unitCount; u++) {
    // Check for timeout (every 100 unit-iterations to avoid excessive Date.now() calls).
    // TASK-050: 従来は音符単位(i)だった判定を、コードユニット単位(u)に読み替えて流用する。
    if (deadline && u % 100 === 0 && Date.now() > deadline) {
      onProgress?.(u / unitCount);
      return backtrackChordUnits(notes, prepared, fingerSeqCache, dp, u - 1);
    }

    const curCombos = fingerSeqCache[u];
    const internals = curCombos.map((seq) => unitInternalCost(seq, hand, settings));
    dp[u] = curCombos.map(() => ({ cost: Infinity, prevIndex: null }));

    for (let ci = 0; ci < curCombos.length; ci++) {
      const curInternal = internals[ci];
      if (curInternal === Infinity) continue;
      const curSeq = curCombos[ci];

      for (let pi = 0; pi < dp[u - 1].length; pi++) {
        if (dp[u - 1][pi].cost === Infinity) continue;
        const prevSeq = fingerSeqCache[u - 1][pi];
        const motion = unitTransitionMotionCost(prevSeq, curSeq, hand, settings);
        const total = dp[u - 1][pi].cost + motion + curInternal;
        if (total < dp[u][ci].cost) {
          dp[u][ci] = { cost: total, prevIndex: pi };
        }
      }
    }

    // 連鎖断絶時のリスタート: このユニットで全comboがInfinityのままの場合
    // （ユニット自体が演奏不可能、または全遷移が同一指衝突等でInfinity。
    // 例: 5音和音→別の5音和音は指列が[1..5]固定のため必ず全遷移がInfinityになる）、
    // 直前ユニットの最良セルからCHAIN_BREAK_PENALTYを課してチェーンを繋ぎ直す。
    // これによりバックトラックのprevIndex連鎖が途切れず、運指が必ず出力される。
    if (dp[u].every((c) => c.cost === Infinity)) {
      let bestPrevIdx = 0;
      let bestPrevCost = Infinity;
      for (let pi = 0; pi < dp[u - 1].length; pi++) {
        if (dp[u - 1][pi].cost < bestPrevCost) {
          bestPrevCost = dp[u - 1][pi].cost;
          bestPrevIdx = pi;
        }
      }
      const base = Number.isFinite(bestPrevCost) ? bestPrevCost : 0;
      const hasPrev = dp[u - 1].length > 0 && Number.isFinite(bestPrevCost);
      dp[u] = curCombos.map((seq, ci) => ({
        cost:
          base +
          CHAIN_BREAK_PENALTY +
          (Number.isFinite(internals[ci])
            ? internals[ci]
            : unitInternalCostRelaxed(seq, hand, settings)),
        prevIndex: hasPrev ? bestPrevIdx : null,
      }));
    }

    if (u % 10 === 0) onProgress?.(u / unitCount);
  }

  onProgress?.(1.0);
  return backtrackChordUnits(notes, prepared, fingerSeqCache, dp, unitCount - 1);
}

function backtrackChordUnits(
  notes: Note[],
  prepared: PreparedUnit[],
  fingerSeqCache: NoteFingerPair[][][],
  dp: UnitDPCell[][],
  lastUnitIndex: number
): FingeringResult {
  let bestIndex = 0;
  let minCost = Infinity;
  for (let ci = 0; ci < dp[lastUnitIndex].length; ci++) {
    if (dp[lastUnitIndex][ci].cost < minCost) {
      minCost = dp[lastUnitIndex][ci].cost;
      bestIndex = ci;
    }
  }

  const assignmentByNoteId = new Map<string, FingerAssignment>();
  let comboIndex: number | null = bestIndex;
  for (let u = lastUnitIndex; u >= 0; u--) {
    // 防御ガード: 連鎖断絶リスタート機構により通常ここには到達しないが、
    // 万一prevIndexの連鎖が切れていた場合はクラッシュせず部分結果を返す。
    const cell = comboIndex !== null ? dp[u]?.[comboIndex] : undefined;
    if (!cell) break;
    const cumulativeCost = cell.cost;
    const seq = fingerSeqCache[u][comboIndex!];
    for (const { finger, note } of seq) {
      assignmentByNoteId.set(note.id, { noteId: note.id, finger, cost: cumulativeCost });
    }
    for (const { finger, note } of assignOverflowFingers(prepared[u], seq)) {
      assignmentByNoteId.set(note.id, {
        noteId: note.id,
        finger,
        cost: cumulativeCost + OVERFLOW_PENALTY,
      });
    }
    comboIndex = cell.prevIndex;
  }

  // 出力順は元のnotes配列の順序を保つ（単旋律の既存実装と同じ並びにする）。
  // deadline到達による部分結果の場合、assignmentByNoteIdには計算済みユニット分の
  // noteIdしか登録されていないため、未計算の音符は自然に除外される。
  const assignments: FingerAssignment[] = [];
  for (const note of notes) {
    const assignment = assignmentByNoteId.get(note.id);
    if (assignment) assignments.push(assignment);
  }

  return { assignments, totalCost: minCost };
}
