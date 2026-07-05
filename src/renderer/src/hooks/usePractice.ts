import { useMemo, useEffect, useCallback, useState } from 'react';
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
 * `judgement.note` は現在の判定グループの代表ノート（practice-engine側の
 * `filteredExpected[0]`）であり、その noteId を緑/赤にハイライトする。
 * 'ignored' や note が存在しない場合は何もしない。
 */
function applyJudgementHighlight(
  judgement: NoteJudgement,
  setNoteHighlights: (updater: (prev: NoteHighlights) => NoteHighlights) => void
): void {
  if (judgement.result === 'ignored' || !judgement.note) return;
  const noteId = judgement.note.id;
  const color = judgement.result;
  setNoteHighlights((prev) => ({ ...prev, [noteId]: color }));
}

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
  const currentMeasure = usePracticeStore((s) => s.currentMeasure);
  const currentNoteIndex = usePracticeStore((s) => s.currentNoteIndex);
  const score = usePracticeStore((s) => s.score);
  const loopEnabled = usePracticeStore((s) => s.loopEnabled);
  const loopStart = usePracticeStore((s) => s.loopStart);
  const loopEnd = usePracticeStore((s) => s.loopEnd);

  // 正誤判定結果に応じた楽譜上のハイライト（REQ-004-003/004）。
  // ScoreRenderer に noteId -> 'correct'|'incorrect' のマップとして渡し、
  // OSMDController.highlightNote に反映してもらう（結線はScoreRenderer側）。
  const [noteHighlights, setNoteHighlights] = useState<NoteHighlights>({});

  // 判定グループが進む（次の音符/小節へ移動する）たびに、直前のハイライトは
  // 役目を終えたものとしてクリアする。これによりハイライトは「現在判定中の
  // グループに対するフィードバック」として一時的に表示される。
  useEffect(() => {
    setNoteHighlights({});
  }, [currentMeasure, currentNoteIndex]);

  // ストアの bpm / metronomeEnabled 変更を AudioEngine に同期する。
  // AudioEngine 側のメソッドはストアを変更しないため、無限ループは発生しない。
  useEffect(() => {
    audioEngine.setBpm(bpm);
  }, [audioEngine, bpm]);

  useEffect(() => {
    audioEngine.setMetronomeEnabled(metronomeEnabled);
  }, [audioEngine, metronomeEnabled]);

  // ループ有効時、audioEngine（Tone.Transport）側のループ範囲を同期する
  // （REQ-010-008）。無効時やスコア未読み込み時は audioEngine 側で解除される。
  useEffect(() => {
    audioEngine.setLoopPoints(score, loopEnabled, loopStart, loopEnd);
  }, [audioEngine, score, loopEnabled, loopStart, loopEnd]);

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
      applyJudgementHighlight(judgement, setNoteHighlights);
    },
    [practiceEngine, audioEngine]
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
   */
  const handleKeyClick = useCallback(
    (midiNumber: number) => {
      const judgement = practiceEngine.handleNoteOn({
        midiNumber,
        velocity: 100,
        type: 'note-on',
        timestamp: Date.now(),
      });
      playJudgementSound(judgement, audioEngine);
      applyJudgementHighlight(judgement, setNoteHighlights);

      setTimeout(() => {
        practiceEngine.handleNoteOff({
          midiNumber,
          velocity: 0,
          type: 'note-off',
          timestamp: Date.now(),
        });
      }, 200); // Simulate momentary click
    },
    [practiceEngine, audioEngine]
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
