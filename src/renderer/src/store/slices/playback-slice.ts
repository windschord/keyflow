import { StateCreator } from 'zustand';

/**
 * 曲の再生（お手本演奏）の状態。
 *
 * - stopped: 未再生、または停止操作により先頭に戻った状態
 * - playing: 再生中
 * - paused: 一時停止中（再開すると続きから再生される）
 */
export type PlaybackState = 'stopped' | 'playing' | 'paused';

export interface PlaybackSlice {
  playbackState: PlaybackState;
  setPlaybackState: (state: PlaybackState) => void;
}

export const createPlaybackSlice: StateCreator<PlaybackSlice> = (set) => ({
  playbackState: 'stopped',
  setPlaybackState: (playbackState) => set({ playbackState }),
});
