import * as Tone from 'tone';
import { Metronome } from './metronome';
import type { Score, Hand, Note } from '../../types/score';

export class AudioEngineService {
  private metronome: Metronome;
  private synth: Tone.PolySynth;
  private correctSynth: Tone.Synth;
  private incorrectSynth: Tone.Synth;
  private accompanimentParts: Tone.Part[] = [];
  private isInitialized: boolean = false;

  constructor() {
    this.metronome = new Metronome();
    this.synth = new Tone.PolySynth(Tone.Synth).toDestination();
    this.correctSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.05, decay: 0.1, sustain: 0.3, release: 1 },
    }).toDestination();
    this.incorrectSynth = new Tone.Synth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.05, decay: 0.2, sustain: 0.2, release: 1 },
    }).toDestination();
  }

  private async initializeTone(): Promise<void> {
    if (!this.isInitialized) {
      await Tone.start();
      this.isInitialized = true;
    }
  }

  public setBpm(bpm: number): void {
    Tone.getTransport().bpm.value = bpm;
  }

  public setMetronomeEnabled(enabled: boolean): void {
    this.metronome.setEnabled(enabled);
  }

  public async loadAccompaniment(score: Score, accompanimentHand: Hand): Promise<void> {
    await this.initializeTone();
    this.clearAccompaniment();

    this.setBpm(score.tempo);

    const timeSignatureBeats = score.timeSignature.beats;
    const timeSignatureType = score.timeSignature.beatType;
    Tone.getTransport().timeSignature = [timeSignatureBeats, timeSignatureType];

    const secondsPerBeat = 60 / score.tempo;
    score.parts.forEach((part) => {
      if (part.hand === accompanimentHand) {
        const events: { time: string; note: string; duration: number }[] = [];
        let currentTimeInSeconds = 0;

        score.measures.forEach((measure) => {
          measure.notes.forEach((note: Note) => {
            if (note.partId === part.id) {
              if (!note.isRest) {
                const freq = Tone.Frequency(note.midiNumber, 'midi').toNote();
                events.push({
                  time: `+${currentTimeInSeconds}`,
                  note: freq,
                  duration: note.duration * secondsPerBeat,
                });
              }
              currentTimeInSeconds += note.duration * secondsPerBeat;
            }
          });
        });

        const tonePart = new Tone.Part((time, value) => {
          this.synth.triggerAttackRelease(value.note, value.duration, time);
        }, events).start(0);

        this.accompanimentParts.push(tonePart);
      }
    });
  }

  public playAccompaniment(): void {
    Tone.getTransport().start();
  }

  public stopAccompaniment(): void {
    Tone.getTransport().stop();
    Tone.getTransport().position = 0;
  }

  public pauseAccompaniment(): void {
    Tone.getTransport().pause();
  }

  public playCorrectSound(): void {
    this.correctSynth.triggerAttackRelease('C5', '8n');
  }

  public playIncorrectSound(): void {
    this.incorrectSynth.triggerAttackRelease('G#3', '8n');
  }

  public playNote(midiNumber: number, duration: string = '8n'): void {
    const note = Tone.Frequency(midiNumber, 'midi').toNote();
    this.synth.triggerAttackRelease(note, duration);
  }

  public dispose(): void {
    this.metronome.dispose();
    this.synth.dispose();
    this.correctSynth.dispose();
    this.incorrectSynth.dispose();
    this.clearAccompaniment();
    Tone.getTransport().stop();
    Tone.getTransport().cancel();
  }

  private clearAccompaniment(): void {
    this.accompanimentParts.forEach((part) => part.dispose());
    this.accompanimentParts = [];
  }
}
