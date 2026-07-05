import { PracticeStore } from '../../store';
import { MidiNoteEvent, NoteJudgement, Measure, PracticeMode } from '../../types';
import { judgeChord } from './judgement';
import { checkLoopBoundary } from './loop-manager';
import { getGroupsForNotes, filterNotesByPracticeMode } from './note-grouping';

import { StoreApi } from 'zustand';

/**
 * 判定グループ単位の位置解決結果。
 *
 * `found: false` は、スコア末尾に到達した（あるいはフィルタ後に
 * 演奏可能なグループが見つからなかった）ことを示す。この場合
 * `measure`/`groupIndex` は探索を終えた最終地点を表す。
 */
interface ResolvedPosition {
  measure: number;
  groupIndex: number;
  loopJumped: boolean;
  found: boolean;
}

export class PracticeEngineService {
  private store: StoreApi<PracticeStore>;

  constructor(store: StoreApi<PracticeStore>) {
    this.store = store;
  }

  handleNoteOn(event: MidiNoteEvent): NoteJudgement {
    const state = this.store.getState();

    // REQ-010-007: 曲の再生中はMIDI正誤判定を一時停止する。押鍵状態・統計には
    // 一切触れず、判定なし（ignored）として扱う。停止/一時停止後に判定が再開される。
    if (state.playbackState === 'playing') {
      return { result: 'ignored', note: null, advanced: false };
    }

    const { practiceMode, errorMode, expectedNotes, pressedKeys, incorrectKeys } = state;
    // stats: state.stats を直接インプレース変更すると、それがストア初期値のモジュール定数
    // (practice-slice.tsのinitialStats)への参照だった場合に定数自体を汚染してしまう
    // (CodeRabbit指摘)。読み取り専用のコピーを起点に、更新のたびに新しいオブジェクトを
    // 生成する（`+=`のようなインプレース変更は行わない）。
    let stats = { ...state.stats };

    // Add to pressed keys
    pressedKeys.add(event.midiNumber);

    if (expectedNotes.length === 0) {
      // Nothing to practice right now (maybe a rest or end of score)
      return { result: 'ignored', note: null, advanced: false };
    }

    const filteredExpected = filterNotesByPracticeMode(expectedNotes, practiceMode);

    if (filteredExpected.length === 0) {
      // Skipped due to practice mode (e.g. left hand notes while right hand mode).
      // In the normal flow this should already have been skipped proactively by
      // advancePosition()/resetToMeasure(), but this branch is kept as a defensive
      // fallback (e.g. when expectedNotes is set directly, as in some tests).
      this.advancePosition();
      return { result: 'ignored', note: null, advanced: true };
    }

    const isExpected = filteredExpected.some((n) => n.midiNumber === event.midiNumber);

    let advanced = false;
    let result: 'correct' | 'incorrect' = 'incorrect';

    if (isExpected) {
      // It's part of the expected notes. Check if the whole chord/group is pressed.
      const chordStatus = judgeChord(pressedKeys, filteredExpected);

      if (chordStatus === 'correct') {
        result = 'correct';
        stats = {
          ...stats,
          correctNotes: stats.correctNotes + 1,
          consecutiveCorrect: stats.consecutiveCorrect + 1,
        };
        this.advancePosition();
        advanced = true;
      } else if (chordStatus === 'partial') {
        // Partial chord, do nothing yet
        result = 'correct'; // But don't advance
      } else {
        result = 'incorrect';
        const expectedMidiNumbers = new Set(filteredExpected.map((note) => note.midiNumber));
        for (const key of pressedKeys) {
          if (!expectedMidiNumbers.has(key)) {
            incorrectKeys.add(key);
          }
        }
        stats = { ...stats, incorrectNotes: stats.incorrectNotes + 1, consecutiveCorrect: 0 };
      }
    } else {
      result = 'incorrect';
      incorrectKeys.add(event.midiNumber);
      stats = { ...stats, incorrectNotes: stats.incorrectNotes + 1, consecutiveCorrect: 0 };

      if (errorMode === 'pass') {
        this.advancePosition();
        advanced = true;
      }
    }

    stats = {
      ...stats,
      totalNotes: stats.correctNotes + stats.incorrectNotes,
      accuracy: stats.correctNotes + stats.incorrectNotes > 0
        ? stats.correctNotes / (stats.correctNotes + stats.incorrectNotes)
        : 0,
    };

    // Re-read pressedKeys/incorrectKeys from the store rather than relying on the
    // local variables captured above: advancePosition() may have replaced them with
    // fresh (cleared) Set instances when a loop boundary/measure jump occurred, and
    // we must not clobber that reset with the stale pre-advance references.
    const latest = this.store.getState();
    this.store.setState({
      pressedKeys: new Set(latest.pressedKeys),
      incorrectKeys: new Set(latest.incorrectKeys),
      stats,
    });

    return { result, note: filteredExpected[0] || null, advanced };
  }

  handleNoteOff(event: MidiNoteEvent): void {
    const { pressedKeys, incorrectKeys } = this.store.getState();
    pressedKeys.delete(event.midiNumber);
    incorrectKeys.delete(event.midiNumber);
    this.store.setState({
      pressedKeys: new Set(pressedKeys),
      incorrectKeys: new Set(incorrectKeys),
    });
  }

  advancePosition(): void {
    const state = this.store.getState();
    if (!state.score) return;

    const { currentMeasure, currentNoteIndex } = state;

    const resolved = this.resolvePosition(
      state.score.measures,
      state.practiceMode,
      state.loopStart,
      state.loopEnd,
      state.loopEnabled,
      currentMeasure,
      currentNoteIndex + 1
    );

    this.applyResolvedPosition(resolved);
    this.updateExpectedNotes();
  }

  /**
   * 指定小節の先頭（判定グループindex 0）へカーソルを移動する。
   * `resetToPosition(measureNumber, 0)` の薄いラッパー（TASK-051でresetToPositionへ処理を統合）。
   */
  resetToMeasure(measureNumber: number): void {
    this.resetToPosition(measureNumber, 0);
  }

  /**
   * 指定した小節・判定グループindexへカーソルを移動する（TASK-051: 音単位カーソル移動、
   * REQ-002-004）。楽譜上の音符クリックが解決した判定グループへそのまま移動する用途を想定し、
   * `resetToMeasure` と同様に `resolvePosition` で練習モードフィルタ後に空となるグループを
   * 自動的にスキップし、押鍵状態（pressedKeys/incorrectKeys）をリセットする。
   */
  resetToPosition(measureNumber: number, groupIndex: number): void {
    const state = this.store.getState();

    if (!state.score) {
      this.store.setState({
        currentMeasure: measureNumber,
        currentNoteIndex: groupIndex,
        pressedKeys: new Set(),
        incorrectKeys: new Set(),
      });
      this.updateExpectedNotes();
      return;
    }

    const resolved = this.resolvePosition(
      state.score.measures,
      state.practiceMode,
      state.loopStart,
      state.loopEnd,
      state.loopEnabled,
      measureNumber,
      groupIndex
    );

    this.store.setState({
      currentMeasure: resolved.measure,
      currentNoteIndex: resolved.groupIndex,
      pressedKeys: new Set(),
      incorrectKeys: new Set(),
    });

    this.updateExpectedNotes();
  }

  /**
   * 現在の判定グループ（store.currentMeasure/currentNoteIndex）の startTick を返す
   * （TASK-051: カーソル位置からの再生、REQ-010-001）。
   *
   * スコア未読み込み、あるいは現在の小節が見つからない場合は `null` を返す
   * （呼び出し側は曲頭からの再生にフォールバックする）。判定グループindexが
   * 範囲外の場合（小節末尾に到達しているが次小節へまだ遷移していない等）は、
   * 小節先頭の `startTick` にフォールバックする。
   */
  getCurrentPositionTick(): number | null {
    const state = this.store.getState();
    if (!state.score) return null;

    const measure = state.score.measures.find((m) => m.number === state.currentMeasure);
    if (!measure) return null;

    const groups = getGroupsForNotes(measure.notes);
    const group = groups[state.currentNoteIndex];
    return group ? group.startTick : measure.startTick;
  }

  /**
   * 再生（お手本演奏）のカーソル連動（REQ-010-005）専用のエントリポイント。
   * audio-engine が判定グループ（同一startTick）ごとに解決した位置
   * （`measureNumber`/`groupIndex`）をそのまま反映する。`resolvePosition` による
   * 練習モードフィルタ・ループ境界の再解決は行わない（再生位置は常に実際の
   * 発音タイミングと一致しているため）。
   */
  advanceToPlaybackPosition(measureNumber: number, groupIndex: number): void {
    this.store.setState({ currentMeasure: measureNumber, currentNoteIndex: groupIndex });
    this.updateExpectedNotes();
  }

  /**
   * `(fromMeasure, fromGroupIndex)` を起点に、練習モードでフィルタしても
   * 空にならない次の判定グループを探索する。
   *
   * - グループ内の全ノーツがフィルタで除外される（空になる）場合は
   *   自動的に次のグループへスキップする（データモデルv2設計書「和音・
   *   両手同時押下の判定仕様」2番）。
   * - 小節内の最後のグループを超えたら次の小節へ進み、ループ範囲が
   *   有効な場合は `checkLoopBoundary` に従いループ先頭へ戻る。
   * - スコア終端に到達し、これ以上演奏可能なグループが見つからない場合は
   *   `found: false` を返す。
   */
  private resolvePosition(
    measures: Measure[],
    practiceMode: PracticeMode,
    loopStart: number,
    loopEnd: number,
    loopEnabled: boolean,
    fromMeasure: number,
    fromGroupIndex: number
  ): ResolvedPosition {
    let measure = fromMeasure;
    let groupIndex = fromGroupIndex;
    let loopJumped = false;

    // Upper bound on iterations to guarantee termination even in pathological
    // cases (e.g. an entire loop range has no notes matching the current
    // practice mode filter).
    const totalGroupSlots = measures.reduce(
      (sum, m) => sum + Math.max(getGroupsForNotes(m.notes).length, 1),
      0
    );
    const maxIterations = totalGroupSlots + measures.length + 1;

    for (let i = 0; i < maxIterations; i++) {
      const measureData = measures.find((m) => m.number === measure);
      if (!measureData) {
        return { measure, groupIndex: 0, loopJumped, found: false };
      }

      const groups = getGroupsForNotes(measureData.notes);

      if (groupIndex >= groups.length) {
        const nextMeasure = measure + 1;
        const loopedMeasure = checkLoopBoundary(nextMeasure, loopStart, loopEnd, loopEnabled);
        if (loopedMeasure !== nextMeasure) {
          loopJumped = true;
        }
        measure = loopedMeasure;
        groupIndex = 0;
        continue;
      }

      const filtered = filterNotesByPracticeMode(groups[groupIndex].notes, practiceMode);
      if (filtered.length === 0) {
        groupIndex += 1;
        continue;
      }

      return { measure, groupIndex, loopJumped, found: true };
    }

    return { measure, groupIndex: 0, loopJumped, found: false };
  }

  private applyResolvedPosition(resolved: ResolvedPosition): void {
    // グループが確定して次の判定グループへ進むたびに、pressedKeys/incorrectKeysを
    // 常にクリアする。ループ境界/小節ジャンプ(loopJumped)の場合だけでなく、通常の
    // グループ確定遷移でもクリアしないと、レガート奏法（前グループの鍵を離さずに
    // 次グループの鍵を押す）で前グループの残留押鍵がjudgeChordに混入し、次グループが
    // 誤ってincorrect判定される(CodeRabbit指摘)。resetToPosition/resetToMeasureも
    // 同様に移動のたびに無条件でクリアしており、本メソッドもそれに合わせる。
    this.store.setState({
      currentMeasure: resolved.measure,
      currentNoteIndex: resolved.groupIndex,
      pressedKeys: new Set(),
      incorrectKeys: new Set(),
    });
  }

  private updateExpectedNotes(): void {
    const state = this.store.getState();
    if (!state.score) {
      this.store.setState({ expectedNotes: [] });
      return;
    }

    const measure = state.score.measures.find((m) => m.number === state.currentMeasure);
    if (!measure || !measure.notes || measure.notes.length === 0) {
      this.store.setState({ expectedNotes: [] });
      return;
    }

    // expectedNotes holds the *unfiltered* judgement group (all notes sharing
    // the current startTick). This is so that the on-screen keyboard guide can
    // show the full picture of both hands (data-model-v2 design doc の
    // 「鍵盤ガイドは現在グループの全ノーツ」). Practice-mode filtering is
    // applied at judgement time in handleNoteOn() via
    // filterNotesByPracticeMode().
    const groups = getGroupsForNotes(measure.notes);
    const currentGroup = groups[state.currentNoteIndex];

    this.store.setState({ expectedNotes: currentGroup ? currentGroup.notes : [] });
  }
}
