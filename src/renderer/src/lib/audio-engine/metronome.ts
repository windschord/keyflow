import * as Tone from 'tone';

export class Metronome {
  private synth: Tone.Synth;
  private sequence: Tone.Sequence | null = null;
  private clock: Tone.Clock | null = null;
  private enabled: boolean = false;
  private accentEnabled: boolean = true;
  private measureStartTicks: Set<number> = new Set();
  // TASK-066: 独立クロック（Transport非依存）用の希望状態。既定はbpm=120
  // （ui-slice.bpmの初期値と一致）、拍子は4（一般的な拍子への後方互換）。
  private bpm = 120;
  private beatsPerMeasure = 4;
  private beatCounter = 0;
  // TASK-066: Transportが実際に動作しているかどうか。trueの間はSequence
  // （楽譜同期）、falseの間はClock（独立）でクリックを鳴らす（REQ-006-009）。
  private transportRunning = false;

  constructor() {
    this.synth = new Tone.Synth().toDestination();
  }

  /**
   * メトロノームの有効/無効を切り替える。Transportが動作中ならSequence
   * （楽譜同期）、動作していなければClock（独立、TASK-066/REQ-006-009）で
   * クリックを鳴らす。無効化時は両方を停止する。
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (this.enabled) {
      if (this.transportRunning) {
        this.startSequence();
      } else {
        this.startClock();
      }
    } else {
      this.stopSequence();
      this.stopClock();
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
   * 独立クロック（TASK-066）のテンポを設定する。クロック動作中は周波数
   * （bpm / 60 Hz）を即座に更新する。クロック未生成時は次回生成時に反映される。
   */
  setBpm(bpm: number): void {
    this.bpm = bpm;
    if (this.clock) {
      this.clock.frequency.value = bpm / 60;
    }
  }

  /** 独立クロック（TASK-066）のアクセント周期（1小節の拍数）を設定する（既定4）。 */
  setBeatsPerMeasure(beats: number): void {
    this.beatsPerMeasure = beats;
  }

  /**
   * Transportの動作状態を通知する（TASK-066）。再生開始時は独立クロックを止めて
   * 楽譜同期のSequenceへ切り替え、一時停止・停止時は（メトロノームが有効なら）
   * 拍カウンターを0にリセットして独立クロックへ戻す。
   */
  setTransportRunning(running: boolean): void {
    this.transportRunning = running;
    if (!this.enabled) return;

    if (running) {
      this.stopClock();
      this.startSequence();
    } else {
      this.stopSequence();
      this.startClock();
    }
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
   * TASK-066でTransport動作中（transportRunning）のみSequenceを使うようになった
   * ため、独立クロック動作中（停止中）はここでは何もしない。
   */
  rebuildSequence(): void {
    if (this.enabled && this.transportRunning) {
      this.startSequence();
    }
  }

  /**
   * 楽譜同期のSequenceを（再）生成して開始する。tone@15.1.22のSequenceは
   * 一度stop()すると内部Partに停止イベントが残りstart(0)で再開できない
   * 仕様のため（TASK-065、実測確認済み）、呼び出しのたびに必ず破棄してから
   * 作り直す。
   */
  private startSequence(): void {
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
  }

  private stopSequence(): void {
    if (this.sequence) {
      this.sequence.stop();
    }
  }

  /**
   * 独立クロック（TASK-066、REQ-006-009）を（再）生成して開始する。
   * Transportには一切触れないため、Transportが停止中でもクリックが鳴る。
   * 開始のたびに拍カウンターを0（1拍目）にリセットする。
   */
  private startClock(): void {
    if (this.clock) {
      this.clock.dispose();
    }
    this.beatCounter = 0;
    this.clock = new Tone.Clock((time) => {
      const beat = this.beatCounter % this.beatsPerMeasure;
      this.beatCounter += 1;
      if (this.accentEnabled) {
        if (beat === 0) {
          this.synth.triggerAttackRelease('C6', '32n', time, 1.0);
        } else {
          this.synth.triggerAttackRelease('C5', '32n', time, 0.6);
        }
      } else {
        this.synth.triggerAttackRelease('C5', '32n', time, 1.0);
      }
    }, this.bpm / 60);
    this.clock.start();
  }

  private stopClock(): void {
    if (this.clock) {
      this.clock.stop();
      this.clock.dispose();
      this.clock = null;
    }
  }

  dispose(): void {
    if (this.sequence) {
      this.sequence.dispose();
      this.sequence = null;
    }
    if (this.clock) {
      this.clock.dispose();
      this.clock = null;
    }
    this.synth.dispose();
  }
}
