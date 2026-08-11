import React, { useCallback, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { usePracticeStore } from '../../store';
import { useTranslation } from '../../lib/i18n/useTranslation';
import { withTimeout } from '../../lib/audio-engine/with-timeout';
import type { Score } from '../../types';

/**
 * `Tone.start()` の完了を待つ上限時間（TASK-106）。
 *
 * ChromiumのAudioContext.resumeは、音声出力デバイスを開けない環境では
 * 決着しないまま留まることがある。上限を設けないと再生ボタンのクリックが
 * 永久に決着せず、画面上は一切変化しない状態になる。
 * 分析: docs/sdd/troubleshooting/2026-08-11-portable-play-no-response/analysis.md
 */
export const AUDIO_START_TIMEOUT_MS = 5_000;

/**
 * 再生開始要求（音色のロード待ちを含む）の完了を待つ上限時間（TASK-106）。
 * `AudioEngineService` 側にもサンプルロードの上限（`SAMPLE_LOAD_TIMEOUT_MS`）があるが、
 * ここはUI側の最終防衛線であり、想定外の未決着Promiseでもボタンを無反応のままにしない。
 */
export const PLAY_REQUEST_TIMEOUT_MS = 30_000;

// TASK-075: 1行ヘッダー統合に伴い、高さを44px→36pxへコンパクト化する。
const BTN_STYLE: React.CSSProperties = {
  height: '36px',
  padding: '0 12px',
  fontSize: '14px',
  borderRadius: '6px',
  border: '1px solid #9ca3af',
  backgroundColor: 'white',
  cursor: 'pointer',
};

const BTN_DISABLED_STYLE: React.CSSProperties = {
  ...BTN_STYLE,
  opacity: 0.5,
  cursor: 'not-allowed',
};

/**
 * AudioEngineService が提供する再生系メソッドの最小インターフェース。
 * テスト用モックの注入を容易にするため、クラス全体ではなく必要なメソッドのみを要求する。
 */
export interface PlaybackAudioEngine {
  /**
   * REQ-013-003, TASK-073: 再生音色のロード待ち（App.tsx側のラッパーが
   * audioEngine.ensurePlaybackVoiceLoaded()を内包する）を反映できるよう、
   * Promiseを返してもよい。PlaybackControls側はこれを待ってから
   * playbackStateを'playing'にする。
   */
  playAccompaniment: () => void | Promise<void>;
  pauseAccompaniment: () => void;
  stopAccompaniment: () => void;
}

interface PlaybackControlsProps {
  audioEngine?: PlaybackAudioEngine;
  /**
   * 現在読み込まれている楽譜（REQ-010-002）。
   * `null` の場合は楽譜未読込として再生系ボタンを無効化しツールチップで理由を示す。
   * `undefined`（未指定）の場合は呼び出し側が楽譜有無を管理していないとみなし、
   * 後方互換のため無効化しない（既存の呼び出し・テストへの影響を避けるため）。
   */
  score?: Score | null;
}

/**
 * 曲の再生・一時停止・停止を操作するツールバー部品（暫定実装）。
 *
 * - Spaceキーで再生/一時停止をトグルする
 * - 初回の再生操作でのみ Tone.start() を呼び、AudioContext を解放する
 * - 再生状態（playing/paused/stopped）は Zustand store で一元管理する
 */
export const PlaybackControls: React.FC<PlaybackControlsProps> = ({ audioEngine, score }) => {
  const { playbackState, setPlaybackState, voiceLoading } = usePracticeStore();
  const t = useTranslation();
  const toneStartedRef = useRef(false);
  // TASK-106: 再生開始要求の実行中フラグ。playbackStateが'playing'になるのは
  // 開始処理の完了後であり、それまでボタンは押下可能なままだった。上限時間を最大
  // 30秒まで待つようになったことで再入の窓が広がり、連打すると複数の開始要求が
  // 並行する。先行要求が後からタイムアウトすると、成功済みの状態を巻き戻して
  // 不要なエラーダイアログを出してしまう（CodeRabbit PR#77指摘）。
  // refで再入を弾き、stateでボタンを無効化して再描画する。
  const startingRef = useRef(false);
  const [isStarting, setIsStarting] = React.useState(false);
  // score === null のときだけ「未読込」として無効化する。undefined（未指定）は
  // 呼び出し側が楽譜有無を渡していないケースであり、後方互換のため無効化しない。
  const noScoreLoaded = score === null;

  /**
   * AudioContextを起動し、`running` 状態へ遷移したことを確認する。
   *
   * TASK-106: AudioContextは起動後でも `suspended` へ戻ることがある（出力デバイスの
   * 切り替え等）。`toneStartedRef` だけで早期returnすると、その状態のまま検証を飛ばし、
   * 無音のまま「再生中」へ遷移してしまう。
   * 起動済みフラグと現在の状態の両方が揃ったときだけ再起動を省略する（CodeRabbit PR#77指摘）。
   */
  const ensureToneStarted = useCallback(async () => {
    if (toneStartedRef.current && Tone.getContext().state === 'running') return;

    await withTimeout(Tone.start(), AUDIO_START_TIMEOUT_MS, 'Tone.start()');

    // TASK-106: `Tone.start()` が解決しても AudioContext が running にならない環境
    // （音声出力デバイスを開けない等）では、以降のTransportが進まず無音・カーソル停止に
    // なる。その場合はエラーとして扱い、無反応ではなく理由を提示する。
    const contextState = Tone.getContext().state;
    if (contextState !== 'running') {
      throw new Error(`AudioContext is not running (state: ${contextState})`);
    }

    toneStartedRef.current = true;
  }, []);

  /**
   * 再生を開始する。失敗・タイムアウトは必ずダイアログで利用者へ通知する（TASK-106）。
   */
  const handlePlay = useCallback(async () => {
    if (noScoreLoaded || voiceLoading) return;
    if (startingRef.current) return;

    startingRef.current = true;
    setIsStarting(true);

    // TASK-106: 再生開始経路で例外や未決着Promiseが起きると、以前は
    // setPlaybackState('playing') に到達しないまま握り潰されていた。
    // ユーザーから見ると「再生ボタンを押しても何も起きない」状態になる。
    // パッケージ版はDevToolsを開けないため、原因を特定する手段もなかった。
    // 失敗は必ずダイアログで通知する（CLAUDE.md「エラーハンドリング」）。
    try {
      await ensureToneStarted();
      // REQ-013-003: audioEngine.playAccompanimentは再生音色のロード待ち
      // （ensurePlaybackVoiceLoaded）を内包しうるため、完了を待ってから
      // playbackStateを'playing'にする。
      await withTimeout(
        Promise.resolve(audioEngine?.playAccompaniment()),
        PLAY_REQUEST_TIMEOUT_MS,
        'playAccompaniment()'
      );
      setPlaybackState('playing');
    } catch (error) {
      console.error('Failed to start playback:', error);
      // 次回クリックで AudioContext の起動からやり直せるようにする。
      toneStartedRef.current = false;
      window.alert(t.playbackControls.startError);
    } finally {
      // 成功・失敗（タイムアウトを含む）のいずれでも解除し、次回の操作を必ず受け付ける。
      startingRef.current = false;
      setIsStarting(false);
    }
  }, [audioEngine, ensureToneStarted, setPlaybackState, noScoreLoaded, voiceLoading, t]);

  const handlePause = useCallback(() => {
    if (noScoreLoaded) return;
    audioEngine?.pauseAccompaniment();
    setPlaybackState('paused');
  }, [audioEngine, setPlaybackState, noScoreLoaded]);

  const handleStop = useCallback(() => {
    if (noScoreLoaded) return;
    audioEngine?.stopAccompaniment();
    setPlaybackState('stopped');
  }, [audioEngine, setPlaybackState, noScoreLoaded]);

  const handleTogglePlayPause = useCallback(() => {
    if (playbackState === 'playing') {
      handlePause();
    } else {
      void handlePlay();
    }
  }, [playbackState, handlePlay, handlePause]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      const tag = (e.target as HTMLElement).tagName;
      if (['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA'].includes(tag)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (noScoreLoaded) return;
        handleTogglePlayPause();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTogglePlayPause, noScoreLoaded]);

  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      <button
        data-testid="playback-play"
        title={
          noScoreLoaded
            ? t.playbackControls.noScoreTooltip
            : voiceLoading
              ? t.playbackControls.voiceLoadingTooltip
              : t.playbackControls.playTitle
        }
        aria-label={t.playbackControls.play}
        onClick={() => void handlePlay()}
        disabled={noScoreLoaded || playbackState === 'playing' || voiceLoading || isStarting}
        style={
          noScoreLoaded || playbackState === 'playing' || voiceLoading || isStarting
            ? BTN_DISABLED_STYLE
            : BTN_STYLE
        }
      >
        {voiceLoading ? t.playbackControls.voiceLoadingLabel : t.playbackControls.play}
      </button>
      <button
        data-testid="playback-pause"
        title={noScoreLoaded ? t.playbackControls.noScoreTooltip : t.playbackControls.pauseTitle}
        aria-label={t.playbackControls.pause}
        onClick={handlePause}
        disabled={noScoreLoaded || playbackState !== 'playing'}
        style={noScoreLoaded || playbackState !== 'playing' ? BTN_DISABLED_STYLE : BTN_STYLE}
      >
        {t.playbackControls.pause}
      </button>
      <button
        data-testid="playback-stop"
        title={noScoreLoaded ? t.playbackControls.noScoreTooltip : t.playbackControls.stopTitle}
        aria-label={t.playbackControls.stop}
        onClick={handleStop}
        disabled={noScoreLoaded || playbackState === 'stopped'}
        style={noScoreLoaded || playbackState === 'stopped' ? BTN_DISABLED_STYLE : BTN_STYLE}
      >
        {t.playbackControls.stop}
      </button>
    </div>
  );
};
