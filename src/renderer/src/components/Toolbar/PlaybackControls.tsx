import React, { useCallback, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { usePracticeStore } from '../../store';
import type { Score } from '../../types';

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

const NO_SCORE_TOOLTIP = '楽譜を開くと再生できます';
// REQ-013-003, TASK-073: 再生音色（grand-piano等）のサンプルロード中は再生ボタンを
// 無効化し、読込中であることをラベル・ツールチップで示す。
const VOICE_LOADING_TOOLTIP = '音色を読み込み中です';
const VOICE_LOADING_LABEL = '読込中...';

/**
 * 曲の再生・一時停止・停止を操作するツールバー部品（暫定実装）。
 *
 * - Spaceキーで再生/一時停止をトグルする
 * - 初回の再生操作でのみ Tone.start() を呼び、AudioContext を解放する
 * - 再生状態（playing/paused/stopped）は Zustand store で一元管理する
 */
export const PlaybackControls: React.FC<PlaybackControlsProps> = ({ audioEngine, score }) => {
  const { playbackState, setPlaybackState, voiceLoading } = usePracticeStore();
  const toneStartedRef = useRef(false);
  // score === null のときだけ「未読込」として無効化する。undefined（未指定）は
  // 呼び出し側が楽譜有無を渡していないケースであり、後方互換のため無効化しない。
  const noScoreLoaded = score === null;

  const ensureToneStarted = useCallback(async () => {
    if (!toneStartedRef.current) {
      await Tone.start();
      toneStartedRef.current = true;
    }
  }, []);

  const handlePlay = useCallback(async () => {
    if (noScoreLoaded || voiceLoading) return;
    await ensureToneStarted();
    // REQ-013-003: audioEngine.playAccompanimentは再生音色のロード待ち
    // （ensurePlaybackVoiceLoaded）を内包しうるため、完了を待ってから
    // playbackStateを'playing'にする。
    await audioEngine?.playAccompaniment();
    setPlaybackState('playing');
  }, [audioEngine, ensureToneStarted, setPlaybackState, noScoreLoaded, voiceLoading]);

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
          noScoreLoaded ? NO_SCORE_TOOLTIP : voiceLoading ? VOICE_LOADING_TOOLTIP : '再生 (Space)'
        }
        aria-label="再生"
        onClick={() => void handlePlay()}
        disabled={noScoreLoaded || playbackState === 'playing' || voiceLoading}
        style={
          noScoreLoaded || playbackState === 'playing' || voiceLoading
            ? BTN_DISABLED_STYLE
            : BTN_STYLE
        }
      >
        {voiceLoading ? VOICE_LOADING_LABEL : '再生'}
      </button>
      <button
        data-testid="playback-pause"
        title={noScoreLoaded ? NO_SCORE_TOOLTIP : '一時停止 (Space)'}
        aria-label="一時停止"
        onClick={handlePause}
        disabled={noScoreLoaded || playbackState !== 'playing'}
        style={noScoreLoaded || playbackState !== 'playing' ? BTN_DISABLED_STYLE : BTN_STYLE}
      >
        一時停止
      </button>
      <button
        data-testid="playback-stop"
        title={noScoreLoaded ? NO_SCORE_TOOLTIP : '停止'}
        aria-label="停止"
        onClick={handleStop}
        disabled={noScoreLoaded || playbackState === 'stopped'}
        style={noScoreLoaded || playbackState === 'stopped' ? BTN_DISABLED_STYLE : BTN_STYLE}
      >
        停止
      </button>
    </div>
  );
};
