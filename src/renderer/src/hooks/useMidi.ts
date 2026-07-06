import { useEffect } from 'react';
import { WebMidiService } from '../lib/midi/web-midi';
import { usePracticeStore } from '../store';

export function useMidi(
  webMidiService: WebMidiService,
  onNoteOn: (noteNumber: number, velocity: number, channel: number) => void,
  onNoteOff: (noteNumber: number, velocity: number, channel: number) => void
) {
  // TASK-045: 選択中のMIDI入力デバイス（REQ-004-008）。usePracticeStoreの
  // midiDeviceIdを単一の真実源とし、ここで実際のWebMidiServiceへ反映する。
  // App.tsx起動時の設定ロード（electron-store `midi.selectedDeviceId`）と
  // SettingsModalでの変更は、いずれもstoreのmidiDeviceIdを更新するだけでよく、
  // 本フックが両方のケースを同じ経路で処理する。
  const midiDeviceId = usePracticeStore((s) => s.midiDeviceId);

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

  useEffect(() => {
    webMidiService.setSelectedDevice(midiDeviceId);
  }, [webMidiService, midiDeviceId]);
}
