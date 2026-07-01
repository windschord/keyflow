import { useEffect } from 'react';
import { WebMidiService } from '../lib/midi/web-midi';

export function useMidi(
  webMidiService: WebMidiService,
  onNoteOn: (noteNumber: number, velocity: number, channel: number) => void,
  onNoteOff: (noteNumber: number, velocity: number, channel: number) => void
) {
  useEffect(() => {
    webMidiService.initialize().catch((err) => {
      console.error('Failed to initialize WebMIDI:', err);
    });

    webMidiService.onNoteOn(onNoteOn);
    webMidiService.onNoteOff(onNoteOff);

    return () => {
      webMidiService.onNoteOn(() => {});
      webMidiService.onNoteOff(() => {});
    };
  }, [webMidiService, onNoteOn, onNoteOff]);
}
