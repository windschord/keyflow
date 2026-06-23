export interface MidiDevice {
  id: string;
  name: string;
}

export interface MidiNoteEvent {
  midiNumber: number;
  velocity: number;
  type: 'note-on' | 'note-off';
  timestamp: number;
}
