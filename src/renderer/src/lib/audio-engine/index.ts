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

    const events: { time: string; note: string; duration: string }[] = [];

    // Filter parts based on accompanimentHand
    // For now, this is a simplified stub. In a real scenario, we calculate absolute time based on tempo.
    // Here we'll just push simple events as placeholders based on measures and notes.
    let measureIndex = 0;

    // Convert accompaniment hand string to actual hand filter for parts
    let targetHand: 'left' | 'right' | 'both' = 'both';
    if (accompanimentHand === 'right') targetHand = 'right';
    if (accompanimentHand === 'left') targetHand = 'left';

    const targetPartIds = new Set(
      score.parts.filter((p) => targetHand === 'both' || p.hand === targetHand).map((p) => p.id)
    );

    score.measures.forEach((measure) => {
      let currentBeatOffset = 0;
      measure.notes.forEach((note) => {
        if (!note.isRest && targetPartIds.has(note.partId)) {
          events.push({
            time: `${measureIndex}:${Math.floor(currentBeatOffset)}:${(currentBeatOffset % 1) * 4}`, // simplified time scheduling
            note: Tone.Frequency(note.midiNumber, 'midi').toNote(),
            duration: '4n', // simplified duration
          });
        }
        if (!note.isChord) {
          currentBeatOffset += 1; // simple duration increment for stub
        }
      });
      measureIndex++;
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
