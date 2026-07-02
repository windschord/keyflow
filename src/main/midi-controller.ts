import midi from 'midi';

export class MidiController {
  private input: midi.Input | null = null;
  private output: midi.Output | null = null;

  constructor() {
    this.input = new midi.Input();
    this.output = new midi.Output();
  }

  public getInput(): midi.Input | null {
    return this.input;
  }

  public getOutput(): midi.Output | null {
    return this.output;
  }
}
