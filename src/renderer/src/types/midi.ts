export interface MidiDevice {
  index: number;
  name: string;
}

export interface MidiNoteEvent {
  midiNumber: number;
  velocity: number;
  type: 'note-on' | 'note-off';
  timestamp: number;
  channel?: number;
}
