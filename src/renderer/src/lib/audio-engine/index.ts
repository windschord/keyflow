import * as Tone from 'tone';
import { Score, PracticeMode } from '../../types';
import { Metronome } from './metronome';
import { groupNotesByStartTick, filterNotesByPracticeMode } from '../practice-engine/note-grouping';
import {
  createPlaybackInstrument,
  PLAYBACK_VOICES,
  type PlaybackVoiceId,
  type PlaybackInstrument,
} from './voices';
import type { MetronomeVoiceId } from './metronome-voices';
import { resolveEffectiveDurations } from './pedal-extension';
import { TimeoutError } from './with-timeout';

/**
 * 再生音色のサンプルロード（`grand-piano`）を打ち切るまでの上限時間（TASK-106）。
 *
 * サンプルはアプリに同梱されており、ローカル読み込みだけで完結するため通常は1秒未満で
 * 完了する。それでも `Tone.Sampler` が `onload` と `onerror` のどちらも返さない状態に
 * 陥ると、`ensurePlaybackVoiceLoaded()` が永久にpendingとなる。
 * するとこれを待つ再生ボタンが「押しても何も起きない」状態になる。
 * 上限を超えた場合はロード失敗と同じフォールバック（synthプリセット）へ倒し、
 * 無音・無反応ではなく「音色は簡易だが再生はできる」状態を保証する。
 * 分析: docs/sdd/troubleshooting/2026-08-11-portable-play-no-response/analysis.md
 */
export const SAMPLE_LOAD_TIMEOUT_MS = 20_000;

/** 再生位置（判定グループ単位）が進むたびに呼ばれるコールバック。 */
export type PositionChangeCallback = (measureNumber: number, groupIndex: number) => void;

/**
 * 再生中に発音中のノーツ集合（MIDI番号）が変化するたびに呼ばれるコールバック
 * （TASK-057）。渡される `Set` はスナップショットであり、以後の変化で
 * ミューテートされない。
 */
export type SoundingNotesChangeCallback = (soundingNotes: Set<number>) => void;

/** 播放范围段（一对起止小节号）。 */
interface PlaybackSegment {
  start: number;
  end: number;
}

/**
 * 解析播放范围字符串为段列表。
 * "1-3, 1-5" → [{start:1,end:3}, {start:1,end:5}]
 * "1-3, 1-3" → [{start:1,end:3}, {start:1,end:3}]（反复）
 * 空字符串 → []（原始顺序，无跳转）
 */
function parseRangeIntoSegments(range: string): PlaybackSegment[] {
  if (!range || range.trim() === '') return [];
  const parts = range.split(',').map((s) => s.trim());
  const segments: PlaybackSegment[] = [];
  for (const part of parts) {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number);
      if (isNaN(start) || isNaN(end) || start > end) {
        throw new Error(`Invalid range: ${part}`);
      }
      segments.push({ start, end });
    } else {
      const num = Number(part);
      if (isNaN(num)) throw new Error(`Invalid measure number: ${part}`);
      segments.push({ start: num, end: num });
    }
  }
  return segments;
}

/**
 * 根据乐谱里的反复记号（||: :|| + 1房子/2房子）自动推导播放顺序。
 * 输出与 parseRangeIntoSegments 同构：PlaybackSegment[]，可直接喂给 setupPlaybackSequence。
 *
 * 覆盖范围（第一步实现）：
 *   - repeatStart / repeatEnd（左/右反复，含 times 次数）
 *   - ending start/discontinue 1房子 / 2房子（多房子号数组支持：[1,2] / [1] / [2]）
 *
 * 暂未覆盖（后续迭代）：D.C. / D.S. / Segno / Coda / Fine / To Coda
 * 遇到这些记号会跳过（不生成跳转），等价于"反复记号不存在"的线性播放。
 *
 * 算法：
 *   Pass 0：线性扫 measures，为每个 repeatEnd 小节建立元信息 endMap
 *            endMap[n] = { target, times, ending1End, ending2Start, ending2End }
 *   Pass 1：while 状态机 curN 从第1小节到曲尾
 *            每轮找到 curN 之后最近的 repeatEnd = jumpN
 *            push [curN, jumpN] 段
 *            若需反复：追加 "target → 1房子前" + "2房子 → 2房子末" 两段（有房子号时）
 *                              或 追加 curN=target（下一轮自动闭合，无房子号时）
 *            若不需反复：curN = jumpN + 1 继续前进
 */
export function deriveRepeatPlayRange(score: Score): PlaybackSegment[] {
  const measures = [...score.measures].sort((a, b) => a.number - b.number);
  if (measures.length === 0) return [];

  const firstN = measures[0].number;
  const lastN = measures[measures.length - 1].number;
  const byNum = new Map(measures.map((m) => [m.number, m]));

  // ===== Pass 0：构建 endMap =====
  type EndMeta = {
    target: number;          // 跳回目标小节（最近的 repeatStart，没有则第1小节）
    times: number;           // 总遍数（MusicXML times，缺省=2）
    ending1Start: number | null;  // 1房子开始小节号（1房子跨多小节时用，用于跳过整个1房子）
    ending1End: number;      // 1房子结束小节号（没1房子时=repeatEnd小节本身）
    ending2Start: number | null;  // 2房子开始小节号
    ending2End: number | null;    // 2房子结束小节号
  };
  const endMap = new Map<number, EndMeta>();

  const openStarts: number[] = [];           // 未匹配的 repeatStart 小节号栈（最近的在末尾）
  let lastEnding1Start: number | null = null; // 最近一次看到"ending numbers 含1 + 是起始边界"的小节
  let lastEnding1End: number | null = null;  // 最近一次看到"ending numbers 含1 + endingEnd=true"的小节
  let pendingRepeatN: number | null = null;  // 最近刚处理完的 repeatEnd 小节，等后面的 endingStart[2] 写回它
  let pendingEnding2Start: number | null = null; // 最近刚赋值的 ending2Start，等 endingEnd 写回它的2房子末

  for (const m of measures) {
    const mn = m.number;

    // 本小节是 1房子 的起始边界（numbers 含 1 且不是结束边界）→ 记录 1房子开始
    // 注意顺序：先记录开始，再处理结束。同一小节可能既是开始又是结束（单小节房子）。
    if (!m.endingEnd && m.endingStart?.numbers?.includes(1)) {
      lastEnding1Start = mn;
    }

    // 本小节是 ending 结束边界 且 numbers 含 1 → 记录 1房子末尾
    if (m.endingEnd && m.endingStart?.numbers?.includes(1)) {
      lastEnding1End = mn;
      // 单小节房子：开始边界可能没单独出现（开始=结束=本小节），补记开始
      if (lastEnding1Start === null) {
        lastEnding1Start = mn;
      }
    }

    // 命中 repeatEnd：闭合一个反复
    if (m.repeatEnd) {
      const target = (openStarts.length > 0 ? openStarts.pop()! : firstN);
      const meta: EndMeta = {
        target,
        times: Math.max(2, m.repeatEnd.times),
        ending1Start: lastEnding1Start ?? lastEnding1End ?? mn,
        ending1End: lastEnding1End ?? mn,
        ending2Start: null,
        ending2End: null,
      };
      endMap.set(mn, meta);
      pendingRepeatN = mn;
      lastEnding1Start = null;
      lastEnding1End = null;
    }

    // 命中 2房子 开始：记给 pendingRepeatN 的 meta.ending2Start
    if (pendingRepeatN !== null && m.endingStart?.numbers?.includes(2)) {
      const meta = endMap.get(pendingRepeatN)!;
      meta.ending2Start = mn;
      pendingEnding2Start = mn;
      pendingRepeatN = null;
    }

    // 命中 2房子 结束：填 pendingEnding2Start 对应的 2房子末
    if (pendingEnding2Start !== null && m.endingEnd && m.endingStart?.numbers?.includes(2)) {
      for (const meta of endMap.values()) {
        if (meta.ending2Start === pendingEnding2Start) {
          meta.ending2End = mn;
          break;
        }
      }
      pendingEnding2Start = null;
    }

    // 正常遇到 repeatStart 入栈（注意要先处理完 repeatEnd，因为有些谱面会在同一小节既有 repeatEnd（开头右line）
    // 又有 repeatStart（结尾左line，即 ":||:" 那种），此时先把 repeatEnd 消费掉再 push 新 start 进栈。
    if (m.repeatStart) {
      openStarts.push(mn);
    }
  }

  // ===== Pass 1：状态机生成段列表 =====
  const segments: PlaybackSegment[] = [];
  let curN = firstN;
  const repeatVisited = new Map<number, number>(); // repeatEnd 小节 → 已反复次数（第一次到 repeatEnd 后是第1遍完成，已反复=0；再访问一次就 +1）
  const MAX_ITER = 1000;
  let safety = 0;

  while (curN <= lastN && safety++ < MAX_ITER) {
    // 找到 curN 之后最近的一个 repeatEnd 小节
    let jumpN: number | null = null;
    for (let n = curN; n <= lastN; n++) {
      const mm = byNum.get(n);
      if (mm?.repeatEnd) {
        jumpN = n;
        break;
      }
    }

    // 没 repeatEnd 了 → 直接闭合到曲尾，退出
    if (jumpN === null) {
      segments.push({ start: curN, end: lastN });
      break;
    }

    const meta = endMap.get(jumpN);
    if (!meta) {
      // 理论上不可能（repeatEnd 必然在 Pass 0 注册），防御性前进
      segments.push({ start: curN, end: jumpN });
      curN = jumpN + 1;
      continue;
    }

    // ---- 命中 repeatEnd ----
    // (1) 先闭合当前行进段 [curN, jumpN]
    segments.push({ start: curN, end: jumpN });

    const visited = repeatVisited.get(jumpN) ?? 0;
    const needRepeat = visited < meta.times - 1; // times=2 → 只反复 1 次

    if (!needRepeat) {
      // 已经反复够次数了，正常前进
      curN = jumpN + 1;
      repeatVisited.set(jumpN, visited + 1);
      continue;
    }

    repeatVisited.set(jumpN, visited + 1);

    // (2) 反复：根据是否有 1/2 房子号，追加相应两段或一段
    if (meta.ending2Start !== null && meta.ending2End !== null) {
      // 有 1房子/2房子：
      //   第 2+ 遍不走 1房子（ending1Start～ending1End 整段），也不走它本身：
      //   → target → ending1Start - 1（1房子之前的内容），然后 ending2Start → ending2End（2房子）
      //   注意：一房子可能跨多个小节（如 37-44），必须从"1房子开始小节的前一小节"跳开，
      //   而不是从"1房子结束小节的前一小节"，否则第二次经过会把 1房子 的中间小节也播一遍。
      const preEnding1End = Math.max(meta.target, meta.ending1Start! - 1);
      if (meta.target <= preEnding1End) {
        segments.push({ start: meta.target, end: preEnding1End });
      }
      if (meta.ending2Start <= meta.ending2End) {
        segments.push({ start: meta.ending2Start, end: meta.ending2End });
      }
      // 之后从 2房子结束的下一小节继续前进（2房子里不再含 repeatEnd，即使有也没问题，下一轮 while 会处理）
      curN = meta.ending2End + 1;
    } else {
      // 无房子号：普通反复 → 下一轮 while 从 target 开始扫，自动闭合 [target, jumpN]
      curN = meta.target;
    }
  }

  // 循环防御：超限意味着可能有 D.C. 等暂未处理的记号导致死循环，直接收尾
  if (safety >= MAX_ITER && curN <= lastN) {
    segments.push({ start: Math.min(curN, lastN), end: lastN });
  }

  // 后处理：合并线性连续的相邻段
  // 如果前段 end+1 == 后段 start，说明播放时前段末尾直接接后段开头（如 m6→m7），
  // 中间没有跳转间隙，合并成一段更简洁（如 "6, 7-9" → "6-9"）。
  // 跳转回退的段（如 "6-9" 后再 "6-9"）start != 前段 end+1，不会被误合并。
  const merged: PlaybackSegment[] = [];
  for (const seg of segments) {
    const last = merged[merged.length - 1];
    if (last && last.end + 1 === seg.start) {
      last.end = seg.end;
    } else {
      merged.push({ ...seg });
    }
  }

  return merged;
}

/**
 * 将 PlaybackSegment[] 反向转成 "1-4, 1-3, 5-5" 这样的字符串，
 * 与 parseRangeIntoSegments 互逆，便于 UI 文本框显示。
 */
export function segmentsToRangeString(segments: PlaybackSegment[]): string {
  return segments
    .map((s) => (s.start === s.end ? `${s.start}` : `${s.start}-${s.end}`))
    .join(', ');
}

/** ある1tickに集約された発音開始/終了イベント（TASK-057）。 */
interface NoteBoundaryEvent {
  starts: number[];
  ends: number[];
}

/**
 * StrictMode（React 18開発モード）はエフェクトを「実行→クリーンアップ→再実行」の
 * 順で二重実行する。usePractice.ts は useMemo で保持した単一の AudioEngineService
 * インスタンスに対して、アンマウント時 dispose() を呼ぶクリーンアップを登録する。
 * このため開発モードでは起動直後に dispose() が呼ばれ、以降のメソッド呼び出しが
 * すべて破棄済みのシンセに対して行われ無音になっていた（2026-07-05
 * トラブルシューティング原因1）。
 *
 * 対策として、シンセ等のリソースは `ensureInitialized()` により遅延初期化し、
 * 各公開メソッドの先頭で呼び出す。`dispose()` はリソースを解放したうえで
 * 初期化済みフラグを倒すだけの冪等な操作とし、次のメソッド呼び出し時に
 * `ensureInitialized()` が自動的に再初期化する。
 */
export class AudioEngineService {
  private accompanimentSynth!: PlaybackInstrument;
  private clickSynth!: Tone.Synth;
  private playSynth!: PlaybackInstrument;
  private metronome!: Metronome;

  private initialized = false;

  private scorePart: Tone.Part | null = null;
  private positionEventIds: number[] = [];

  // TASK-070: ループ折り返し（loopEnd）でaccompanimentSynth.releaseAll()を呼ぶ
  // Transport.scheduleのID（REQ-014-005）。スコア差し替え・ループ再設定のたびに
  // クリアしてから必要なら再登録する。
  private loopReleaseEventId: number | null = null;

  // TASK-057: 発音中ノーツ（durationTicks満了までキーボード表示を継続させる
  // ための派生状態）。判定グループ（同一startTick）単位で入れ替わる
  // positionEventIds/onPositionChangeとは独立に、ノーツごとのstartTick/
  // (startTick+durationTicks)の境界で更新する。
  private soundingNoteEventIds: number[] = [];
  private currentSoundingNotes: Set<number> = new Set();

  // 播放顺序跳转的 Transport.schedule 事件 ID 列表。
  // 用户输入 "1-3, 1-5" 时，在第3小节末尾注册跳转回第1小节开头。
  // loadScore/stopAccompaniment 时清理。
  private sequenceEventIds: number[] = [];

  // loadScore 最后一次加载的 score 与 practiceMode，用于跳转后重新 schedule
  // positionEventIds / soundingNoteEventIds（clear 后需要重建）。
  private _lastLoadedScore: Score | null = null;
  private _lastPracticeMode: PracticeMode = 'both';

  // setupPlaybackSequence 最后一次接收的 score 和 range，用于 playAccompaniment(startTick)
  // 时重新调度跳转 boundary（用户从中间小节开始播放时，前面的 boundary 已过期，
  // 需要从当前位置之后的第一个 boundary 开始 schedule）。
  private _lastSetupScore: Score | null = null;
  private _lastSetupRange: string = '';
  // 同上：最后一次接收的循环标志。重新调度时必须保持循环/非循环一致。
  private _lastSetupLoop = false;

  // loadScore 构建好的 Tone.Part 事件数组（已含 pedal 延长后的 effectiveDuration），
  // 跳转后 transport.cancel() 会清掉 Part 内部调度事件，需要用它重建 Part。
  // 诊断字段 tick / measure：用于在 Part callback 里 log 出每个被触发音符
  // 所属的原始 tick 和小节号，验证跳转后是否错误触发了下一小节的音符。
  private _lastPartEvents: {
    time: string;
    note: string;
    duration: string;
    tick: number;
    measure: number;
  }[] | null = null;

  // UI 事件版本号：每次重新 schedule position/sounding 事件时自增。
  // 旧事件的回调捕获了 schedule 时的版本号，发现与当前版本不一致直接 return，
  // 不需要逐个 transport.clear()，把 O(1500) 的清循环降到 O(1) 自增。
  private _uiEventVersion = 0;

  private onPositionChange: PositionChangeCallback | null = null;
  private onStop: (() => void) | null = null;
  private onSoundingNotesChange: SoundingNotesChangeCallback | null = null;

  // TASK-062: メトロノームのアクセント関連の希望状態。dispose()でMetronomeインスタンス
  // 自体が破棄されるため、ensureInitialized()での再生成後にもこの希望状態を再適用する
  // （StrictMode耐性の既存設計、クラス冒頭のコメント参照）。
  private metronomeAccentEnabled = true;
  private measureStartTicks: number[] = [];
  // TASK-066: メトロノーム単独再生（独立クロック）用の希望状態。ui-slice.bpmの
  // 初期値（120）・一般的な拍子（4）に合わせた既定値とし、dispose()での
  // Metronome再生成後にも再適用する（accentEnabled等と同じStrictMode耐性設計）。
  private metronomeBpm = 120;
  private metronomeBeatsPerMeasure = 4;
  // TASK-072: メトロノーム音色の希望状態。dispose()でのMetronome再生成後にも
  // 選択中の音色を維持する（metronomeAccentEnabled等と同じStrictMode耐性設計）。
  private metronomeVoiceId: MetronomeVoiceId = 'click';

  // TASK-071: 再生音色（伴奏・手動プレビュー共通）の希望状態。dispose()での再生成後にも
  // 選択中の音色を維持する（metronomeAccentEnabled等と同じStrictMode耐性設計）。
  private playbackVoiceId: PlaybackVoiceId = 'grand-piano';
  private voiceLoadingCallback: ((loading: boolean) => void) | null = null;
  // CodeRabbit PR#28指摘#5(b): setPlaybackVoice連打時、古い世代のSamplerの
  // onload/onerrorが後から届いても最新世代の状態を上書きしないための世代カウンタ。
  // applyPlaybackVoice呼び出しごとにインクリメントし、非同期コールバック内で
  // 自身の世代が最新かどうかを判定する。
  private voiceGeneration = 0;
  // grand-piano（Tone.Sampler）のサンプルダウンロード完了、またはそれ以外の即時利用可な
  // 音色への切替完了で解決するPromise。ensurePlaybackVoiceLoaded()が参照する。
  private voiceReadyPromise: Promise<void> = Promise.resolve();
  // TASK-106: 現行世代のサンプルロード上限タイマー。音色の切り替え・ロードの決着・
  // dispose()のいずれでも解除し、古い世代のタイマーを発火させない。
  private voiceLoadTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.ensureInitialized();
  }

  /** 初期化済みでなければシンセ・メトロノームを（再）生成する。冪等。 */
  private ensureInitialized(): void {
    if (this.initialized) return;

    this.clickSynth = new Tone.Synth().toDestination();
    this.voiceReadyPromise = this.applyPlaybackVoice(this.playbackVoiceId);
    this.metronome = new Metronome();
    this.metronome.setAccentEnabled(this.metronomeAccentEnabled);
    this.metronome.setMeasureStartTicks(this.measureStartTicks);
    this.metronome.setBpm(this.metronomeBpm);
    this.metronome.setBeatsPerMeasure(this.metronomeBeatsPerMeasure);
    this.metronome.setVoice(this.metronomeVoiceId);
    this.initialized = true;
  }

  /** 現行世代のサンプルロード上限タイマーを解除する。冪等（TASK-106）。 */
  private clearVoiceLoadTimeout(): void {
    if (this.voiceLoadTimeoutId !== null) {
      clearTimeout(this.voiceLoadTimeoutId);
      this.voiceLoadTimeoutId = null;
    }
  }

  /**
   * 再生音色（伴奏・手動プレビューの両方）を生成し、`accompanimentSynth` /
   * `playSynth` へ割り当てる（TASK-071）。`grand-piano`（Tone.Sampler）は
   * ネットワークからのサンプルダウンロードを伴うため、両インスタンスの
   * `onload` が揃うまで解決しないPromiseを返す。ロード失敗時は
   * `synth` プリセットへフォールバックし、フォールバック完了をもって解決する
   * （ロード待ちPromiseを永久のpendingとしないための措置）。
   *
   * CodeRabbit PR#28指摘#5: `setPlaybackVoice`連打時、古い世代の`onload`/`onerror`が
   * 後から届いても最新世代の状態を上書きしないよう、呼び出しごとに`voiceGeneration`を
   * 採番し非同期コールバック内で世代を照合する。stale callbackが生成したインスタンスは
   * 使わずdisposeする。また、フォールバック時はロードに失敗した現世代のSampler自体も
   * disposeし、旧インスタンスの残留を防ぐ。
   */
  private applyPlaybackVoice(id: PlaybackVoiceId): Promise<void> {
    const generation = ++this.voiceGeneration;
    const isCurrentGeneration = (): boolean => generation === this.voiceGeneration;
    const definition = PLAYBACK_VOICES[id];

    // TASK-106: この呼び出しで世代が進むため、旧世代のロード上限タイマーは不要になる。
    // 残したままにすると、古い世代のタイマーが発火してフォールバック音源を生成し、
    // 世代不一致で即座に破棄するだけの無駄なTone.jsノードを作ってしまう。
    this.clearVoiceLoadTimeout();

    if (!definition.requiresLoading) {
      this.accompanimentSynth = createPlaybackInstrument(id).toDestination();
      this.playSynth = createPlaybackInstrument(id).toDestination();
      // TASK-106: ロード中（voiceLoading=true）の音色から即時利用可な音色へ切り替えた場合、
      // 旧世代の finishLoading は世代不一致で false を通知しない。この分岐でも明示的に
      // false を通知しないと voiceLoading が true のまま残り、再生ボタンが「読込中...」表示の
      // 無効状態から復帰しなくなる（押しても何も起きない状態の一因）。
      this.voiceLoadingCallback?.(false);
      return Promise.resolve();
    }

    this.voiceLoadingCallback?.(true);

    let settled = false;
    let loadedCount = 0;
    let resolveReady!: () => void;
    const ready = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });

    /**
     * この世代のロードを決着させる（成功・失敗・タイムアウトの共通終端）。冪等。
     * 最新世代のときだけロード上限タイマーを解除し、ローディング状態を通知する。
     */
    const finishLoading = (): void => {
      if (settled) return;
      settled = true;
      // 最新世代のときだけ解除する。古い世代の決着で最新世代のタイマーを
      // 巻き添えに解除しないため。
      if (isCurrentGeneration()) {
        this.clearVoiceLoadTimeout();
        this.voiceLoadingCallback?.(false);
      }
      resolveReady();
    };

    /** 伴奏用・手動プレビュー用の2インスタンスが揃ってロード完了したら決着させる。 */
    const markLoaded = (): void => {
      loadedCount += 1;
      if (loadedCount >= 2) finishLoading();
    };

    /**
     * サンプルのロード失敗・タイムアウト時にsynthプリセットへ倒して決着させる。
     * ロード待ちPromiseを永久のpendingにしないための退避経路である。
     */
    const fallbackToSynth = (error: Error): void => {
      if (settled) return;
      console.error(
        '[AudioEngineService] Failed to load Salamander piano samples; falling back to the synth preset',
        error
      );

      // ロードに失敗した（この世代の）grand-pianoペアはこの時点で不要になるため、
      // 世代の新旧に関わらず必ずdisposeする（旧インスタンス残留防止、指摘#5(a)）。
      accompanimentSynthInstance.dispose();
      playSynthInstance.dispose();

      const accompanimentFallback = createPlaybackInstrument('synth').toDestination();
      const playFallback = createPlaybackInstrument('synth').toDestination();

      if (isCurrentGeneration()) {
        this.accompanimentSynth = accompanimentFallback;
        this.playSynth = playFallback;
      } else {
        // 既に新しいsetPlaybackVoice呼び出しが走っている場合、このフォールバックは
        // 最新状態を上書きしてはならない。生成したインスタンスは使わずdisposeする
        // （指摘#5(b)）。
        accompanimentFallback.dispose();
        playFallback.dispose();
      }

      finishLoading();
    };

    const accompanimentSynthInstance = createPlaybackInstrument(id, {
      onload: markLoaded,
      onerror: fallbackToSynth,
    }).toDestination();
    const playSynthInstance = createPlaybackInstrument(id, {
      onload: markLoaded,
      onerror: fallbackToSynth,
    }).toDestination();

    this.accompanimentSynth = accompanimentSynthInstance;
    this.playSynth = playSynthInstance;

    // TASK-106: onload / onerror のいずれも返らない状態（ロードのハング）に備えた上限時間。
    // インスタンス生成後に登録することで、fallbackToSynth が参照する
    // accompanimentSynthInstance / playSynthInstance が必ず初期化済みであることを保証する。
    // タイマーIDはインスタンスフィールドで保持し、音色の切り替え時と dispose() 時に
    // 解除する（古い世代のタイマーが後から発火してフォールバック音源を生成するのを防ぐ）。
    this.voiceLoadTimeoutId = setTimeout(
      () => fallbackToSynth(new TimeoutError('Loading the piano samples', SAMPLE_LOAD_TIMEOUT_MS)),
      SAMPLE_LOAD_TIMEOUT_MS
    );

    return ready;
  }

  /**
   * 再生音色を切り替える（TASK-071、REQ-013-001/002）。現在のインスタンスを
   * disposeしたうえで新しい音色を生成し、`accompanimentSynth` / `playSynth` を
   * 差し替える。`loadScore` 済みの `Tone.Part` はコールバック内で
   * `this.accompanimentSynth` を都度参照するため、再スケジュールは不要
   * （次の発音から新音色が反映される）。`grand-piano` へ切り替えた場合は
   * サンプルのロード完了まで返り値のPromiseがpendingになる。
   */
  setPlaybackVoice(id: PlaybackVoiceId): Promise<void> {
    this.ensureInitialized();
    this.playbackVoiceId = id;

    this.accompanimentSynth.dispose();
    this.playSynth.dispose();

    this.voiceReadyPromise = this.applyPlaybackVoice(id);
    return this.voiceReadyPromise;
  }

  /**
   * 現在選択中の再生音色が発音可能になるまで待つ（REQ-013-003）。
   * ロード済み・ロード不要な音色の場合は即座に解決する。
   */
  ensurePlaybackVoiceLoaded(): Promise<void> {
    this.ensureInitialized();
    return this.voiceReadyPromise;
  }

  /** 再生音色のロード状態（true=ロード中）の変化を購読する（UIのローディング表示用）。 */
  setVoiceLoadingCallback(callback: ((loading: boolean) => void) | null): void {
    this.voiceLoadingCallback = callback;
  }

  /** 判定グループ進行時のコールバックを登録する（カーソル連動、REQ-010-005）。 */
  setPositionCallback(callback: PositionChangeCallback | null): void {
    this.onPositionChange = callback;
  }

  /** 停止操作時のコールバックを登録する（位置復帰、REQ-010-004）。 */
  setOnStop(callback: (() => void) | null): void {
    this.onStop = callback;
  }

  /**
   * 発音中ノーツ集合の変化時のコールバックを登録する（TASK-057、
   * 再生中の鍵盤表示を音価に追随させるための派生状態）。
   */
  setSoundingNotesCallback(callback: SoundingNotesChangeCallback | null): void {
    this.onSoundingNotesChange = callback;
  }

  setBpm(bpm: number): void {
    this.ensureInitialized();
    Tone.getTransport().bpm.value = bpm;
    // TASK-066: 独立クロック（メトロノーム単独再生）もテンポスライダーの値に
    // 追随させる。
    this.metronomeBpm = bpm;
    this.metronome.setBpm(bpm);
  }

  setMetronomeEnabled(enabled: boolean): void {
    this.ensureInitialized();
    this.metronome.setEnabled(enabled);
  }

  /** メトロノームの一拍目アクセントの有効/無効を設定する（既定true、REQ-006-008）。 */
  setMetronomeAccentEnabled(enabled: boolean): void {
    this.ensureInitialized();
    this.metronomeAccentEnabled = enabled;
    this.metronome.setAccentEnabled(enabled);
  }

  /** メトロノーム音色を切り替える（即時反映、TASK-072、REQ-013-004）。 */
  setMetronomeVoice(id: MetronomeVoiceId): void {
    this.ensureInitialized();
    this.metronomeVoiceId = id;
    this.metronome.setVoice(id);
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
   *   両手練習中は全ノーツを鳴らす。判定グループのカーソル連動
   *   （下記の `schedule`）は practiceMode に関わらず全ノーツ基準のまま変更しない
   *   （判定側フィルタは practice-engine 側で別途適用されるため、ここでは
   *   時間軸の進行のみを扱う）。
   * - 発音中ノーツ集合（TASK-057）は、上記の判定グループとは別に、実際に
   *   スケジュールされた各ノーツ（`scheduledNotes`）の発音開始tick
   *   （`startTick`）・終了tick（`startTick + durationTicks`）を境界として
   *   追跡する。判定グループ単位（同一startTickの集合が丸ごと入れ替わる方式）
   *   では音価（durationTicks）が表示に反映されないため、ノーツ単位の境界を
   *   別スケジュールとして持つ。ノーツ数が多い曲でもスケジュール登録が過剰に
   *   ならないよう、同一tickに集まる開始/終了イベントは1つの
   *   `Tone.getTransport().schedule` 呼び出しに集約する（`boundaryEvents`）。
   */
  loadScore(score: Score, practiceMode: PracticeMode = 'both'): void {
    this.ensureInitialized();
    // 保存最后加载的 score / practiceMode 引用，供跳转后重新 schedule UI 事件使用
    this._lastLoadedScore = score;
    this._lastPracticeMode = practiceMode;

    const _t0 = performance.now();
    this.disposeScorePart();
    this.clearPositionEvents();
    this.clearSoundingNoteEvents();
    this.resetSoundingNotes();
    // 播放顺序跳转事件基于旧乐谱的 tick，乐谱切换后失效，需清理
    this.clearSequenceEvents();
    // TASK-070: 旧スコアのloopEnd tickに基づくreleaseAllスケジュールは
    // 新スコアのタイムラインでは無意味になるため、差し替え時にクリアする
    // （setLoopPointsが呼ばれていなければ何もしない）。
    this.clearLoopReleaseEvent();
    const _t1 = performance.now();

    Tone.getTransport().PPQ = score.ticksPerQuarter;

    // TASK-064: PPQ変更の直後にシーケンスを組み直す。tone@15.1.22のSequenceは
    // 生成時点のPPQでクリック間隔を固定するため、この呼び出し順序が本修正の核心であり、
    // PPQ設定より前に呼んではならない。
    this.metronome.rebuildSequence();

    // TASK-066: メトロノーム単独再生（独立クロック）のアクセント周期を
    // 楽譜の拍子に合わせる。
    this.metronomeBeatsPerMeasure = score.timeSignature.beats;
    this.metronome.setBeatsPerMeasure(this.metronomeBeatsPerMeasure);

    // TASK-062: メトロノームの一拍目アクセント判定に使う小節頭tickをMetronomeへ連携する。
    this.measureStartTicks = score.measures.map((m) => m.startTick);
    this.metronome.setMeasureStartTicks(this.measureStartTicks);
    const _t2 = performance.now();

    const events: { time: string; note: string; duration: string; tick: number; measure: number }[] = [];
    const boundaryEvents = new Map<number, NoteBoundaryEvent>();

    const registerBoundary = (tick: number, kind: 'starts' | 'ends', midiNumber: number): void => {
      const entry = boundaryEvents.get(tick) ?? { starts: [], ends: [] };
      entry[kind].push(midiNumber);
      boundaryEvents.set(tick, entry);
    };

    // TASK-070: 実際にスケジュールされるノーツ（practiceMode適用後）全体を対象に、
    // ペダル延長・同音再打鍵の切り詰めを静的に解決する（US-014、REQ-014-002）。
    // 小節をまたぐ同音の切り詰め判定のため、小節単位ではなくスコア全体で計算する。
    const measureScheduledNotes = score.measures.map((measure) => {
      const soundingNotes = measure.notes.filter((note) => !note.isRest);
      const scheduledNotes = filterNotesByPracticeMode(soundingNotes, practiceMode);
      return { measure, scheduledNotes };
    });
    const effectiveDurations = resolveEffectiveDurations(
      measureScheduledNotes.flatMap(({ scheduledNotes }) => scheduledNotes),
      score.pedalSpans
    );
    const _t3 = performance.now();

    measureScheduledNotes.forEach(({ measure, scheduledNotes }) => {
      scheduledNotes.forEach((note) => {
        events.push({
          time: `${note.startTick}i`,
          note: Tone.Frequency(note.midiNumber, 'midi').toNote(),
          duration: `${effectiveDurations.get(note) ?? note.durationTicks}i`,
          tick: note.startTick,
          measure: measure.number,
        });
        // NOTE: 発音境界（鍵盤ハイライト用）と判定グループは記譜上の音価
        // （note.durationTicks）のまま変更しない（US-014データ要件、鍵盤ガイドは
        // 記譜基準）。ペダル延長はTone.Partへ渡す発音長にのみ反映する。
        registerBoundary(note.startTick, 'starts', note.midiNumber);
        registerBoundary(note.startTick + note.durationTicks, 'ends', note.midiNumber);
      });
    });
    const _t4 = performance.now();

    // 保存 events 数组（含 pedal 延长后的 effectiveDuration），跳转后重建 Part 用
    this._lastPartEvents = events.length > 0 ? events : null;

    if (this._lastPartEvents) {
      this.scorePart = new Tone.Part((time, value) => {
        // 诊断日志：记录每个被 Part 触发的音符的原始 tick 和小节号，
        // 用于验证跳转后是否错误触发了下一小节的音符（lookAhead 预调度问题）。
        // transport.ticks 是 Transport 当前 ticks，value.tick 是音符在原乐谱中的绝对 tick。
        const transportTicksNow = Tone.getTransport().ticks;
        console.log('[Note triggered]', {
          noteTick: value.tick,
          measure: value.measure,
          pitch: value.note,
          duration: value.duration,
          audioTime: time,
          transportTicksAtTrigger: transportTicksNow,
          // 偏移量：>0 说明这个音是 Transport 还没走到就预调度触发的（lookAhead 超前）
          // <0 说明是跳转后 Transport 已越过该 tick 才触发（罕见，跳转回放）
          tickOffsetFromTransport: value.tick - transportTicksNow,
        });
        this.accompanimentSynth.triggerAttackRelease(value.note, value.duration, time);
      }, this._lastPartEvents).start(0);
    }

    // NOTE: position / sounding note 边界 schedule 抽成独立方法，
    // 跳转 clear 后可复用重建。
    this._scheduleUiEventsForScore(score, practiceMode, boundaryEvents);
    const _t5 = performance.now();
    console.log(
      `[perf] loadScore: cleanup=${(_t1 - _t0).toFixed(0)}ms metro=${(_t2 - _t1).toFixed(0)}ms resolveDur=${(_t3 - _t2).toFixed(0)}ms buildEvents=${(_t4 - _t3).toFixed(0)}ms uiEvents=${(_t5 - _t4).toFixed(0)}ms total=${(_t5 - _t0).toFixed(0)}ms notes=${events.length}`
    );
  }

  /**
   * 用 _lastPartEvents 重建 scorePart。
   *
   * 播放顺序跳转时 transport.cancel() 会清掉所有已 schedule 的 transport 事件，
   * 包括 Tone.Part 内部注册的 triggerAttackRelease 调度。Part 实例还在但事件
   * 全空，导致 start 后扫不到任何音符 → 完全无声。此时必须 dispose 旧 Part
   * 并用 _lastPartEvents 新建一个 Tone.Part(.start(0))。
   */
  private _rebuildScorePart(): void {
    this.disposeScorePart();
    if (this._lastPartEvents && this._lastPartEvents.length > 0) {
      this.scorePart = new Tone.Part((time, value) => {
        // 诊断日志（与 loadScore 中的一致）
        const transportTicksNow = Tone.getTransport().ticks;
        console.log('[Note triggered (rebuilt)]', {
          noteTick: value.tick,
          measure: value.measure,
          pitch: value.note,
          duration: value.duration,
          audioTime: time,
          transportTicksAtTrigger: transportTicksNow,
          tickOffsetFromTransport: value.tick - transportTicksNow,
        });
        this.accompanimentSynth.triggerAttackRelease(value.note, value.duration, time);
      }, this._lastPartEvents).start(0);
    }
  }

  /**
   * Schedule position 事件（光标跟随）与 sounding note 边界事件（键盘高亮）。
   *
   * 抽出独立方法的原因：播放顺序跳转时需让旧 UI 事件失效（否则光标会闪）。
   * 方案 A 不再逐个 transport.clear()（O(1500) 重操作），改用版本号机制：
   *   - 每次 schedule 时 ++_uiEventVersion，回调捕获当时的版本号
   *   - 跳转时 _uiEventVersion++，旧回调发现版本号不匹配直接 return
   * 这样跳转开销从 ~1500 次 clear 降到 1 次自增。
   *
   * @param boundaryEvents 可选，仅 loadScore 调用时传入（loadScore 已构建好 Map）。
   *                       跳转后重建时内部根据 score + practiceMode 重新计算。
   */
  private _scheduleUiEventsForScore(
    score: Score,
    practiceMode: PracticeMode,
    boundaryEvents?: Map<number, NoteBoundaryEvent>,
  ): void {
    const transport = Tone.getTransport();
    // 自增版本号：让上一轮 schedule 的所有回调失效（旧回调 return）
    this._uiEventVersion++;
    const myVersion = this._uiEventVersion;

    // ---- position 事件（光标跟随：每个判定组 startTick 触发）----
    score.measures.forEach((measure) => {
      const groups = groupNotesByStartTick(measure.notes);
      groups.forEach((group, groupIndex) => {
        const eventId = transport.schedule((time) => {
          // 版本号检查：跳转后版本号变了，旧回调直接 return
          if (this._uiEventVersion !== myVersion) return;
          Tone.getDraw().schedule(() => {
            // Draw 回调里再检查一次（防止跳转前已入队的 Draw 回调跳转后才执行）
            if (this._uiEventVersion !== myVersion) return;
            this.onPositionChange?.(measure.number, groupIndex);
          }, time);
        }, `${group.startTick}i`);
        this.positionEventIds.push(eventId);
      });
    });

    // ---- sounding note 边界事件（键盘高亮：note start/end tick 触发）----
    let boundaryMap = boundaryEvents;
    if (!boundaryMap) {
      // 跳转重建场景：从 score + practiceMode 重新计算 boundary 集合
      boundaryMap = new Map<number, NoteBoundaryEvent>();
      const registerBoundary = (tick: number, kind: 'starts' | 'ends', midiNumber: number): void => {
        const entry = boundaryMap!.get(tick) ?? { starts: [], ends: [] };
        entry[kind].push(midiNumber);
        boundaryMap!.set(tick, entry);
      };
      for (const measure of score.measures) {
        const soundingNotes = measure.notes.filter((note) => !note.isRest);
        const scheduledNotes = filterNotesByPracticeMode(soundingNotes, practiceMode);
        for (const note of scheduledNotes) {
          // 键盘高亮边界使用记录的音価（durationTicks），不使用 pedal 延长后的 effectiveDuration
          registerBoundary(note.startTick, 'starts', note.midiNumber);
          registerBoundary(note.startTick + note.durationTicks, 'ends', note.midiNumber);
        }
      }
    }

    Array.from(boundaryMap.entries())
      .sort(([tickA], [tickB]) => tickA - tickB)
      .forEach(([tick, { starts, ends }]) => {
        const eventId = transport.schedule((time) => {
          if (this._uiEventVersion !== myVersion) return;
          ends.forEach((midiNumber) => this.currentSoundingNotes.delete(midiNumber));
          starts.forEach((midiNumber) => this.currentSoundingNotes.add(midiNumber));
          const snapshot = new Set(this.currentSoundingNotes);
          Tone.getDraw().schedule(() => {
            if (this._uiEventVersion !== myVersion) return;
            this.onSoundingNotesChange?.(snapshot);
          }, time);
        }, `${tick}i`);
        this.soundingNoteEventIds.push(eventId);
      });
  }

  /**
   * ループ再生範囲を設定する（REQ-010-008）。`loopEnd` は
   * `practice-engine/loop-manager.ts` の意味と揃え、ループに含まれる最後の
   * 小節番号（inclusive）として扱う。無効時やスコア未読み込み時はループを解除する。
   */
  setLoopPoints(score: Score | null, enabled: boolean, loopStart: number, loopEnd: number): void {
    this.ensureInitialized();
    const transport = Tone.getTransport();
    // TASK-070: 前回のループ設定に紐づくreleaseAllスケジュールは、範囲変更・無効化の
    // いずれでも無効になるため、再設定前に必ずクリアする。
    this.clearLoopReleaseEvent();

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

    // TASK-070: ループ折り返し時、Tone.Partのイベントはループ境界で
    // triggerAttackReleaseのreleaseが範囲外になり得るため、loopEnd到達時に
    // 明示的にreleaseAll()を呼び延長中ノーツの残留を防ぐ（REQ-014-005）。
    this.loopReleaseEventId = transport.schedule(() => {
      this.accompanimentSynth.releaseAll();
    }, `${endTick}i`);
  }

  /** TASK-070: ループ折り返しのreleaseAllスケジュールを解除する（スコア差し替え・ループ再設定時）。 */
  private clearLoopReleaseEvent(): void {
    if (this.loopReleaseEventId !== null) {
      Tone.getTransport().clear(this.loopReleaseEventId);
      this.loopReleaseEventId = null;
    }
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
   * 计算指定小节（inclusive）的末尾 tick：下一小节的 startTick - 1，或最后音符的结束 tick。
   * 作为段边界跳转/停止的触发点。
   *
   * 注意：返回 startTick - 1 而非 startTick，避免 boundary 事件与下一小节的
   * 第一个音符事件落在同一 tick 上。否则 Part 可能先触发下一小节的音符，
   * 导致跳转时残留一个短促的音符（"闪一下"）。
   */
  private resolveMeasureEndTick(score: Score, measureNumber: number): number {
    const measure = score.measures.find((m) => m.number === measureNumber);
    if (!measure) return 0;
    const nextMeasure = score.measures.find((m) => m.number === measureNumber + 1);
    if (nextMeasure) return Math.max(0, nextMeasure.startTick - 1);
    return measure.notes.reduce(
      (max, note) => Math.max(max, note.startTick + note.durationTicks),
      measure.startTick
    );
  }

  /**
   * 播放顺序设置：按用户指定的小节范围注册 Transport 跳转。
   *
   * 采用"原子 stop→seek→start"方案（修复「闪」问题）：
   * - 段边界触发时，在同一 audio thread 回调内同步执行：
   *   1. transport.stop()       进入停止状态
   *   2. releaseAll + 重置 UI   清空正在响的音符
   *   3. clearSequenceEvents    清除旧 boundary 事件
   *   4. transport.ticks = X    在停止状态下 seek（不会触发音符）
   *   5. scheduleNextBoundary   重新调度下一段边界
   *   6. transport.start()      从新位置继续播放
   * - 避免了原 setTimeout 跨 frame 方案中 release tail 与新音符 overlap 的问题
   *
   * 例 "1-3, 1-3"（反复2次前3小节）：
   *   schedule endOfM3 → stop+seek(0)+start → schedule endOfM3 → stop
   *
   * loop=true 时最后一段末尾不停止，改为跳回第一段开头继续播放（真正的小节序列循环）。
   *
   * 必须在 playAccompaniment 之前调用。空字符串 = 原始顺序，不注册任何事件。
   */
  setupPlaybackSequence(score: Score, range: string, loop = false): void {
    this.ensureInitialized();
    this.clearSequenceEvents();

    // 存储 score 和 range，供 playAccompaniment(startTick) 重新调度时使用
    this._lastSetupScore = score;
    this._lastSetupRange = range;
    this._lastSetupLoop = loop;

    if (!range || range.trim() === '') return;

    let segments: PlaybackSegment[];
    try {
      segments = parseRangeIntoSegments(range);
    } catch (e) {
      console.warn('[AudioEngine] Invalid playback range:', range, e);
      return;
    }

    if (segments.length === 0) return;

    // 构建段边界数组：每个段对应一个边界事件（中间段=jump，最后段=stop）
    const transport = Tone.getTransport();

    interface SegmentBoundary {
      endTick: number;
      endMeasureNumber: number;
      action: 'jump' | 'stop';
      nextStartTick?: number;
      nextMeasure?: number;
    }

    const boundaries: SegmentBoundary[] = [];
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const endTick = this.resolveMeasureEndTick(score, seg.end);

      if (i < segments.length - 1) {
        // 中间段末尾 → 跳转到下一段开头
        const nextSeg = segments[i + 1];
        const nextStartMeasure = score.measures.find((m) => m.number === nextSeg.start);
        const nextStartTick = nextStartMeasure ? nextStartMeasure.startTick : 0;
        boundaries.push({
          endTick,
          endMeasureNumber: seg.end,
          action: 'jump',
          nextStartTick,
          nextMeasure: nextSeg.start,
        });
      } else if (loop) {
        // 循环模式：最后一段末尾 → 跳回第一段开头（真正的小节序列循环）
        const firstSeg = segments[0];
        const firstStartMeasure = score.measures.find((m) => m.number === firstSeg.start);
        const firstStartTick = firstStartMeasure ? firstStartMeasure.startTick : 0;
        boundaries.push({
          endTick,
          endMeasureNumber: seg.end,
          action: 'jump',
          nextStartTick: firstStartTick,
          nextMeasure: firstSeg.start,
        });
      } else {
        // 非循环：最后一段末尾 → 停止播放
        boundaries.push({
          endTick,
          endMeasureNumber: seg.end,
          action: 'stop',
        });
      }
    }

    // 递归调度：每次只 schedule 一个边界事件，play 之后 schedule 下一个
    // boundaryIdx 用数组引用保证闭包间共享
    const ctx = { boundaryIdx: 0 };

    const scheduleNextBoundary = (): void => {
      // 跳过已过期的 boundary：用户从中间小节开始播放时，前面的 boundary 的 endTick
      // 已小于当前 transport.ticks，Tone.js 不会触发已过期的 schedule 事件，
      // 如果不跳过会导致 scheduleNextBoundary 卡在 boundaries[0] 永远不前进。
      // 这里直接跳到第一个 endTick > transport.ticks 的 boundary。
      const currentTicks = transport.ticks;
      while (ctx.boundaryIdx < boundaries.length && boundaries[ctx.boundaryIdx].endTick <= currentTicks) {
        ctx.boundaryIdx++;
      }
      if (ctx.boundaryIdx >= boundaries.length) {
        if (loop && boundaries.length > 0) {
          // 循环模式：一轮结束（最后一段已跳回第一段开头），从第一段 boundary 重新开始。
          // 此时 transport.ticks 已回到第一段起点，endTick 均大于该点，不会死循环。
          ctx.boundaryIdx = 0;
        } else {
          return;
        }
      }
      const b = boundaries[ctx.boundaryIdx];

      // 关键修复：jump boundary 的注册位置需要提前，提前量基于 Tone.js 源码确认的机制精准计算
      //
      // 触发规则（Transport.ts / Clock.ts / TickSource.ts 源码确认）：
      //   1. Clock._loop 每 updateInterval（默认 0.03s）运行一次
      //   2. _loop 处理窗口 [lastEnd, now()]，其中 now() = currentTime + lookAhead(0.1s)
      //   3. forEachTickBetween 的 while 循环遍历窗口内所有 tick，逐个调用 _processTick 触发事件
      //   4. boundary 回调中的 pause() 不中断 while 循环 → 同窗口内事件仍被触发
      //
      // 为什么 lookAhead 不出现在公式里：
      //   连续两次 _loop 的 endTime 差 = updateInterval（lookAhead 同时加在两端被消掉）
      //   所以最坏情况只需 nextEventTick 落入"下一个"_loop 窗口即可
      //
      // nextEventTick 必须取以下两者的较小者（旧版本只取 nextNoteTick 导致 4→6 跳5 bug）：
      //   nextNoteTick    : endTick 之后第一个音符的 tick（practiceMode 过滤后，来自 _lastPartEvents）
      //   nextPositionTick: endTick 之后第一个判定组 position 事件的 tick（不过滤 practiceMode）
      //                     左手练习模式下第5小节第1拍有左手音符但右手没有时，
      //                     nextPositionTick < nextNoteTick，只看音符会漏判，导致
      //                     position 事件在同窗口触发 → Draw.schedule 覆盖 boundary 设的光标 → 闪第5小节
      //
      // 动态 safetyMargin（根据用户建议，按末尾音符时值调整）：
      //   - 长音符（≥4分音符，480 tick @ PPQ=480）：截短不明显，margin=2 防 Ticker 波动
      //   - 短音符（<4分音符）：截短比例高，margin=0 尽可能减少截短
      //
      // 公式：scheduleTick = min(endTick, nextEventTick - updateIntervalTicks - safetyMargin)
      let scheduleTick = b.endTick;
      if (b.action === 'jump' && this._lastPartEvents && this._lastPartEvents.length > 0) {
        // (1) nextNoteTick：endTick 之后第一个发音音符的 tick（已按 practiceMode 过滤）
        let nextNoteTick = Infinity;
        for (const e of this._lastPartEvents) {
          if (e.tick > b.endTick) {
            nextNoteTick = e.tick;
            break;
          }
        }

        // (2) nextPositionTick：endTick 之后第一个 position 事件的 tick（判定组 startTick）
        // 注：position 事件不过滤 practiceMode 也不包含 isRest，必须单独找，不能复用 nextNoteTick
        let nextPositionTick = Infinity;
        for (const measure of score.measures) {
          const groups = groupNotesByStartTick(measure.notes);
          for (const g of groups) {
            if (g.startTick > b.endTick && g.startTick < nextPositionTick) {
              nextPositionTick = g.startTick;
            }
          }
        }

        const nextEventTick = Math.min(nextNoteTick, nextPositionTick);

        if (nextEventTick !== Infinity) {
          // updateIntervalTicks：while 循环在本 _loop 内最大的跨度
          const updateIntervalSec = (Tone.context as unknown as { updateInterval: number }).updateInterval;
          const bpm = transport.bpm.value;
          const ppq = transport.PPQ;
          const updateIntervalTicks = Math.ceil(updateIntervalSec * bpm / 60 * ppq);

          // (3) 动态 safetyMargin：基于 b.endMeasureNumber 小节最后一个非 rest 音符的 duration
          let lastNoteDurationTicks = 0;
          const endMeasure = score.measures.find((m) => m.number === b.endMeasureNumber);
          if (endMeasure) {
            const playingNotes = endMeasure.notes.filter((n) => !n.isRest);
            if (playingNotes.length > 0) {
              // 找到"最晚结束"的那个音符（按 startTick+durationTicks，不是 startTick）
              let lastEndTick = -1;
              for (const n of playingNotes) {
                const endT = n.startTick + n.durationTicks;
                if (endT > lastEndTick) {
                  lastEndTick = endT;
                  lastNoteDurationTicks = n.durationTicks;
                }
              }
            }
          }
          // ppq = 每 4分音符的 tick 数，< ppq 即 < 4分音符，按短音符处理
          const safetyMargin = lastNoteDurationTicks >= ppq ? 2 : 0;

          const maxScheduleTick = nextEventTick - updateIntervalTicks - safetyMargin;
          scheduleTick = Math.min(b.endTick, Math.max(0, maxScheduleTick));

          console.log('[AudioEngine] jump boundary 精准提前', {
            originalEndTick: b.endTick,
            endMeasure: b.endMeasureNumber,
            nextNoteTick,
            nextPositionTick,
            nextEventTick,
            scheduleTick,
            advanceTicks: b.endTick - scheduleTick,
            updateIntervalTicks,
            safetyMargin,
            lastNoteDurationTicks,
            isShortNote: lastNoteDurationTicks > 0 && lastNoteDurationTicks < ppq,
            updateIntervalSec,
            bpm,
            ppq,
          });
        }
      }

      const eventId = transport.schedule((_time) => {
        ctx.boundaryIdx++;

        if (b.action === 'jump' && b.nextStartTick !== undefined) {
          // pause 方案：seek 不产生 stop/start 预热 gap
          //
          // 之前发现 started 状态下 transport.ticks = X 不生效（getter 会用
          // audioContext.currentTime 动态计算覆盖 set 的值，详见 Tone.Clock）。
          // stop() 能改 ticks 但会重置 lookAhead 预热 → ~100ms gap。
          //
          // pause() 是折中：进入 paused 状态后 getter 不再动态计算，set ticks 生效；
          // pause 不重置 lookAhead 预热，恢复 start 时 gap 远小于 stop（~20-40ms）。
          //
          // 副作用（用户主动关闭静音，用于观察验证）：
          //   lookAhead 预调度了 endTick 之后的下一小节开头 attack，改 ticks 后
          //   这些已发往 audio context 的 attack 仍会响 → 跳转会听到下一小节
          //   开头几个音 + 目标小节开头音的"杂音叠加"。用户需要用听感验证是否
          //   能接受，后续再决定是否加回静音窗口或用 cancel() 精准消除。

          // ========== ========== ==========
          // 性能诊断日志
          // ========== ========== ==========
          const t0 = performance.now();

          console.log('[AudioEngine] Jump triggered', {
            boundaryIdx: ctx.boundaryIdx - 1,
            endTick: b.endTick,
            nextStartTick: b.nextStartTick,
            nextMeasure: b.nextMeasure,
            ticksBefore: transport.ticks,
            state: transport.state,
            scheduledTime: _time,
            wallTimeAtTrigger: t0,
          });

          // --- Step 1：pause() 暂停（和手动"暂停"按钮完全一致）---
          // 进入 paused 状态后，ticks setter 生效，start() 从 paused 恢复
          // 不回头扫描 Part 事件，不会补发（用户手动操作日志已验证）。
          transport.pause();
          const t1 = performance.now();

          // --- Step 2：paused 态改 ticks = nextStartTick（和手动"调光标"一致）---
          // paused 状态下 ticks getter 返回存储值不动态计算，set 能稳定保留。
          console.log('[Jump] before: ticks =', transport.ticks, 'state =', transport.state);
          transport.ticks = b.nextStartTick;
          console.log('[Jump] after:  ticks =', transport.ticks, 'state =', transport.state);
          const t2 = performance.now();

          // --- Step 3：releaseAll + resetSoundingNotes（和 pauseAccompaniment 一致）---
          // 注意：不传 _time，用默认 Tone.now()（和手动操作的 releaseAll() 行为一致）。
          // 之前传 _time 触发了 Tone.js "scheduled callbacks should use passed scheduling time"
          // 警告，可能导致 release 时机异常。
          this.accompanimentSynth.releaseAll();
          this.resetSoundingNotes();
          this.onSoundingNotesChange?.(new Set());
          this.onPositionChange?.(b.nextMeasure!, 0);
          const t3 = performance.now();

          // --- Step 4：清除旧 boundary 事件（只清跳转 boundary，不清 position/sounding）---
          this.clearSequenceEvents();
          const t4 = performance.now();

          // --- Step 5：start() 恢复播放（和手动"按播放"一致）---
          // 从 paused 的 nextStartTick 位置恢复，Part 不动，不需要 cancel/rebuild。
          // start() 不带 offset，在 paused 状态下恢复不是从 0 启动，
          // 不会触发 "回头扫描补发错过事件" 行为（手动操作已验证不补）。
          transport.start();
          this.metronome.setTransportRunning(true);
          const t5 = performance.now();

          // --- Step 6：Draw.schedule 覆盖本帧 UI 状态（最后写赢，解决光标闪）---
          Tone.getDraw().schedule(() => {
            const drawT = performance.now();
            console.log('[AudioEngine][TIMING] Draw.schedule 实际执行', {
              delayMsFromTrigger: drawT - t0,
              measure: b.nextMeasure,
              groupIndex: 0,
              transportTicksNow: transport.ticks,
            });
            this.onSoundingNotesChange?.(new Set());
            this.onPositionChange?.(b.nextMeasure!, 0);
            console.log('[AudioEngine] Draw: UI state synced', {
              measure: b.nextMeasure,
              groupIndex: 0,
              transportTicksNow: transport.ticks,
            });
          }, _time);
          const t6 = performance.now();

          // --- Step 7：重新调度下一段 boundary ---
          scheduleNextBoundary();
          const t7 = performance.now();

          console.log('[AudioEngine] After seek (pause → seek → start)', {
            ticksAfter: transport.ticks,
            stateAfter: transport.state,
            scorePartExists: this.scorePart !== null,
            remainingSequenceEvents: this.sequenceEventIds.length,
            remainingPositionEvents: this.positionEventIds.length,
            remainingSoundingNoteEvents: this.soundingNoteEventIds.length,
          });

          // ========== ========== ==========
          // 性能诊断输出
          // ========== ========== ==========
          console.log('[AudioEngine][TIMING] Jump 各步骤耗时 ms', {
            'total  callback 全程': +(t7 - t0).toFixed(2),
            'step1  pause': +(t1 - t0).toFixed(2),
            'step2  ticks=nextStartTick': +(t2 - t1).toFixed(2),
            'step3  releaseAll+reset+UI': +(t3 - t2).toFixed(2),
            'step4  clearSequenceEvents': +(t4 - t3).toFixed(2),
            'step5  start+metronome': +(t5 - t4).toFixed(2),
            'step6  Draw.schedule(register)': +(t6 - t5).toFixed(2),
            'step7  scheduleNextBoundary': +(t7 - t6).toFixed(2),
            ticksElapsed: transport.ticks - b.nextStartTick,
          });
        } else if (b.action === 'stop') {
          // 最后一段末尾：停止播放，不 schedule 后续
          this.stopAccompaniment();
          this.clearSequenceEvents();
        }
      }, `${scheduleTick}i`);

      this.sequenceEventIds.push(eventId);
    };

    scheduleNextBoundary();
  }

  /** 清理播放顺序跳转事件（乐谱切换/停止时调用）。 */
  private clearSequenceEvents(): void {
    const transport = Tone.getTransport();
    this.sequenceEventIds.forEach((id) => transport.clear(id));
    this.sequenceEventIds = [];
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
    const transport = Tone.getTransport();
    if (startTick !== undefined) {
      // Transport.start(undefined, `${tick}i`) のoffset引数は一時停止状態からの
      // 再開時に反映されないことがある（2026-07-05 実機フィードバック）。
      // そのため stopped/paused どちらの状態でも確実に効く Transport.ticks への
      // 明示代入でシークしてから開始する（Tone.js公式のシーク手法）。
      transport.ticks = startTick;

      // 用户从中间小节开始播放时，之前 setupPlaybackSequence 注册的 boundary
      // 可能已过期（endTick < startTick），Tone.js 不会触发已过期的 schedule 事件，
      // 导致跳转永远不会执行。这里重新调用 setupPlaybackSequence，让它根据当前
      // transport.ticks 跳过已过期的 boundary，从正确的位置开始 schedule。
      if (this._lastSetupScore && this._lastSetupRange.trim() !== '') {
        this.setupPlaybackSequence(this._lastSetupScore, this._lastSetupRange, this._lastSetupLoop);
      }
    }
    transport.start();
    // TASK-066: 再生開始でメトロノームの独立クロックを止め、楽譜同期の
    // Sequenceへ切り替える（REQ-006-009）。
    this.metronome.setTransportRunning(true);
  }

  stopAccompaniment(): void {
    this.ensureInitialized();
    Tone.getTransport().stop();
    this.resetSoundingNotes();
    // TASK-070: ペダル延長中のノーツが停止後も残留しないよう解放する（REQ-014-005）。
    this.accompanimentSynth.releaseAll();
    // TASK-066: 停止時、メトロノームが有効なら独立クロックへ戻す
    // （REQ-006-009）。
    this.metronome.setTransportRunning(false);
    this.onStop?.();
  }

  pauseAccompaniment(): void {
    this.ensureInitialized();
    Tone.getTransport().pause();
    this.resetSoundingNotes();
    // TASK-070: ペダル延長中のノーツが一時停止後も残留しないよう解放する（REQ-014-005）。
    this.accompanimentSynth.releaseAll();
    // TASK-066: 一時停止時、メトロノームが有効なら独立クロックへ戻す
    // （REQ-006-009）。
    this.metronome.setTransportRunning(false);
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

  /** TASK-057: スコア差し替え時に、前回の発音境界（開始/終了）スケジュールを解除する。 */
  private clearSoundingNoteEvents(): void {
    const transport = Tone.getTransport();
    this.soundingNoteEventIds.forEach((id) => transport.clear(id));
    this.soundingNoteEventIds = [];
  }

  /**
   * TASK-057: 発音中ノーツ集合をクリアし、購読者へ空集合を通知する
   * （停止・一時停止・スコア差し替え時）。
   */
  private resetSoundingNotes(): void {
    this.currentSoundingNotes = new Set();
    this.onSoundingNotesChange?.(new Set());
  }

  /**
   * リソースを解放する。StrictModeのエフェクト再実行に耐えるため、冪等にする
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
    this.clearSoundingNoteEvents();
    this.clearSequenceEvents();
    this.clearLoopReleaseEvent();
    this.currentSoundingNotes = new Set();

    // TASK-106: 保留中のロード上限タイマーを解除する。破棄後に発火させると、
    // 使われないフォールバック音源をTone.js上に生成してしまう。
    this.clearVoiceLoadTimeout();

    // TASK-106: 破棄後に届くサンプルロードのonload/onerrorを「古い世代」とみなさせ、
    // 破棄済みインスタンスへの状態反映（およびフォールバック生成物の残留）を防ぐ。
    // 次回の ensureInitialized() がさらに世代を採番するため、再初期化には影響しない。
    this.voiceGeneration += 1;

    this.initialized = false;
  }
}
