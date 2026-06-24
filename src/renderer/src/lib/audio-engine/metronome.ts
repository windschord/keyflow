import * as Tone from 'tone';

export class Metronome {
  private synth: Tone.MembraneSynth;
  private sequence: Tone.Sequence | null = null;
  private isEnabled: boolean = false;

  constructor() {
    this.synth = new Tone.MembraneSynth().toDestination();
  }

  public setEnabled(enabled: boolean): void {
    if (this.isEnabled === enabled) return;
    this.isEnabled = enabled;

    if (enabled) {
      if (!this.sequence) {
        this.sequence = new Tone.Sequence(
          (time, note) => {
            this.synth.triggerAttackRelease(note, '0.1', time);
          },
          ['C4', 'C3', 'C3', 'C3'],
          '4n'
        );
      }
      this.sequence.start(0);
    } else {
      if (this.sequence) {
        this.sequence.stop();
      }
    }
  }

  public dispose(): void {
    if (this.sequence) {
      this.sequence.dispose();
      this.sequence = null;
    }
    this.synth.dispose();
  }
}
