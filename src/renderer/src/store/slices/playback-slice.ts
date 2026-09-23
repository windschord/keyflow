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
  /** 播放范围字符串（如 "1-3, 1-5"），空 = 原始顺序。用户手动展开反复记号。 */
  playbackRange: string;
  setPlaybackRange: (range: string) => void;
  /** 序列循环开关：开启后播完小节序列末尾跳回序列开头，实现真正的循环播放。 */
  playbackLoop: boolean;
  setPlaybackLoop: (loop: boolean) => void;
}

export const createPlaybackSlice: StateCreator<PlaybackSlice> = (set) => ({
  playbackState: 'stopped',
  setPlaybackState: (playbackState) => set({ playbackState }),
  playbackRange: '',
  setPlaybackRange: (playbackRange) => set({ playbackRange }),
  playbackLoop: false,
  setPlaybackLoop: (playbackLoop) => set({ playbackLoop }),
});
