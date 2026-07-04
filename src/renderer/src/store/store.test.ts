import { describe, it, expect, beforeEach } from 'vitest';
import { usePracticeStore } from './index';

describe('usePracticeStore', () => {
  beforeEach(() => {
    // Zustand store reset
    const store = usePracticeStore.getState();
    usePracticeStore.setState({
      ...store,
      score: null,
      musicXmlPath: null,
      musicXmlContent: null,
      practiceMode: 'both',
      loopEnabled: false,
      loopStart: 1,
      loopEnd: 1,
      bpm: 120,
      metronomeEnabled: false,
      playbackState: 'stopped',
    });
  });

  it('should set practice mode correctly', () => {
    const { setPracticeMode } = usePracticeStore.getState();
    setPracticeMode('right');
    expect(usePracticeStore.getState().practiceMode).toBe('right');
  });

  it('should set loop range correctly', () => {
    const { setLoopRange } = usePracticeStore.getState();
    setLoopRange(5, 10);
    expect(usePracticeStore.getState().loopStart).toBe(5);
    expect(usePracticeStore.getState().loopEnd).toBe(10);
  });

  it('should toggle loop correctly', () => {
    const { toggleLoop } = usePracticeStore.getState();
    expect(usePracticeStore.getState().loopEnabled).toBe(false);
    toggleLoop();
    expect(usePracticeStore.getState().loopEnabled).toBe(true);
  });

  it('should set BPM correctly', () => {
    const { setBpm } = usePracticeStore.getState();
    setBpm(140);
    expect(usePracticeStore.getState().bpm).toBe(140);
  });

  it('should set score correctly', () => {
    const { setScore } = usePracticeStore.getState();
    const mockScore = {
      title: 'Test',
      parts: [],
      measures: [],
      tempo: 120,
      timeSignature: { beats: 4, beatType: 4 },
      keySignature: 0,
    };
    setScore(mockScore, 'path/to/file.xml', '<score-partwise/>');
    expect(usePracticeStore.getState().score).toBe(mockScore);
    expect(usePracticeStore.getState().musicXmlPath).toBe('path/to/file.xml');
    expect(usePracticeStore.getState().musicXmlContent).toBe('<score-partwise/>');
  });

  it('should default playbackState to stopped', () => {
    expect(usePracticeStore.getState().playbackState).toBe('stopped');
  });

  it('should set playbackState correctly', () => {
    const { setPlaybackState } = usePracticeStore.getState();

    setPlaybackState('playing');
    expect(usePracticeStore.getState().playbackState).toBe('playing');

    setPlaybackState('paused');
    expect(usePracticeStore.getState().playbackState).toBe('paused');

    setPlaybackState('stopped');
    expect(usePracticeStore.getState().playbackState).toBe('stopped');
  });
});
