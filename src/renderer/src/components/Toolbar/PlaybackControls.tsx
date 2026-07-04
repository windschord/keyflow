import React, { useCallback, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { usePracticeStore } from '../../store';

const BTN_STYLE: React.CSSProperties = {
  height: '44px',
  padding: '0 14px',
  fontSize: '15px',
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
  playAccompaniment: () => void;
  pauseAccompaniment: () => void;
  stopAccompaniment: () => void;
}

interface PlaybackControlsProps {
  audioEngine?: PlaybackAudioEngine;
}

/**
 * 曲の再生・一時停止・停止を行うツールバー部品（暫定実装）。
 *
 * - Spaceキーで再生/一時停止をトグルする
 * - 初回の再生操作でのみ Tone.start() を呼び、AudioContext を解放する
 * - 再生状態（playing/paused/stopped）は Zustand store で一元管理する
 */
export const PlaybackControls: React.FC<PlaybackControlsProps> = ({ audioEngine }) => {
  const { playbackState, setPlaybackState } = usePracticeStore();
  const toneStartedRef = useRef(false);

  const ensureToneStarted = useCallback(async () => {
    if (!toneStartedRef.current) {
      await Tone.start();
      toneStartedRef.current = true;
    }
  }, []);

  const handlePlay = useCallback(async () => {
    await ensureToneStarted();
    audioEngine?.playAccompaniment();
    setPlaybackState('playing');
  }, [audioEngine, ensureToneStarted, setPlaybackState]);

  const handlePause = useCallback(() => {
    audioEngine?.pauseAccompaniment();
    setPlaybackState('paused');
  }, [audioEngine, setPlaybackState]);

  const handleStop = useCallback(() => {
    audioEngine?.stopAccompaniment();
    setPlaybackState('stopped');
  }, [audioEngine, setPlaybackState]);

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
        handleTogglePlayPause();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTogglePlayPause]);

  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      <button
        data-testid="playback-play"
        title="再生 (Space)"
        aria-label="再生"
        onClick={() => void handlePlay()}
        disabled={playbackState === 'playing'}
        style={playbackState === 'playing' ? BTN_DISABLED_STYLE : BTN_STYLE}
      >
        再生
      </button>
      <button
        data-testid="playback-pause"
        title="一時停止 (Space)"
        aria-label="一時停止"
        onClick={handlePause}
        disabled={playbackState !== 'playing'}
        style={playbackState !== 'playing' ? BTN_DISABLED_STYLE : BTN_STYLE}
      >
        一時停止
      </button>
      <button
        data-testid="playback-stop"
        title="停止"
        aria-label="停止"
        onClick={handleStop}
        disabled={playbackState === 'stopped'}
        style={playbackState === 'stopped' ? BTN_DISABLED_STYLE : BTN_STYLE}
      >
        停止
      </button>
    </div>
  );
};
