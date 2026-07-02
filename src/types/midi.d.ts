declare module 'midi' {
  class Input {
    constructor();
    getPortCount(): number;
    getPortName(port: number): string;
    openPort(port: number): void;
    closePort(): void;
    openVirtualPort(name: string): void;
    ignoreTypes(sysex: boolean, timing: boolean, activeSensing: boolean): void;
    on(event: 'message', callback: (deltaTime: number, message: number[]) => void): void;
  }

  class Output {
    constructor();
    getPortCount(): number;
    getPortName(port: number): string;
    openPort(port: number): void;
    closePort(): void;
    openVirtualPort(name: string): void;
    sendMessage(message: number[]): void;
  }

  export = { Input, Output };
}
