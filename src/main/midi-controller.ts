// eslint-disable-next-line @typescript-eslint/no-require-imports
const midi = require('midi');

export class MidiController {
  private input: typeof import('midi').Input.prototype | null = null;
  private output: typeof import('midi').Output.prototype | null = null;

  constructor() {
    try {
      this.input = new midi.Input();
    } catch (error) {
      console.error('Failed to initialize MIDI input:', error);
      this.input = null;
    }

    try {
      this.output = new midi.Output();
    } catch (error) {
      console.error('Failed to initialize MIDI output:', error);
      this.output = null;
    }
  }

  public getInput(): typeof import('midi').Input.prototype | null {
    return this.input;
  }

  public getOutput(): typeof import('midi').Output.prototype | null {
    return this.output;
  }
}
