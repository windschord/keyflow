import * as Tone from 'tone';
import { Score, PracticeMode } from '../../types';
import { Metronome } from './metronome';
import { groupNotesByStartTick, filterNotesByPracticeMode } from '../practice-engine/note-grouping';

/** 再生位置（判定グループ単位）が進むたびに呼ばれるコールバック。 */
export type PositionChangeCallback = (measureNumber: number, groupIndex: number) => void;

/**
 * StrictMode（React 18開発モード）はエフェクトを「実行→クリーンアップ→再実行」の
 * 順で二重実行する。usePractice.ts は useMemo で保持した単一の AudioEngineService
 * インスタンスに対して、アンマウント時 dispose() を呼ぶクリーンアップを登録するため、
 * 開発モードでは起動直後に dispose() が呼ばれ、以降のメソッド呼び出しがすべて
 * 破棄済みのシンセに対して行われ無音になっていた（2026-07-05 トラブルシューティング
 * 原因1）。
 *
 * 対策として、シンセ等のリソースは `ensureInitialized()` により遅延初期化し、
 * 各公開メソッドの先頭で呼び出す。`dispose()` はリソースを解放したうえで
 * 初期化済みフラグを倒すだけの冪等な操作とし、次のメソッド呼び出し時に
 * `ensureInitialized()` が自動的に再初期化する。
 */
export class AudioEngineService {
  private accompanimentSynth!: Tone.PolySynth;
  private clickSynth!: Tone.Synth;
  private playSynth!: Tone.PolySynth;
  private metronome!: Metronome;

  private initialized = false;

  private scorePart: Tone.Part | null = null;
  private positionEventIds: number[] = [];

  private onPositionChange: PositionChangeCallback | null = null;
  private onStop: (() => void) | null = null;

  constructor() {
    this.ensureInitialized();
  }

  /** 初期化済みでなければシンセ・メトロノームを（再）生成する。冪等。 */
  private ensureInitialized(): void {
    if (this.initialized) return;

    this.accompanimentSynth = new Tone.PolySynth(Tone.Synth).toDestination();
    this.clickSynth = new Tone.Synth().toDestination();
    this.playSynth = new Tone.PolySynth(Tone.Synth).toDestination();
    this.metronome = new Metronome();
    this.initialized = true;
  }

  /** 判定グループ進行時のコールバックを登録する（カーソル連動、REQ-010-005）。 */
  setPositionCallback(callback: PositionChangeCallback | null): void {
    this.onPositionChange = callback;
  }

  /** 停止操作時のコールバックを登録する（位置復帰、REQ-010-004）。 */
  setOnStop(callback: (() => void) | null): void {
    this.onStop = callback;
  }

  setBpm(bpm: number): void {
    this.ensureInitialized();
    Tone.getTransport().bpm.value = bpm;
  }

  setMetronomeEnabled(enabled: boolean): void {
    this.ensureInitialized();
    this.metronome.setEnabled(enabled);
  }

  /**
   * マスターボリュームを設定する（TASK-052）。伴奏・メトロノーム・効果音のすべてが
   * `.toDestination()` で共有Destinationに直結しているため（`:44-46`）、
   * `Tone.getDestination()` を操作するだけで一括して音量を反映できる。
   *
   * @param volume 0〜100のUI線形値。0はミュートとして扱う（`log10(0)` がNaNになる
   *   ため、dB変換せず `Destination.mute = true` で明示的にミュートする）。
   *   100は0dB（unity gain、変更前の既定音量相当）に対応する。
   *   範囲外の値は0〜100にクランプする。
   */
  setMasterVolume(volume: number): void {
    this.ensureInitialized();
    const destination = Tone.getDestination();
    const clamped = Math.max(0, Math.min(100, volume));

    if (clamped <= 0) {
      destination.mute = true;
      return;
    }

    destination.mute = false;
    destination.volume.value = 20 * Math.log10(clamped / 100);
  }

  /**
   * スコア全体（全パート、休符を除く発音ノーツ）を時刻ベースで再生スケジューリングする
   * （US-010 / data-model-v2 のtickモデル）。`loadAccompaniment` の後継。
   *
   * - `Tone.getTransport().PPQ` を `score.ticksPerQuarter` に合わせることで、
   *   tick表記（`` `${tick}i` ``）のイベントがそのまま絶対拍位置として解釈される。
   * - テンポスライダーが操作する `Tone.getTransport().bpm` は本メソッドの影響を受けず、
   *   再生速度は常にTransport側のbpmでスケールされる（責務分離、DEC-005）。
   * - 判定グループ（同一startTick）ごとに `Tone.getTransport().schedule` で
   *   カーソル連動コールバックを登録する（REQ-010-005）。UI更新は
   *   `Tone.getDraw().schedule` 経由でメインスレッドの描画タイミングに乗せる。
   * - スコア差し替え時は、既存のPartとスケジュール済みイベントをdisposeしてから
   *   再スケジュールする。
   * - `practiceMode`（既定 `'both'`）に応じて、実際に発音スケジュールする
   *   ノーツを `note.hand` で絞り込む（TASK-051: 再生の練習対象フィルタ、
   *   REQ-010-010）。左手練習中は左手のみ、右手練習中は右手のみを鳴らし、
   *   両手練習中は全ノーツを鳴らす。判定グループのカーソル連動（下記の
   *   `schedule`）は practiceMode に関わらず全ノーツ基準のまま変更しない
   *   （判定側フィルタは practice-engine 側で別途適用されるため、ここでは
   *   時間軸の進行のみを扱う）。
   */
  loadScore(score: Score, practiceMode: PracticeMode = 'both'): void {
    this.ensureInitialized();
    this.disposeScorePart();
    this.clearPositionEvents();

    Tone.getTransport().PPQ = score.ticksPerQuarter;

    const events: { time: string; note: string; duration: string }[] = [];

    score.measures.forEach((measure) => {
      const soundingNotes = measure.notes.filter((note) => !note.isRest);
      const scheduledNotes = filterNotesByPracticeMode(soundingNotes, practiceMode);
      scheduledNotes.forEach((note) => {
        events.push({
          time: `${note.startTick}i`,
          note: Tone.Frequency(note.midiNumber, 'midi').toNote(),
          duration: `${note.durationTicks}i`,
        });
      });

      const groups = groupNotesByStartTick(measure.notes);
      groups.forEach((group, groupIndex) => {
        const eventId = Tone.getTransport().schedule((time) => {
          Tone.getDraw().schedule(() => {
            this.onPositionChange?.(measure.number, groupIndex);
          }, time);
        }, `${group.startTick}i`);
        this.positionEventIds.push(eventId);
      });
    });

    if (events.length > 0) {
      this.scorePart = new Tone.Part((time, value) => {
        this.accompanimentSynth.triggerAttackRelease(value.note, value.duration, time);
      }, events).start(0);
    }
  }

  /**
   * ループ再生範囲を設定する（REQ-010-008）。`loopEnd` は
   * `practice-engine/loop-manager.ts` の意味と揃え、ループに含まれる最後の
   * 小節番号（inclusive）として扱う。無効時やスコア未読み込み時はループを解除する。
   */
  setLoopPoints(score: Score | null, enabled: boolean, loopStart: number, loopEnd: number): void {
    this.ensureInitialized();
    const transport = Tone.getTransport();

    if (!enabled || !score) {
      transport.loop = false;
      return;
    }

    const startMeasure = score.measures.find((m) => m.number === loopStart);
    if (!startMeasure) {
      transport.loop = false;
      return;
    }

    const endTick = this.resolveLoopEndTick(score, loopEnd);
    transport.setLoopPoints(`${startMeasure.startTick}i`, `${endTick}i`);
    transport.loop = true;
  }

  /** `loopEnd`小節（inclusive）の終端tickを解決する。次小節の頭、もしくは終端音符から算出する。 */
  private resolveLoopEndTick(score: Score, loopEndMeasureNumber: number): number {
    const nextMeasure = score.measures.find((m) => m.number === loopEndMeasureNumber + 1);
    if (nextMeasure) return nextMeasure.startTick;

    const endMeasure = score.measures.find((m) => m.number === loopEndMeasureNumber);
    if (!endMeasure) return 0;

    return endMeasure.notes.reduce(
      (max, note) => Math.max(max, note.startTick + note.durationTicks),
      endMeasure.startTick
    );
  }

  /**
   * 伴奏（お手本演奏）を開始する（REQ-010-001）。
   *
   * @param startTick 指定した場合、その絶対tick位置（現在の判定グループの
   *   startTick、`practice-engine.getCurrentPositionTick()` で解決）からTransportを
   *   開始する（カーソル位置からの再生）。省略時はTransportの現在位置（一時停止から
   *   の再開時はその一時停止位置）からそのまま開始する（REQ-010-003を維持するため、
   *   一時停止からの再開時は呼び出し側が`startTick`を渡さないこと）。
   */
  playAccompaniment(startTick?: number): void {
    this.ensureInitialized();
    if (startTick !== undefined) {
      Tone.getTransport().start(undefined, `${startTick}i`);
    } else {
      Tone.getTransport().start();
    }
  }

  stopAccompaniment(): void {
    this.ensureInitialized();
    Tone.getTransport().stop();
    this.onStop?.();
  }

  pauseAccompaniment(): void {
    this.ensureInitialized();
    Tone.getTransport().pause();
  }

  playCorrectSound(): void {
    this.ensureInitialized();
    this.clickSynth.triggerAttackRelease('C6', '16n');
  }

  playIncorrectSound(): void {
    this.ensureInitialized();
    this.clickSynth.triggerAttackRelease('C3', '16n');
  }

  playNote(midiNumber: number, duration: string = '8n'): void {
    this.ensureInitialized();
    const note = Tone.Frequency(midiNumber, 'midi').toNote();
    this.playSynth.triggerAttackRelease(note, duration);
  }

  private disposeScorePart(): void {
    if (this.scorePart) {
      this.scorePart.dispose();
      this.scorePart = null;
    }
  }

  private clearPositionEvents(): void {
    const transport = Tone.getTransport();
    this.positionEventIds.forEach((id) => transport.clear(id));
    this.positionEventIds = [];
  }

  /**
   * リソースを解放する。StrictModeのエフェクト再実行に耐えるため冪等にする
   * （未初期化・解放済みの状態で呼ばれても何もしない）。解放後に公開メソッドが
   * 呼ばれた場合は `ensureInitialized()` が自動的に再初期化する。
   */
  dispose(): void {
    if (!this.initialized) return;

    Tone.getTransport().stop();
    this.metronome.dispose();
    this.accompanimentSynth.dispose();
    this.clickSynth.dispose();
    this.playSynth.dispose();
    this.disposeScorePart();
    this.clearPositionEvents();

    this.initialized = false;
  }
}
