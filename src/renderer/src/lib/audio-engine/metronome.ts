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
      // TASK-065: 一度stop()したTone.Sequenceはstart(0)で再開できない仕様のため
      // （内部Partに停止イベントが残る、tone@15.1.22で実測確認済み）、有効化の
      // たびに必ず破棄してから作り直す。以前の、未生成時のみ生成する
      // キャッシュ方式は「OFF→ONで二度と鳴らなくなる」バグの原因だったため廃止した。
      if (this.sequence) {
        this.sequence.dispose();
      }
      this.sequence = new Tone.Sequence(
        (time) => {
          // TASK-062: 小節頭tick（Score.measures[].startTick）と、クリック発火時点の
          // Transport tickを照合してアクセントを判定する。getTicksAtTime(time)を使う
          // のは、Tone.jsのスケジューリングがlookahead付きで先行して発火するため、
          // transport.ticks（現在値）では発火予定時刻のtickとずれるからである。
          // 浮動小数の誤差を吸収するためMath.roundで整数化して照合する。
          const ticks = Math.round(Tone.getTransport().getTicksAtTime(time));
          if (this.accentEnabled) {
            const isAccent = this.measureStartTicks.has(ticks);
            if (isAccent) {
              this.synth.triggerAttackRelease('C6', '32n', time, 1.0);
            } else {
              this.synth.triggerAttackRelease('C5', '32n', time, 0.6);
            }
          } else {
            // TASK-065: アクセント無効時は強弱の差を付ける必要がないため、
            // 全拍を通常音量（1.0）で鳴らす（承認済み仕様変更、2026-07-07）。
            this.synth.triggerAttackRelease('C5', '32n', time, 1.0);
          }
        },
        // tone@15.1.22のSequenceはnullイベントを休符として扱いコールバックを
        // 呼ばない仕様（Sequence.js:67 _seqCallback）。[null]のままだと
        // クリックが永遠に発火しないため、発火する値（0）を入れる（TASK-061）。
        [0],
        '4n'
      );
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
   * 有効時は現在のTransport PPQでシーケンスを組み直す（TASK-064）。
   * tone@15.1.22のSequenceは生成時点のPPQでsubdivision（'4n'）をtick数へ固定し、
   * 後からのTransport.PPQ変更に追随しない。楽譜読み込み前にメトロノームを
   * ONにした場合、Transportの既定PPQ（192）でシーケンスが固定され、
   * loadScoreがPPQを480へ変更してもクリック間隔がずれたままになる。
   * このメソッドはPPQ変更の直後に呼び出す。常に現在のPPQに基づく間隔へ
   * シーケンスを組み直せる。
   *
   * TASK-065で`setEnabled(true)`自体が毎回シーケンスを破棄して作り直す
   * ようになったため、本メソッドは`setEnabled`の再呼び出しに単純化できる。
   */
  rebuildSequence(): void {
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
