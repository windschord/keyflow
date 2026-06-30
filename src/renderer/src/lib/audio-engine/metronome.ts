import * as Tone from 'tone';

export class Metronome {
  private synth: Tone.Synth;
  private sequence: Tone.Sequence | null = null;
  private enabled: boolean = false;

  constructor() {
    this.synth = new Tone.Synth().toDestination();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (this.enabled) {
      if (!this.sequence) {
        this.sequence = new Tone.Sequence(
          (time) => {
            this.synth.triggerAttackRelease('C5', '32n', time);
          },
          [null],
          '4n'
        );
      }
      this.sequence.start(0);
      Tone.getTransport().start();
    } else {
      if (this.sequence) {
        this.sequence.stop();
      }
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  dispose(): void {
    if (this.sequence) {
      this.sequence.dispose();
      this.sequence = null;
    }
    this.synth.dispose();
  }
}
