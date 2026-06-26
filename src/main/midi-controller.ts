import midi from '@julusian/midi';
import { BrowserWindow } from 'electron';
import { IpcChannels } from './ipc-channels';
import { MidiDevice, MidiNoteEvent } from '../renderer/src/types/midi';

export class MidiControllerService {
  private input: midi.Input | null = null;
  private win: BrowserWindow | null;

  constructor(win: BrowserWindow) {
    this.win = win;
  }

  setWindow(win: BrowserWindow): void {
    this.win = win;
  }

  initialize(): void {
    if (!this.input) {
      this.input = new midi.Input();

      // Ignore sysex, timing, and active sensing messages.
      this.input.ignoreTypes(true, true, true);

      this.input.on('message', (_deltaTime: number, message: number[]) => {
        if (message.length >= 3) {
          this.onMessage(_deltaTime, message as [number, number, number]);
        }
      });
    }
  }

  listDevices(): MidiDevice[] {
    if (!this.input) return [];

    const portCount = this.input.getPortCount();
    const devices: MidiDevice[] = [];

    for (let i = 0; i < portCount; i++) {
      devices.push({
        index: i,
        name: this.input.getPortName(i),
      });
    }

    return devices;
  }

  selectDevice(index: number): void {
    if (!this.input) return;

    const portCount = this.input.getPortCount();
    if (index >= 0 && index < portCount) {
      // Close existing port if any
      this.input.closePort();
      this.input.openPort(index);
    }
  }

  dispose(): void {
    if (this.input) {
      this.input.closePort();
      this.input = null;
    }
    this.win = null;
  }

  private onMessage(_deltaTime: number, message: [number, number, number]): void {
    const [status, data1, data2] = message;

    // Status byte gives message type and channel
    // 0x90 to 0x9F is Note On
    // 0x80 to 0x8F is Note Off
    const messageType = status & 0xf0; // Mask out the channel
    const channel = (status & 0x0f) + 1; // 1-16

    if (!this.win || this.win.isDestroyed()) return;

    if (messageType === 0x90 || messageType === 0x80) {
      const isNoteOn = messageType === 0x90 && data2 > 0;

      const event: MidiNoteEvent = {
        midiNumber: data1,
        velocity: data2,
        type: isNoteOn ? 'note-on' : 'note-off',
        channel,
        timestamp: Date.now(), // Use current time as timestamp
      };

      this.win.webContents.send(
        isNoteOn ? IpcChannels.MIDI_NOTE_ON : IpcChannels.MIDI_NOTE_OFF,
        event
      );
    }
  }
}
