import { useMemo, useEffect, useCallback } from 'react';
import { PracticeEngineService } from '../lib/practice-engine';
import { AudioEngineService } from '../lib/audio-engine';
import { WebMidiService } from '../lib/midi/web-midi';
import { usePracticeStore } from '../store';
import { useMidi } from './useMidi';
import type { NoteJudgement } from '../types';

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

  // ストアの bpm / metronomeEnabled 変更を AudioEngine に同期する。
  // AudioEngine 側のメソッドはストアを変更しないため、無限ループは発生しない。
  useEffect(() => {
    audioEngine.setBpm(bpm);
  }, [audioEngine, bpm]);

  useEffect(() => {
    audioEngine.setMetronomeEnabled(metronomeEnabled);
  }, [audioEngine, metronomeEnabled]);

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

  return { practiceEngine, audioEngine, handleKeyClick };
}
