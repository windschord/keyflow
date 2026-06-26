import { StoreApi } from 'zustand';
import { PracticeStore } from '../../store';
import { MidiNoteEvent, NoteJudgement, Note, PracticeMode } from '../../types';
import { filterNotesByMode, judgeChord } from './judgement';
import { checkLoopBoundary } from './loop-manager';

export class PracticeEngineService {
  private store: StoreApi<PracticeStore>;

  constructor(store: StoreApi<PracticeStore>) {
    this.store = store;
  }

  handleNoteOn(event: MidiNoteEvent): NoteJudgement {
    const state = this.store.getState();
    const pressedKeys = new Set(state.pressedKeys);
    pressedKeys.add(event.midiNumber);

    // Update pressed keys in store first to ensure judgeChord reads it
    this.store.setState({ pressedKeys });

    const expectedNotes = this.getExpectedNotes();

    if (expectedNotes.length === 0) {
      // Nothing expected, maybe skipped or handled
      return { result: 'ignored', note: null, advanced: false };
    }

    const judgement = this.checkCorrectness(event.midiNumber, expectedNotes, state.practiceMode);

    // Update stats based on note correctness
    if (judgement.result === 'correct') {
      if (judgement.advanced) {
        // Only update stats when we complete a group (like a chord) or single note
        const stats = { ...state.stats };
        stats.correctNotes += 1;
        this.store.setState({ stats });
      }
    } else if (judgement.result === 'incorrect') {
      const stats = { ...state.stats };
      stats.incorrectNotes += 1;

      const incorrectKeys = new Set(state.incorrectKeys);
      incorrectKeys.add(event.midiNumber);

      this.store.setState({ stats, incorrectKeys });
    }

    if (judgement.advanced) {
      this.advancePosition();
    } else if (state.errorMode === 'pass' && judgement.result === 'incorrect') {
      this.advancePosition();
      judgement.advanced = true;
    }

    return judgement;
  }

  handleNoteOff(event: MidiNoteEvent): void {
    const state = this.store.getState();
    const pressedKeys = new Set(state.pressedKeys);
    pressedKeys.delete(event.midiNumber);

    const incorrectKeys = new Set(state.incorrectKeys);
    incorrectKeys.delete(event.midiNumber);

    this.store.setState({ pressedKeys, incorrectKeys });
  }

  advancePosition(): void {
    const state = this.store.getState();
    if (!state.score) return;

    let { currentMeasure, currentNoteIndex } = state;

    // Track visited measures to prevent infinite loops when loop range has no target notes
    const visitedMeasures = new Set<number>();

    // Find next position loop
    while (true) {
      const measureData = state.score.measures.find((m) => m.number === currentMeasure);
      if (!measureData) break; // End of score

      const modeNotes = filterNotesByMode(measureData.notes, state.practiceMode, state.score.parts);
      const noteIndices = Array.from(new Set(modeNotes.map((n) => n.noteIndex))).sort(
        (a, b) => a - b
      );

      const currentIndexInArray = noteIndices.indexOf(currentNoteIndex);

      if (currentIndexInArray !== -1 && currentIndexInArray < noteIndices.length - 1) {
        currentNoteIndex = noteIndices[currentIndexInArray + 1];
        break;
      } else {
        currentMeasure += 1;
        // Loop Check
        currentMeasure = checkLoopBoundary(
          currentMeasure,
          state.loopStart,
          state.loopEnd,
          state.loopEnabled
        );

        // Guard against infinite loops: if we've visited this measure before, stop
        if (visitedMeasures.has(currentMeasure)) {
          // No playable notes found in the loop range, stay at current position
          break;
        }
        visitedMeasures.add(currentMeasure);

        const nextMeasureData = state.score.measures.find((m) => m.number === currentMeasure);
        if (nextMeasureData) {
          const nextModeNotes = filterNotesByMode(
            nextMeasureData.notes,
            state.practiceMode,
            state.score.parts
          );
          if (nextModeNotes.length > 0) {
            currentNoteIndex = Math.min(...nextModeNotes.map((n) => n.noteIndex));
            break;
          } else {
            // Next measure exists but has no target notes, so we need to check next measure
            currentNoteIndex = 0;
            continue;
          }
        } else {
          // End of score
          currentNoteIndex = 0;
          break;
        }
      }
    }

    // Clear pressed keys and incorrect keys when advancing position
    this.store.setState({
      currentMeasure,
      currentNoteIndex,
      pressedKeys: new Set(),
      incorrectKeys: new Set(),
    });
  }

  resetToMeasure(measureNumber: number): void {
    const state = this.store.getState();
    let firstPlayableNoteIndex = 0;

    if (state.score) {
      const measureData = state.score.measures.find((m) => m.number === measureNumber);
      if (measureData) {
        const modeNotes = filterNotesByMode(
          measureData.notes,
          state.practiceMode,
          state.score.parts
        );
        if (modeNotes.length > 0) {
          firstPlayableNoteIndex = Math.min(...modeNotes.map((n) => n.noteIndex));
        }
      }
    }

    this.store.setState({
      currentMeasure: measureNumber,
      currentNoteIndex: firstPlayableNoteIndex,
      pressedKeys: new Set(),
      incorrectKeys: new Set(),
    });
  }

  setLoop(start: number, end: number): void {
    this.store.setState({ loopEnabled: true, loopStart: start, loopEnd: end });
  }

  clearLoop(): void {
    this.store.setState({ loopEnabled: false });
  }

  private getExpectedNotes(): Note[] {
    const state = this.store.getState();
    if (!state.score) return [];

    const measureData = state.score.measures.find((m) => m.number === state.currentMeasure);
    if (!measureData) return [];

    const modeNotes = filterNotesByMode(measureData.notes, state.practiceMode, state.score.parts);
    return modeNotes.filter((n) => n.noteIndex === state.currentNoteIndex);
  }

  private checkCorrectness(
    _noteNumber: number,
    expectedNotes: Note[],
    _practiceMode: PracticeMode
  ): NoteJudgement {
    const latestState = this.store.getState();
    const chordStatus = judgeChord(latestState.pressedKeys, expectedNotes);

    if (chordStatus === 'correct') {
      return { result: 'correct', note: expectedNotes[0], advanced: true };
    } else if (chordStatus === 'partial') {
      return { result: 'correct', note: null, advanced: false };
    } else {
      return { result: 'incorrect', note: null, advanced: false };
    }
  }
}
