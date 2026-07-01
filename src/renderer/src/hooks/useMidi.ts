import { useEffect, useRef } from 'react';
import { WebMidiService } from '../lib/midi/web-midi';

export function useMidi(
  webMidiService: WebMidiService,
  onNoteOn: (noteNumber: number, velocity: number, channel: number) => void,
  onNoteOff: (noteNumber: number, velocity: number, channel: number) => void
) {
  const onNoteOnRef = useRef(onNoteOn);
  const onNoteOffRef = useRef(onNoteOff);

  onNoteOnRef.current = onNoteOn;
  onNoteOffRef.current = onNoteOff;

  useEffect(() => {
    webMidiService.initialize().catch((err) => {
      console.error('Failed to initialize WebMIDI:', err);
    });

    webMidiService.onNoteOn((noteNumber, velocity, channel) => {
      onNoteOnRef.current(noteNumber, velocity, channel);
    });
    webMidiService.onNoteOff((noteNumber, velocity, channel) => {
      onNoteOffRef.current(noteNumber, velocity, channel);
    });

    return () => {
      webMidiService.onNoteOn(() => {});
      webMidiService.onNoteOff(() => {});
    };
  }, [webMidiService]);
}
