import midi from 'midi';
import { BrowserWindow } from 'electron';

export interface MidiDevice {
  id: string;
  name: string;
}

export interface MidiNoteEvent {
  noteNumber: number;
  velocity: number;
  channel: number;
  timestamp: number;
}

export class MidiControllerService {
  private input: midi.Input;
  private win: BrowserWindow | null;

  constructor(win: BrowserWindow) {
    this.win = win;
    this.input = new midi.Input();
  }

  initialize(): void {
    this.input.on('message', (deltaTime: number, message: [number, number, number]) => {
      this.onMessage(deltaTime, message);
    });
  }

  listDevices(): MidiDevice[] {
    const devices: MidiDevice[] = [];
    const portCount = this.input.getPortCount();
    for (let i = 0; i < portCount; i++) {
      devices.push({
        id: i.toString(),
        name: this.input.getPortName(i),
      });
    }
    return devices;
  }

  selectDevice(index: number): void {
    if (this.input.isPortOpen()) {
      this.input.closePort();
    }
    const portCount = this.input.getPortCount();
    if (index >= 0 && index < portCount) {
      this.input.openPort(index);
    }
  }

  dispose(): void {
    if (this.input.isPortOpen()) {
      this.input.closePort();
    }
    this.win = null;
  }

  private onMessage(_deltaTime: number, message: [number, number, number]): void {
    if (!this.win) return;

    const statusByte = message[0];
    const channel = (statusByte & 0x0f) + 1;
    const command = statusByte & 0xf0;
    const noteNumber = message[1];
    const velocity = message[2];

    // Note On
    if (command === 0x90 && velocity > 0) {
      this.win.webContents.send('midi:note-on', {
        noteNumber,
        velocity,
        channel,
        timestamp: Date.now(),
      } satisfies MidiNoteEvent);
    }
    // Note Off (0x80 or 0x90 with velocity 0)
    else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
      this.win.webContents.send('midi:note-off', {
        noteNumber,
        velocity,
        channel,
        timestamp: Date.now(),
      } satisfies MidiNoteEvent);
    }
  }
}
