import * as Tone from 'tone';
import { Score, Hand } from '../../types';
import { Metronome } from './metronome';

export class AudioEngineService {
  private accompanimentSynth: Tone.PolySynth;
  private clickSynth: Tone.Synth;
  private playSynth: Tone.PolySynth;
  private metronome: Metronome;

  private accompanimentPart: Tone.Part | null = null;

  constructor() {
    this.accompanimentSynth = new Tone.PolySynth(Tone.Synth).toDestination();
    this.clickSynth = new Tone.Synth().toDestination();
    this.playSynth = new Tone.PolySynth(Tone.Synth).toDestination();
    this.metronome = new Metronome();
  }

  setBpm(bpm: number): void {
    Tone.getTransport().bpm.value = bpm;
  }

  setMetronomeEnabled(enabled: boolean): void {
    this.metronome.setEnabled(enabled);
  }

  async loadAccompaniment(score: Score, accompanimentHand: Hand): Promise<void> {
    if (this.accompanimentPart) {
      this.accompanimentPart.dispose();
      this.accompanimentPart = null;
    }

    const secondsPerQuarterNote = 60 / score.tempo;
    const quarterNotesPerMeasure = score.timeSignature.beats * (4 / score.timeSignature.beatType);
    const events: { time: number; note: string; duration: number }[] = [];

    // Convert accompaniment hand string to actual hand filter for parts
    let targetHand: 'left' | 'right' | 'both' = 'both';
    if (accompanimentHand === 'right') targetHand = 'right';
    if (accompanimentHand === 'left') targetHand = 'left';

    const targetPartIds = new Set(
      score.parts.filter((p) => targetHand === 'both' || p.hand === targetHand).map((p) => p.id)
    );

    score.measures.forEach((measure, measureIndex) => {
      const measureStartQuarterNotes = measureIndex * quarterNotesPerMeasure;
      let localQuarterNotes = 0;
      let currentGroupStartQuarterNotes = measureStartQuarterNotes;

      measure.notes.forEach((note) => {
        const durationInQuarterNotes = Math.max(note.duration / score.timeSignature.beatType, 0);
        if (!note.isChord) {
          currentGroupStartQuarterNotes = measureStartQuarterNotes + localQuarterNotes;
        }

        if (!note.isRest && targetPartIds.has(note.partId)) {
          events.push({
            time: currentGroupStartQuarterNotes * secondsPerQuarterNote,
            note: Tone.Frequency(note.midiNumber, 'midi').toNote(),
            duration: durationInQuarterNotes * secondsPerQuarterNote,
          });
        }

        if (!note.isChord) {
          localQuarterNotes += durationInQuarterNotes;
        }
      });
    });

    if (events.length > 0) {
      this.accompanimentPart = new Tone.Part((time, value) => {
        this.accompanimentSynth.triggerAttackRelease(value.note, value.duration, time);
      }, events).start(0);
    }
  }

  playAccompaniment(): void {
    Tone.getTransport().start();
  }

  stopAccompaniment(): void {
    Tone.getTransport().stop();
  }

  pauseAccompaniment(): void {
    Tone.getTransport().pause();
  }

  playCorrectSound(): void {
    this.clickSynth.triggerAttackRelease('C6', '16n');
  }

  playIncorrectSound(): void {
    this.clickSynth.triggerAttackRelease('C3', '16n');
  }

  playNote(midiNumber: number, duration: string = '8n'): void {
    const note = Tone.Frequency(midiNumber, 'midi').toNote();
    this.playSynth.triggerAttackRelease(note, duration);
  }

  dispose(): void {
    this.stopAccompaniment();
    this.metronome.dispose();
    this.accompanimentSynth.dispose();
    this.clickSynth.dispose();
    this.playSynth.dispose();
    if (this.accompanimentPart) {
      this.accompanimentPart.dispose();
    }
  }
}
