export type MidiNoteCallback = (noteNumber: number, velocity: number, channel: number) => void;

export class WebMidiService {
  private access: MIDIAccess | null = null;
  private onNoteOnCallback: MidiNoteCallback | null = null;
  private onNoteOffCallback: MidiNoteCallback | null = null;

  async initialize(): Promise<void> {
    this.access = await navigator.requestMIDIAccess({ sysex: false });
    this.access.onstatechange = () => this.rebindInputs();
    this.rebindInputs();
  }

  onNoteOn(callback: MidiNoteCallback): void {
    this.onNoteOnCallback = callback;
  }

  onNoteOff(callback: MidiNoteCallback): void {
    this.onNoteOffCallback = callback;
  }

  getDevices(): Array<{ id: string; name: string }> {
    if (!this.access) return [];
    return Array.from(this.access.inputs.values()).map((input) => ({
      id: input.id,
      name: input.name ?? 'Unknown',
    }));
  }

  private rebindInputs(): void {
    if (!this.access) return;
    this.access.inputs.forEach((input) => {
      input.onmidimessage = (event: MIDIMessageEvent) => this.handleMessage(event);
    });
  }

  private handleMessage(event: MIDIMessageEvent): void {
    const data = event.data;
    if (!data || data.length < 3) return;
    const status = data[0];
    const noteNumber = data[1];
    const velocity = data[2];
    const channel = (status & 0x0f) + 1;
    const command = status & 0xf0;

    if (command === 0x90 && velocity > 0) {
      this.onNoteOnCallback?.(noteNumber, velocity, channel);
    } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
      this.onNoteOffCallback?.(noteNumber, 0, channel);
    }
  }
}
