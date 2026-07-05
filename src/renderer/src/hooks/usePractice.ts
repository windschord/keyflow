import { useMemo, useEffect, useCallback, useState, useRef } from 'react';
import { PracticeEngineService } from '../lib/practice-engine';
import { AudioEngineService } from '../lib/audio-engine';
import { WebMidiService } from '../lib/midi/web-midi';
import { usePracticeStore } from '../store';
import { useMidi } from './useMidi';
import type { NoteJudgement } from '../types';

/** noteId -> 正誤ハイライト色。ScoreRenderer の noteHighlights prop にそのまま渡す形。 */
export type NoteHighlights = Record<string, 'correct' | 'incorrect'>;

/**
 * AudioEngineService が提供する効果音再生メソッドの最小インターフェース。
 * テスト用モックの注入を容易にするため、クラス全体ではなく必要なメソッドのみを要求する。
 */
interface JudgementAudioEngine {
  playCorrectSound: () => void;
  playIncorrectSound: () => void;
}

/**
 * 正誤判定結果に応じて対応する効果音を再生する。
 * 'ignored'（練習対象外の音・スコア未読み込み時等）では何も鳴らさない。
 */
function playJudgementSound(judgement: NoteJudgement, audioEngine: JudgementAudioEngine): void {
  if (judgement.result === 'correct') {
    audioEngine.playCorrectSound();
  } else if (judgement.result === 'incorrect') {
    audioEngine.playIncorrectSound();
  }
}

/**
 * 正誤判定結果を noteHighlights ステートに反映する（REQ-004-003/004）。
 * `judgement.note` は現在の判定グループの代表ノート
 * （practice-engine側の `filteredExpected[0]`）であり、その noteId を
 * 緑/赤にハイライトする。
 * 'ignored' や note が存在しない場合は何もしない。
 * ハイライトを設定した場合、`onHighlighted` を呼び出して自動クリアの
 * タイマーを（再）スケジュールさせる（CodeRabbit PR#25指摘#2）。
 */
function applyJudgementHighlight(
  judgement: NoteJudgement,
  setNoteHighlights: (updater: (prev: NoteHighlights) => NoteHighlights) => void,
  onHighlighted: (noteId: string) => void
): void {
  if (judgement.result === 'ignored' || !judgement.note) return;
  const noteId = judgement.note.id;
  const color = judgement.result;
  setNoteHighlights((prev) => ({ ...prev, [noteId]: color }));
  onHighlighted(noteId);
}

/** 正誤ハイライトを自動で消すまでの表示時間（ミリ秒）。CodeRabbit PR#25指摘#2。 */
const HIGHLIGHT_CLEAR_DELAY_MS = 800;

export function usePractice() {
  const { practiceEngine, audioEngine, webMidiService } = useMemo(() => {
    // Instead of passing store.getState() which the PracticeEngineService modifies directly,
    // we need to pass an object that implements the expected interface, but writes to Zustand state.
    // However, for now we will pass a proxy or change PracticeEngineService directly.
    // Given the prompt, I should refactor PracticeEngineService to use getState() and setState() correctly.
    const practiceEngine = new PracticeEngineService(usePracticeStore); // We will fix PracticeEngineService
    const audioEngine = new AudioEngineService();
    const webMidiService = new WebMidiService();

    return { practiceEngine, audioEngine, webMidiService };
  }, []);

  const bpm = usePracticeStore((s) => s.bpm);
  const metronomeEnabled = usePracticeStore((s) => s.metronomeEnabled);
  const volume = usePracticeStore((s) => s.volume);
  const score = usePracticeStore((s) => s.score);
  const practiceMode = usePracticeStore((s) => s.practiceMode);
  const loopEnabled = usePracticeStore((s) => s.loopEnabled);
  const loopStart = usePracticeStore((s) => s.loopStart);
  const loopEnd = usePracticeStore((s) => s.loopEnd);

  // 正誤判定結果に応じた楽譜上のハイライト（REQ-004-003/004）。
  // ScoreRenderer に noteId -> 'correct'|'incorrect' のマップとして渡し、
  // OSMDController.highlightNote に反映してもらう（結線はScoreRenderer側）。
  const [noteHighlights, setNoteHighlights] = useState<NoteHighlights>({});

  // ハイライトごとの自動クリア用タイマーを noteId 単位で管理する
  // （CodeRabbit PR#25指摘#2）。
  //
  // 従来は「判定グループが進んだら直前のハイライトを一括クリアする」
  // useEffect（currentMeasure/currentNoteIndex依存）を使っていたが、
  // practiceEngine.handleNoteOn は正解完了時に位置を進めてから判定結果を
  // 返すため、この useEffect が判定直後に走ってしまい、正解の緑ハイライトが
  // 表示された瞬間に消える不具合があった。位置変化ではなく、判定ごとに
  // 固定時間（HIGHLIGHT_CLEAR_DELAY_MS）後にその noteId のみを消すタイマー
  // 方式に変更する。同一 noteId が再度判定された場合はタイマーをリセットする。
  const highlightTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const scheduleHighlightClear = useCallback((noteId: string) => {
    const timeouts = highlightTimeoutsRef.current;
    const existing = timeouts.get(noteId);
    if (existing) {
      clearTimeout(existing);
    }
    const timeoutId = setTimeout(() => {
      setNoteHighlights((prev) => {
        if (!(noteId in prev)) return prev;
        const next = { ...prev };
        delete next[noteId];
        return next;
      });
      timeouts.delete(noteId);
    }, HIGHLIGHT_CLEAR_DELAY_MS);
    timeouts.set(noteId, timeoutId);
  }, []);

  // アンマウント時に未消化のタイマーをすべて破棄する。
  useEffect(() => {
    const timeouts = highlightTimeoutsRef.current;
    return () => {
      timeouts.forEach((timeoutId) => clearTimeout(timeoutId));
      timeouts.clear();
    };
  }, []);

  // ストアの bpm / metronomeEnabled 変更を AudioEngine に同期する。
  // AudioEngine 側のメソッドはストアを変更しないため、無限ループは発生しない。
  useEffect(() => {
    audioEngine.setBpm(bpm);
  }, [audioEngine, bpm]);

  useEffect(() => {
    audioEngine.setMetronomeEnabled(metronomeEnabled);
  }, [audioEngine, metronomeEnabled]);

  // ストアの volume（マスターボリューム、TASK-052）変更を AudioEngine に同期する。
  // bpm/metronomeEnabled と同じパターン（AudioEngine側のメソッドはストアを変更しない
  // ため無限ループは発生しない）。
  useEffect(() => {
    audioEngine.setMasterVolume(volume);
  }, [audioEngine, volume]);

  // ループ有効時、audioEngine（Tone.Transport）側のループ範囲を同期する
  // （REQ-010-008）。無効時やスコア未読み込み時は audioEngine 側で解除される。
  useEffect(() => {
    audioEngine.setLoopPoints(score, loopEnabled, loopStart, loopEnd);
  }, [audioEngine, score, loopEnabled, loopStart, loopEnd]);

  // スコア読み込み時・practiceMode変更時に audioEngine の再生スケジュールを
  // 同期する（TASK-051、REQ-010-010）。practiceMode は再生対象パートの絞り込み
  // （左手練習=左手のみ、右手練習=右手のみ、両手=全パート）に使う。
  //
  // 再生中にこの同期が走った場合（practiceModeの切替、または再生中の新規スコア
  // 読み込み）は、鳴っている音と新しいスケジュールが食い違うため、いったん停止
  // する（最小実装として「停止中の切替は次回再生から即座に反映、再生中の切替は
  // 停止する」を選択。US-010 追補に明記）。停止時の位置復帰は既存の
  // setOnStop 結線（REQ-010-004）がそのまま担う。
  useEffect(() => {
    if (!score) return;

    audioEngine.loadScore(score, practiceMode);

    const latest = usePracticeStore.getState();
    if (latest.playbackState === 'playing') {
      audioEngine.stopAccompaniment();
      latest.setPlaybackState('stopped');
    }
  }, [audioEngine, score, practiceMode]);

  // 再生位置→カーソル連動（REQ-010-005）。audioEngine が判定グループ
  // （同一startTick）を通過するたびに practiceEngine 側の
  // currentMeasure/currentNoteIndex を更新する。
  useEffect(() => {
    audioEngine.setPositionCallback((measureNumber, groupIndex) => {
      practiceEngine.advanceToPlaybackPosition(measureNumber, groupIndex);
    });

    return () => {
      audioEngine.setPositionCallback(null);
    };
  }, [audioEngine, practiceEngine]);

  // 停止操作時、先頭（ループ有効時はループ開始小節）に位置を復帰する
  // （REQ-010-004）。ストアの最新値を参照するため useEffect の依存には含めず、
  // コールバック内で都度 getState() する。
  useEffect(() => {
    audioEngine.setOnStop(() => {
      const latest = usePracticeStore.getState();
      practiceEngine.resetToMeasure(latest.loopEnabled ? latest.loopStart : 1);
    });

    return () => {
      audioEngine.setOnStop(null);
    };
  }, [audioEngine, practiceEngine]);

  // useMidi の onNoteOn/onNoteOff は useEffect の依存配列に含まれるため、
  // useCallback で参照を固定し、bpm/metronomeEnabled の変更による再レンダーの
  // たびに MIDI 接続が不要に再初期化されることを防ぐ。
  const handleMidiNoteOn = useCallback(
    (noteNumber: number, velocity: number, _channel: number) => {
      const judgement = practiceEngine.handleNoteOn({
        midiNumber: noteNumber,
        velocity,
        type: 'note-on',
        timestamp: Date.now(),
      });
      playJudgementSound(judgement, audioEngine);
      applyJudgementHighlight(judgement, setNoteHighlights, scheduleHighlightClear);
    },
    [practiceEngine, audioEngine, scheduleHighlightClear]
  );

  const handleMidiNoteOff = useCallback(
    (noteNumber: number, velocity: number, _channel: number) => {
      practiceEngine.handleNoteOff({
        midiNumber: noteNumber,
        velocity,
        type: 'note-off',
        timestamp: Date.now(),
      });
    },
    [practiceEngine]
  );

  useMidi(webMidiService, handleMidiNoteOn, handleMidiNoteOff);

  // TASK-034: 実起動E2Eテスト（Playwright for Electron）向けの計装。
  // 実MIDIハードウェアが接続されていない環境（CI/開発機）でも正誤判定・カーソル
  // 進行の結線を検証できるよう、実際のMIDI受信時に呼ばれるのと同じコールバック
  // （handleMidiNoteOn/handleMidiNoteOff）をwindowに公開する。テスト専用の分岐
  // ロジックは持たず、本番のMIDI処理経路をそのまま呼び出す点に注意。
  useEffect(() => {
    (
      window as unknown as {
        __e2eMidiHooks__?: {
          noteOn: typeof handleMidiNoteOn;
          noteOff: typeof handleMidiNoteOff;
        };
      }
    ).__e2eMidiHooks__ = { noteOn: handleMidiNoteOn, noteOff: handleMidiNoteOff };

    return () => {
      delete (window as unknown as { __e2eMidiHooks__?: unknown }).__e2eMidiHooks__;
    };
  }, [handleMidiNoteOn, handleMidiNoteOff]);

  /**
   * 画面上のピアノ鍵盤クリックによる擬似的な NoteOn/NoteOff を処理する。
   * MIDI入力経由と同じ判定結果に応じた効果音フィードバックを発火させる。
   *
   * REQ-005-006: クリックした音自体も鳴らす。正誤フィードバック音（playCorrectSound/
   * playIncorrectSound）とは別チャンネル（playSynth）で鳴らすため、同時発音しても
   * 音色が重ならず干渉しない。実際の鍵盤演奏で「押した音が聞こえる」体験に合わせる。
   */
  const handleKeyClick = useCallback(
    (midiNumber: number) => {
      audioEngine.playNote(midiNumber);

      const judgement = practiceEngine.handleNoteOn({
        midiNumber,
        velocity: 100,
        type: 'note-on',
        timestamp: Date.now(),
      });
      playJudgementSound(judgement, audioEngine);
      applyJudgementHighlight(judgement, setNoteHighlights, scheduleHighlightClear);

      setTimeout(() => {
        practiceEngine.handleNoteOff({
          midiNumber,
          velocity: 0,
          type: 'note-off',
          timestamp: Date.now(),
        });
      }, 200); // Simulate momentary click
    },
    [practiceEngine, audioEngine, scheduleHighlightClear]
  );

  useEffect(() => {
    return () => {
      audioEngine.dispose();
    };
  }, [audioEngine]);

  // TASK-045: SettingsModalがMIDI入力デバイス一覧の表示・選択（REQ-004-008）を
  // 行うには、useMidi/webMidiServiceと同一のインスタンスに直接アクセスできる
  // 必要があるため、公開する（App.tsxからpropとして渡す）。
  return { practiceEngine, audioEngine, webMidiService, handleKeyClick, noteHighlights };
}
