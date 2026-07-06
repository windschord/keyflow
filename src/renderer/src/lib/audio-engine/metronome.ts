import * as Tone from 'tone';

export class Metronome {
  private synth: Tone.Synth;
  private sequence: Tone.Sequence | null = null;
  private enabled: boolean = false;
  private accentEnabled: boolean = true;
  private measureStartTicks: Set<number> = new Set();

  constructor() {
    this.synth = new Tone.Synth().toDestination();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (this.enabled) {
      if (!this.sequence) {
        this.sequence = new Tone.Sequence(
          (time) => {
            // TASK-062: 小節頭tick（Score.measures[].startTick）と、クリック発火時点の
            // Transport tickを照合してアクセントを判定する。getTicksAtTime(time)を使う
            // のは、Tone.jsのスケジューリングがlookahead付きで先行して発火するため、
            // transport.ticks（現在値）では発火予定時刻のtickとずれるからである。
            // 浮動小数の誤差を吸収するためMath.roundで整数化して照合する。
            const ticks = Math.round(Tone.getTransport().getTicksAtTime(time));
            const isAccent = this.accentEnabled && this.measureStartTicks.has(ticks);
            if (isAccent) {
              this.synth.triggerAttackRelease('C6', '32n', time, 1.0);
            } else {
              this.synth.triggerAttackRelease('C5', '32n', time, 0.6);
            }
          },
          // tone@15.1.22のSequenceはnullイベントを休符として扱いコールバックを
          // 呼ばない仕様（Sequence.js:67 _seqCallback）。[null]のままだと
          // クリックが永遠に発火しないため、発火する値（0）を入れる（TASK-061）。
          [0],
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

  /** 一拍目アクセントの有効/無効を設定する（既定true、REQ-006-008）。 */
  setAccentEnabled(enabled: boolean): void {
    this.accentEnabled = enabled;
  }

  /** 小節頭の絶対tick集合を設定する（Score.measures[].startTick由来、REQ-006-008）。 */
  setMeasureStartTicks(ticks: number[]): void {
    this.measureStartTicks = new Set(ticks);
  }

  /**
   * 既存のシーケンスを破棄し、有効時は現在のTransport PPQで再生成する（TASK-064）。
   * tone@15.1.22のSequenceは生成時点のPPQでsubdivision（'4n'）をtick数へ固定し、
   * 後からのTransport.PPQ変更に追随しない。楽譜読み込み前にメトロノームを
   * ONにした場合、Transportの既定PPQ（192）でシーケンスが固定され、
   * loadScoreがPPQを480へ変更してもクリック間隔がずれたままになる。
   * このメソッドはPPQ変更の直後に呼び出す。常に現在のPPQに基づく間隔へ
   * シーケンスを組み直せる。
   */
  rebuildSequence(): void {
    if (this.sequence) {
      this.sequence.dispose();
      this.sequence = null;
    }
    if (this.enabled) {
      this.setEnabled(true);
    }
  }

  dispose(): void {
    if (this.sequence) {
      this.sequence.dispose();
      this.sequence = null;
    }
    this.synth.dispose();
  }
}
