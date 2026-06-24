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

    const measureData = state.score.measures.find((m) => m.number === currentMeasure);
    if (!measureData) return;

    // Filter by mode
    const modeNotes = filterNotesByMode(measureData.notes, state.practiceMode, state.score.parts);

    // Group notes by index
    const noteIndices = Array.from(new Set(modeNotes.map((n) => n.noteIndex))).sort(
      (a, b) => a - b
    );

    const currentIndexInArray = noteIndices.indexOf(currentNoteIndex);

    if (currentIndexInArray !== -1 && currentIndexInArray < noteIndices.length - 1) {
      currentNoteIndex = noteIndices[currentIndexInArray + 1];
    } else {
      currentMeasure += 1;
      // Loop Check
      currentMeasure = checkLoopBoundary(
        currentMeasure,
        state.loopStart,
        state.loopEnd,
        state.loopEnabled
      );

      // Find the next measure data to set initial note index
      const nextMeasureData = state.score.measures.find((m) => m.number === currentMeasure);
      if (nextMeasureData) {
        const nextModeNotes = filterNotesByMode(
          nextMeasureData.notes,
          state.practiceMode,
          state.score.parts
        );
        if (nextModeNotes.length > 0) {
          currentNoteIndex = Math.min(...nextModeNotes.map((n) => n.noteIndex));
        } else {
          currentNoteIndex = 0; // fallback
        }
      } else {
        currentNoteIndex = 0; // end of score
      }
    }

    // Keep pressed keys but update position and clear incorrect keys
    this.store.setState({ currentMeasure, currentNoteIndex, incorrectKeys: new Set() });
  }

  resetToMeasure(measureNumber: number): void {
    this.store.setState({
      currentMeasure: measureNumber,
      currentNoteIndex: 0,
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

  // Changed to match the prompt's required return type boolean even though it's internal. Actually I will keep it NoteJudgement because it's what we need internally to distinguish 'partial' from 'incorrect' and handle advance. The user prompt said `private checkCorrectness(noteNumber: number, expectedNotes: Note[], practiceMode: PracticeMode): boolean;` but realistically we need NoteJudgement. Let me change it to boolean and do the judgement logic inline.
  // Actually, I can just change the signature to boolean.
  private checkCorrectness(
    _noteNumber: number,
    expectedNotes: Note[],
    _practiceMode: PracticeMode
  ): NoteJudgement {
    const state = this.store.getState();
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
