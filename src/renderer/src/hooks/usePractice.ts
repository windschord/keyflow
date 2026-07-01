import { useMemo, useEffect } from 'react';
import { PracticeEngineService } from '../lib/practice-engine';
import { AudioEngineService } from '../lib/audio-engine';
import { WebMidiService } from '../lib/midi/web-midi';
import { usePracticeStore } from '../store';
import { useMidi } from './useMidi';

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

  useMidi(
    webMidiService,
    (noteNumber, velocity, _channel) => {
      practiceEngine.handleNoteOn({
        midiNumber: noteNumber,
        velocity,
        type: 'note-on',
        timestamp: Date.now(),
      });
    },
    (noteNumber, velocity, _channel) => {
      practiceEngine.handleNoteOff({
        midiNumber: noteNumber,
        velocity,
        type: 'note-off',
        timestamp: Date.now(),
      });
    }
  );

  useEffect(() => {
    return () => {
      audioEngine.dispose();
    };
  }, [audioEngine]);

  return { practiceEngine, audioEngine };
}
