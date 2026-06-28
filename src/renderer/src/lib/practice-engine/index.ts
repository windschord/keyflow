import { StoreApi } from 'zustand';
import { PracticeStore } from '../../store';
import { MidiNoteEvent, NoteJudgement, Note, PracticeMode, Part } from '../../types';
import { judgeChord } from './judgement';
import { checkLoopBoundary } from './loop-manager';

export class PracticeEngineService {
  private storeApi: StoreApi<PracticeStore>;

  constructor(storeApi: StoreApi<PracticeStore>) {
    this.storeApi = storeApi;
  }

  handleNoteOn(event: MidiNoteEvent): NoteJudgement {
    const state = this.storeApi.getState();
    const { practiceMode, errorMode, expectedNotes, pressedKeys, incorrectKeys, stats } = state;

    // Add to pressed keys
    pressedKeys.add(event.midiNumber);

    if (expectedNotes.length === 0) {
      // Nothing to practice right now (maybe a rest or end of score)
      return { result: 'ignored', note: null, advanced: false };
    }

    const filteredExpected = this.filterExpectedNotes(
      expectedNotes,
      practiceMode,
      state.score?.parts || []
    );

    if (filteredExpected.length === 0) {
      // Skipped due to practice mode (e.g. left hand notes while right hand mode)
      this.advancePosition();
      return { result: 'ignored', note: null, advanced: true };
    }

    const isExpected = filteredExpected.some((n) => n.midiNumber === event.midiNumber);

    let advanced = false;
    let result: 'correct' | 'incorrect' = 'incorrect';

    if (isExpected) {
      // It's part of the expected notes. Check if the whole chord is pressed.
      const chordStatus = judgeChord(pressedKeys, filteredExpected);

      if (chordStatus === 'correct') {
        result = 'correct';
        stats.correctNotes += 1;
        this.advancePosition();
        advanced = true;
      } else {
        // Partial chord, do nothing yet
        result = 'correct'; // But don't advance
      }
    } else {
      result = 'incorrect';
      incorrectKeys.add(event.midiNumber);
      stats.incorrectNotes += 1;

      if (errorMode === 'pass') {
        this.advancePosition();
        advanced = true;
      }
    }

    stats.totalNotes = stats.correctNotes + stats.incorrectNotes;
    stats.accuracy = stats.totalNotes > 0 ? stats.correctNotes / stats.totalNotes : 0;

    // Update state
    this.storeApi.setState({
      pressedKeys: new Set(pressedKeys),
      incorrectKeys: new Set(incorrectKeys),
      stats: { ...stats },
    });

    return { result, note: filteredExpected[0] || null, advanced };
  }

  handleNoteOff(event: MidiNoteEvent): void {
    const { pressedKeys, incorrectKeys } = this.storeApi.getState();
    pressedKeys.delete(event.midiNumber);
    incorrectKeys.delete(event.midiNumber);

    this.storeApi.setState({
      pressedKeys: new Set(pressedKeys),
      incorrectKeys: new Set(incorrectKeys),
    });
  }

  advancePosition(): void {
    const state = this.storeApi.getState();
    if (!state.score) return;

    let { currentMeasure, currentNoteIndex } = state;
    const measures = state.score.measures;

    const measure = measures.find((m) => m.number === currentMeasure);
    if (!measure) return;

    // Move to next logical note group.
    // Fix: Advance by the size of the chord instead of just 1.
    const expected = this.getExpectedNotesForIndex(measure.notes, currentNoteIndex);
    currentNoteIndex += expected.length;

    // Check if we reached the end of the measure
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

    this.storeApi.setState({
      currentMeasure,
      currentNoteIndex,
    });

    this.updateExpectedNotes();
  }

  resetToMeasure(measureNumber: number): void {
    this.storeApi.setState({
      currentMeasure: measureNumber,
      currentNoteIndex: 0,
      pressedKeys: new Set(),
      incorrectKeys: new Set(),
    });
    this.updateExpectedNotes();
  }

  setLoop(start: number, end: number): void {
    this.storeApi.getState().setLoopRange(start, end);
  }

  clearLoop(): void {
    const state = this.storeApi.getState();
    if (state.loopEnabled) {
      state.toggleLoop();
    }
  }

  private getExpectedNotesForIndex(notes: Note[], startIndex: number): Note[] {
    const expected: Note[] = [];
    if (startIndex >= notes.length) return expected;

    expected.push(notes[startIndex]);
    for (let i = startIndex + 1; i < notes.length; i++) {
      if (notes[i].isChord) {
        expected.push(notes[i]);
      } else {
        break;
      }
    }
    return expected.filter((n) => !!n);
  }

  private updateExpectedNotes(): void {
    const state = this.storeApi.getState();
    if (!state.score) {
      this.storeApi.setState({ expectedNotes: [] });
      return;
    }

    const measure = state.score.measures.find((m) => m.number === state.currentMeasure);
    if (!measure || !measure.notes || measure.notes.length === 0) {
      this.storeApi.setState({ expectedNotes: [] });
      return;
    }

    const expected = this.getExpectedNotesForIndex(measure.notes, state.currentNoteIndex);

    this.storeApi.setState({ expectedNotes: expected });
  }

  private filterExpectedNotes(notes: Note[], practiceMode: PracticeMode, parts: Part[]): Note[] {
    if (practiceMode === 'both') return notes;

    const rightPartIds = new Set(parts.filter((p) => p.hand === 'right').map((p) => p.id));
    const leftPartIds = new Set(parts.filter((p) => p.hand === 'left').map((p) => p.id));

    return notes.filter((note) => {
      if (practiceMode === 'right') return rightPartIds.has(note.partId);
      if (practiceMode === 'left') return leftPartIds.has(note.partId);
      return true;
    });
  }
}
