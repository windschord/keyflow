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
      // Transportの起動/停止は再生コントロール（play/pause/stop）のみの責務とする
      // （TASK-042）。ここでは Tone.Sequence.start(0) でスケジュールするのみとし、
      // Transportが動いている間だけクリックが鳴る（再生に追従する）設計とする。
      this.sequence.start(0);
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
