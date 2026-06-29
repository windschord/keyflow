import type { StoreApi } from 'zustand';
import { PracticeStore } from '../../store';
import { MidiNoteEvent, NoteJudgement, Note } from '../../types';
import { filterNotesByMode, judgeChord } from './judgement';
import { checkLoopBoundary } from './loop-manager';

export class PracticeEngineService {
  private store: StoreApi<PracticeStore>;

  constructor(store: StoreApi<PracticeStore>) {
    this.store = store;
  }

  handleNoteOn(event: MidiNoteEvent): NoteJudgement {
    const state = this.store.getState();
    const { practiceMode, errorMode, expectedNotes, pressedKeys, incorrectKeys, stats } = state;
    const nextPressedKeys = new Set(pressedKeys);
    const nextIncorrectKeys = new Set(incorrectKeys);
    const nextStats = { ...stats };

    // Add to pressed keys
    nextPressedKeys.add(event.midiNumber);

    if (expectedNotes.length === 0) {
      // Nothing to practice right now (maybe a rest or end of score)
      this.store.setState({ pressedKeys: nextPressedKeys });
      return { result: 'ignored', note: null, advanced: false };
    }

    const filteredExpected = filterNotesByMode(
      expectedNotes,
      practiceMode,
      state.score?.parts || []
    );

    if (filteredExpected.length === 0) {
      // Skipped due to practice mode (e.g. left hand notes while right hand mode)
      this.store.setState({ pressedKeys: nextPressedKeys });
      this.advancePosition();
      return { result: 'ignored', note: null, advanced: true };
    }

    const isExpected = filteredExpected.some((n) => n.midiNumber === event.midiNumber);

    let advanced = false;
    let result: 'correct' | 'incorrect' = 'incorrect';

    if (isExpected) {
      // It's part of the expected notes. Check if the whole chord is pressed.
      const chordStatus = judgeChord(nextPressedKeys, filteredExpected);

      if (chordStatus === 'correct') {
        result = 'correct';
        nextStats.correctNotes += 1;
        advanced = true;
      } else {
        // Partial chord, do nothing yet
        result = 'correct'; // But don't advance
      }
    } else {
      result = 'incorrect';
      nextIncorrectKeys.add(event.midiNumber);
      nextStats.incorrectNotes += 1;

      if (errorMode === 'pass') {
        advanced = true;
      }
    }

    nextStats.totalNotes = nextStats.correctNotes + nextStats.incorrectNotes;
    nextStats.accuracy =
      nextStats.totalNotes > 0 ? nextStats.correctNotes / nextStats.totalNotes : 0;

    // Update state
    this.store.setState({
      pressedKeys: nextPressedKeys,
      incorrectKeys: nextIncorrectKeys,
      stats: nextStats,
    });

    if (advanced) {
      this.advancePosition();
    }

    return { result, note: filteredExpected[0] || null, advanced };
  }

  handleNoteOff(event: MidiNoteEvent): void {
    const { pressedKeys, incorrectKeys } = this.store.getState();
    const nextPressedKeys = new Set(pressedKeys);
    const nextIncorrectKeys = new Set(incorrectKeys);
    nextPressedKeys.delete(event.midiNumber);
    nextIncorrectKeys.delete(event.midiNumber);
    this.store.setState({ pressedKeys: nextPressedKeys, incorrectKeys: nextIncorrectKeys });
  }

  advancePosition(): void {
    const state = this.store.getState();
    if (!state.score) return;

    let { currentMeasure, currentNoteIndex } = state;
    const measures = state.score.measures;

    const measure = measures.find((m) => m.number === currentMeasure);
    if (!measure) return;

    // Move to next logical note group
    currentNoteIndex++;
    while (currentNoteIndex < measure.notes.length && measure.notes[currentNoteIndex].isChord) {
      currentNoteIndex++;
    }

    // Check if we reached the end of the measure
    // In a real app we'd group chords. Let's assume notes are grouped properly or we find the next unique start time.
    // For simplicity of this task, let's just bounds check against notes array length.
    // In true MusicXML we group by time.

    // Simplification for the test:
    if (currentNoteIndex >= measure.notes.length) {
      currentMeasure++;
      currentNoteIndex = 0;

      // Loop check
      currentMeasure = checkLoopBoundary(
        currentMeasure,
        state.loopStart,
        state.loopEnd,
        state.loopEnabled
      );
    }

    // Clear stale note state when advancing to prevent carrying incorrect keys to next step
    this.store.setState({
      currentMeasure,
      currentNoteIndex,
      pressedKeys: new Set(),
      incorrectKeys: new Set(),
    });

    this.updateExpectedNotes();
  }

  resetToMeasure(measureNumber: number): void {
    this.store.setState({
      currentMeasure: measureNumber,
      currentNoteIndex: 0,
      pressedKeys: new Set(),
      incorrectKeys: new Set(),
    });
    this.updateExpectedNotes();
  }

  setLoop(start: number, end: number): void {
    this.store.getState().setLoopRange(start, end);
  }

  clearLoop(): void {
    if (this.store.getState().loopEnabled) {
      this.store.getState().toggleLoop();
    }
  }

  private updateExpectedNotes(): void {
    const state = this.store.getState();
    if (!state.score) {
      this.store.setState({ expectedNotes: [] });
      return;
    }

    let currentMeasure = state.currentMeasure;
    let currentNoteIndex = state.currentNoteIndex;
    const maxIterations =
      state.score.measures.reduce((total, measure) => total + measure.notes.length + 1, 0) + 1;

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const measure = state.score.measures.find((m) => m.number === currentMeasure);
      if (!measure || !measure.notes || measure.notes.length === 0) {
        this.store.setState({ currentMeasure, currentNoteIndex, expectedNotes: [] });
        return;
      }

      if (currentNoteIndex >= measure.notes.length) {
        currentMeasure++;
        currentNoteIndex = 0;
        currentMeasure = checkLoopBoundary(
          currentMeasure,
          state.loopStart,
          state.loopEnd,
          state.loopEnabled
        );
        continue;
      }

      const expected: Note[] = [];
      const firstNote = measure.notes[currentNoteIndex];
      if (firstNote && !firstNote.isRest) {
        expected.push(firstNote);
      }

      let nextIndex = currentNoteIndex + 1;
      for (; nextIndex < measure.notes.length; nextIndex++) {
        const note = measure.notes[nextIndex];
        if (note.isChord) {
          if (!note.isRest) {
            expected.push(note);
          }
        } else {
          break;
        }
      }

      const filteredExpected = filterNotesByMode(
        expected,
        state.practiceMode,
        state.score?.parts || []
      );
      if (filteredExpected.length > 0) {
        this.store.setState({
          currentMeasure,
          currentNoteIndex,
          expectedNotes: filteredExpected,
        });
        return;
      }

      currentNoteIndex = nextIndex;
    }

    this.store.setState({ currentMeasure, currentNoteIndex, expectedNotes: [] });
  }
}
